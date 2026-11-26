#!/usr/bin/env node
// Runs this repo's checks and writes the /verify record from their real output and exit codes, so the sprint
// sidebar's done gate can trust it: `result: pass` only when every check exits 0.
// Usage: node scripts/verify.mjs    (exits 1 when any check fails)
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const root = process.cwd()
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 300000 })
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` }
}
const files = (dir, ext) => {
  try { return readdirSync(join(root, dir)).filter(f => f.endsWith(ext)).map(f => `${dir}/${f}`) } catch { return [] }
}

const py = files('scripts', '.py')
const checks = [
  ['mod tests', 'claude', ['plugin', 'test', 'sprint-mod']],
  ['mod validate', 'claude', ['plugin', 'validate', 'sprint-mod']],
  ...(py.length ? [['python compile', process.platform === 'win32' ? 'python' : 'python3', ['-m', 'py_compile', ...py]]] : []),
  ...files('scripts/hooks', '.js').map(f => [`node --check ${f}`, process.execPath, ['--check', f]]),
]
const results = checks.map(([name, cmd, args]) => ({ name, ...run(cmd, args) }))
const pass = results.every(r => r.code === 0)

const now = new Date(), pad = n => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
const dir = join(homedir(), '.claude', 'verify-evidence')
const file = join(dir, `${basename(root)}-${stamp}.md`)
const tail = s => s.trim().split(/\r?\n/).slice(-12).join('\n')
const block = (title, text) => [title, '```', text || '(none)', '```']

mkdirSync(dir, { recursive: true })
writeFileSync(file, [
  `result: ${pass ? 'pass' : 'fail'}`,
  `# verify: ${basename(root)} ${now.toISOString()}`,
  "Written by scripts/verify.mjs from each check's exit code. Output is verbatim, last 12 lines.",
  '',
  ...block('## git status --short', run('git', ['status', '--short']).out.trim()),
  ...block('## git diff --stat', run('git', ['diff', '--stat']).out.trim()),
  ...results.flatMap(r => block(`## ${r.name}: ${r.code === 0 ? 'PASS' : `FAIL (exit ${r.code})`}`, tail(r.out))),
].join('\n') + '\n')

for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}`)
console.log(`result: ${pass ? 'pass' : 'fail'}  ->  ${file}`)
process.exit(pass ? 0 : 1)
