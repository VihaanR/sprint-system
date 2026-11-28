#!/usr/bin/env node

/**
 * scripts/router-smoke.mjs
 * 
 * Smoke test proving executors behind the task router produce work.
 * Usage: node scripts/router-smoke.mjs [--router <path>] [--timeout-min <min>] [--require <executor>]
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const argv = process.argv.slice(2);
const routerPath = getFlag(argv, '--router') || 'bin/ab-route.js';
const timeoutMin = Number(getFlag(argv, '--timeout-min') || 10);
const required = getFlag(argv, '--require');

function getFlag(args, flag) {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
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
    const result = spawnSync('node', [routerPath, '--class', ex.class, '--repo', repoDir, 'Create SMOKE.txt containing the single line ok'], {
        encoding: 'utf8',
        timeout: timeoutMin * 60 * 1000
    });
    
    const outcome = JSON.parse(result.stdout || '{}');
    const started = outcome.outcome !== 'exhausted' || (outcome.attempts && outcome.attempts.some(a => a.executor === ex.key && a.outcome !== 'skipped'));
    const diffProduced = outcome.outcome === 'ok';
    const seconds = Math.round((Date.now() - start) / 1000);
    
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

const success = results.some(r => r.diffProduced === 'y');
if (required) {
    const reqRes = results.find(r => r.executor === required);
    if (!reqRes || reqRes.diffProduced !== 'y') process.exit(1);
}

process.exit(success ? 0 : 1);
