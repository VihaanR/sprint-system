#!/usr/bin/env node

/**
 * scripts/router-smoke.mjs
 * 
 * Smoke test proving executors behind the task router produce work.
 * Usage: node scripts/router-smoke.mjs [--router <path>] [--timeout-min <min>] [--require <executor>] [--dry]
 */

import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const argv = process.argv.slice(2);
const routerPath = getFlag(argv, '--router') || fileURLToPath(new URL('../bin/ab-route.js', import.meta.url));
const timeoutMin = Number(getFlag(argv, '--timeout-min') || 10);
const required = getFlag(argv, '--require');
const dry = argv.includes('--dry');

function getFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
}

// Run the router with a timer; on timeout kill the whole process tree (executors spawn children).
function runRouter(args, timeoutMs) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, args, { windowsHide: true });
        let stdout = '', timedOut = false;
        const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => process.stderr.write(d));
        child.on('close', () => { clearTimeout(timer); resolve({ stdout, timedOut }); });
    });
}

function killTree(child) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGKILL');
}

// Remove every route-* worktree and route/* branch in the temp repo: all of them came from this script's runs.
function cleanupRoutes(repo) {
    const list = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout || '';
    const trees = list.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9).trim());
    for (const t of trees.filter(t => path.basename(t).startsWith('route-'))) spawnSync('git', ['worktree', 'remove', '--force', t], { cwd: repo });
    spawnSync('git', ['worktree', 'prune'], { cwd: repo });
    const branches = spawnSync('git', ['branch', '--list', 'route/*', '--format=%(refname:short)'], { cwd: repo, encoding: 'utf8' }).stdout || '';
    for (const b of branches.split('\n').filter(Boolean)) spawnSync('git', ['branch', '-D', b], { cwd: repo });
}

function smokeFileOk(tree) {
    const f = tree ? path.join(tree, 'SMOKE.txt') : '';
    return Boolean(f) && fs.existsSync(f) && fs.readFileSync(f, 'utf8').trim() === 'ok';
}

function parseOutput(stdout) {
    try { return JSON.parse(stdout || '{}'); }
    catch {
        console.error(`bad router output: ${stdout.slice(0, 200)}`);
        return { outcome: 'bad-output', attempts: [] };
    }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-smoke-'));
const repoDir = path.join(tmpDir, 'test-repo');
fs.mkdirSync(repoDir);
spawnSync('git', ['init'], { cwd: repoDir });
spawnSync('git', ['commit', '--allow-empty', '-m', 'Initial commit'], { cwd: repoDir });

const executors = [
    { key: 'antigravity', class: 'agy' },
    { key: 'opencode:free', class: 'bulk' }
];

const results = [];
for (const ex of executors) {
    console.error(`Testing ${ex.key} (class: ${ex.class})...`);
    const start = Date.now();
    const args = [routerPath, '--class', ex.class, '--repo', repoDir, ...(dry ? ['--dry'] : []), 'Create SMOKE.txt containing the single line ok'];
    const result = await runRouter(args, timeoutMin * 60 * 1000);

    const outcome = result.timedOut ? { outcome: 'timeout', attempts: [] } : parseOutput(result.stdout);
    // Router keys carry a suffix (antigravity:<model>, opencode:free:<model>); a skipped attempt never ran.
    const isRow = key => key === ex.key || String(key).startsWith(ex.key + ':');
    const ran = (outcome.attempts || []).filter(a => !a.skipped);
    const started = ran.some(a => isRow(a.executor));
    const wrongExecutor = ran.some(a => !isRow(a.executor));
    if (wrongExecutor) outcome.outcome = 'wrong-executor';
    // Proof of work: SMOKE.txt with "ok" in the worktree this run created; outcome "ok" alone is not enough.
    const diffProduced = !wrongExecutor && smokeFileOk(outcome.worktree);
    const seconds = Math.round((Date.now() - start) / 1000);
    cleanupRoutes(repoDir);

    results.push({
        executor: ex.key,
        started: started ? 'y' : 'n',
        diffProduced: diffProduced ? 'y' : 'n',
        outcome: outcome.outcome,
        seconds
    });
}

console.log('| executor | started | diff produced | outcome | seconds |');
console.log('|----------|---------|---------------|---------|---------|');
for (const r of results) {
    console.log(`| ${r.executor} | ${r.started} | ${r.diffProduced} | ${r.outcome} | ${r.seconds} |`);
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

if (dry) process.exit(0); // dry runs call no executor, so no diff is expected
const success = results.some(r => r.diffProduced === 'y');
if (required) {
    const reqRes = results.find(r => r.executor === required);
    if (!reqRes || reqRes.diffProduced !== 'y') process.exit(1);
}

process.exit(success ? 0 : 1);
