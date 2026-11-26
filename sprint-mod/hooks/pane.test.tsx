import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'sprint-mod', component: 'Pane', requestId: 'sprint',
  props: { title: 'Sprint', isFocused: false, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
const NOW = Date.parse('2026-11-26T10:00:00Z')
const FILES: Record<string, string> = {
  '/repo/.sprint-state.json': JSON.stringify({ active: true, phase: 3, startedAt: '2026-11-26T09:00:00Z', skillsLoaded: ['phase-frontend'] }),
  '/repo/sprint.config.json': JSON.stringify({ timeBudgetMinutes: 300 }),
  '/home/.agent-bridge/health.json': JSON.stringify({ executors: {
    'antigravity:Gemini 4 Hydrogen (High)': { state: 'ok', runs: [{ ts: '2026-11-26T09:30:00Z', outcome: 'ok' }] },
    'opencode:free:freellmapi/auto': { state: 'tripped', until: '2026-11-26T10:30:00Z', reason: 'quota', runs: [{ ts: '2026-11-26T09:40:00Z', outcome: 'quota' }] },
  } }),
  '/home/.claude/verify-evidence/repo-20261126-1000.md': 'result: pass\n# verify: repo',
  '/home/.agent-bridge/telemetry.jsonl': JSON.stringify({ ts: '2026-11-26T09:45:00Z', to: 'antigravity', model: 'hydrogen', outcome: 'ok', durS: 40 }) + '\n',
}
const AGENT = { id: 'a1', description: 'Research sidebar UI', type: 'general-purpose', status: 'running', kind: 'local_agent', taskStatus: 'running', label: 'research', startTime: NOW, cwd: '/repo', tokenCount: 12000, tokenSamples: [], contextWindowSize: 200000 }

function engine(on: any, agents: unknown[] = [], evidence: unknown[] = [], files: Record<string, string> = FILES, withClock = true) {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('env.get', () => ({ value: '/home' }))
  if (withClock) on('clock.now', () => ({ value: NOW }))
  if (withClock) on('clock.every', () => ({ value: { id: 't' } }))
  on('fs.read', (_: unknown, e: any) => { const p = e.path.replace(/^[A-Z]:/, '').split(String.fromCharCode(92)).join('/'); return p in files ? { value: files[p] } : { deny: 'ENOENT' } })
  on('process.run', (_: unknown, e: any) => ({ value: { exitCode: 0, stdout: (e.argv ?? e.command ?? []).includes?.('status') ? ' M src/app.ts' + String.fromCharCode(10) : '', stderr: '' } }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: NOW - 60000, isLink: false } }))
  on('fs.list', () => ({ value: evidence }))
  on('agent.list', () => ({ value: agents }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 50000, window: 200000 }, rateLimits: [], cost: { usd: 1.5 } } }))
}

test('expanded pane draws phase, executors, handovers, subagents', async ($, on) => {
  engine(on, [AGENT])
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /P3\/6 FRONTEND/ }))?.text).toContain('FRONTEND')
  expect(await ui.find({ type: 'Text', text: /ANTIGRAVITY/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /1 live/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /h hud/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /DONE GATE/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /edit \d\d:\d\d ·/ })).toBeTruthy()
  await ui.unmount()
})

test('narrow pane goes compact', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 26 }, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /0 running/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /HANDOVERS/ })).toBeFalsy()
  await ui.unmount()
})


test('effort routing: Explore goes low, auditor high, explicit effort kept', async ($, on) => {
  engine(on)
  const seen: (string | undefined)[] = []
  on('tool.call', (_: unknown, e: any) => { seen.push(e.effort); return { result: {} } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Agent', subagent_type: 'Explore', description: 'd', prompt: 'p' } as any)
  await $.tool.call({ tool: 'Agent', subagent_type: 'auditor', description: 'd', prompt: 'p' } as any)
  await $.tool.call({ tool: 'Agent', subagent_type: 'Explore', description: 'd', prompt: 'p', effort: 'max' } as any)
  expect(seen).toEqual(['low', 'high', 'max'])
})


test('a router call draws as one card line', async ($, on) => {
  engine(on)
  const out = { stdout: JSON.stringify({ outcome: 'ok', class: 'recon', attempts: [{ executor: 'opencode:free:freellmapi/auto', outcome: 'ok', log: 'C:/x.log' }] }), stderr: '' }
  const ui = await $.ui.mount({ plugin: 'sprint-mod', component: 'ToolUse', requestId: 't1', surface: 'terminal',
    props: { tool_use_id: 't1', tool: 'Bash', input: { command: 'node ~/.claude/bin/ab-route.js --class recon --repo . "x"' }, isRunning: false, isErrored: false, isInterrupted: false, output: out } } as any)
  expect(await ui.find({ type: 'Text', text: /route/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /freellmapi\/auto ok/ })).toBeTruthy()
  await ui.unmount()
})


test('done gate: an edit after the last /verify shows NOT VERIFIED', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /NOT VERIFIED/ })).toBeTruthy()
  await ui.unmount()
})

test('done gate: evidence newer than the edit shows VERIFIED', async ($, on) => {
  engine(on, [], [{ name: 'repo-20261126-1000.md', kind: 'file', size: 1, mtimeMs: NOW, isLink: false }])
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /NOT VERIFIED/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: / VERIFIED / })).toBeTruthy()
  await ui.unmount()
})

test('effort routing leaves agents alone outside a sprint', async ($, on) => {
  engine(on, [], [], { ...FILES, '/repo/.sprint-state.json': JSON.stringify({ active: false }) })
  const seen: (string | undefined)[] = []
  on('tool.call', (_: unknown, e: any) => { seen.push(e.effort); return { result: {} } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Agent', subagent_type: 'Explore', description: 'd', prompt: 'p' } as any)
  expect(seen).toEqual([undefined])
})


import { briefOf, critiqueTitle, isUrgent, keepAction, parseJobs } from './register'

test('keepAction: arms once per sprint, turns off only its own window', () => {
  const T0 = NOW - 60 * 60000, live = { active: true, budgetMin: 300, startedAtMs: T0, readAtMs: NOW }
  expect(keepAction(live, 0, 'off')).toEqual({ armed: T0, args: '240m' })
  expect(keepAction(live, T0, 'off')).toBeNull()
  expect(keepAction(live, 0, 'on')).toBeNull()
  expect(keepAction({ ...live, readAtMs: T0 + 250 * 60000 }, 0, 'off')).toBeNull()
  expect(keepAction({ ...live, active: false }, T0, 'on')).toEqual({ armed: 0, args: 'off' })
  expect(keepAction({ ...live, readAtMs: T0 + 301 * 60000 }, T0, 'on')).toEqual({ armed: 0, args: 'off' })
  expect(keepAction({ ...live, active: false }, 0, 'on')).toBeNull()
})


const NOTE = 'Here is a note offered by a side agent:\n\n> Heads up · cache-tax spends usage.\n>\n> **cache-tax spends usage during your breaks**\n> - The catch: it pings while you are away.'

test('critiqueTitle takes the bold line of a side-agent note', () => {
  expect(critiqueTitle(NOTE)).toBe('cache-tax spends usage during your breaks')
  expect(critiqueTitle('Here is a note offered by a side agent:\n\n> Plain first line')).toBe('Plain first line')
})

test('a side-agent note becomes a critique and apply sends one ponytail-review prompt', async ($, on) => {
  engine(on, [], [], FILES, false)
  const clock = mock.clock(on, { now: NOW })
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: any) => { sent.push(e.text); return { text: e.text } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const held: any = await $.prompt.submit({ text: NOTE })
  expect(held.drop).toContain('Queued for ponytail review')
  await $.prompt.submit({ text: 'a normal prompt' })
  expect(sent).toEqual(['a normal prompt'])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /1 open/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /cache-tax spends usage/ })).toBeTruthy()
  await ui.unmount()
  const r: any = await $.command.run({ command: 'sprint-critiques', args: 'apply' })
  expect(r.text).toContain('Sent 1 critique')
  await clock.advance(100)
  const review = sent.find(t => t.includes('ponytail-review'))
  expect(review).toContain('1. cache-tax spends usage during your breaks')
  const again: any = await $.command.run({ command: 'sprint-critiques', args: 'apply' })
  expect(again.text).toBe('No open critiques.')
})


test('hold off: a side-agent note is still queued but also goes on to Claude', async ($, on) => {
  engine(on)
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: any) => { sent.push(e.text); return { text: e.text } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'sprint-critiques', args: 'hold off' })
  await $.prompt.submit({ text: NOTE })
  expect(sent).toEqual([NOTE])
  const r: any = await $.command.run({ command: 'sprint-critiques' })
  expect(r.text).toContain('1. cache-tax spends usage during your breaks')
  expect(r.text).toContain('Hold: off')
})

test('a phase advance sends held critiques through ponytail-review', async ($, on) => {
  const files: Record<string, string> = { ...FILES }
  engine(on, [], [], files, false)
  const clock = mock.clock(on, { now: NOW })
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: any) => { sent.push(e.text); return { text: e.text } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: NOTE })
  files['/repo/.sprint-state.json'] = JSON.stringify({ active: true, phase: 4, startedAt: '2026-11-26T09:00:00Z', skillsLoaded: [] })
  await $.command.run({ command: 'sprint' })
  await clock.advance(100)
  expect(sent.filter(t => t.includes('ponytail-review'))).toHaveLength(1)
})

test('the critique queue is restored from the store after a restart', async ($, on) => {
  engine(on)
  mock.store(on, { 'critiques:/repo': [{ id: 'c1', at: NOW, title: 'Saved before restart', text: 'x', status: 'open' }] })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Saved before restart/ })).toBeTruthy()
  await ui.unmount()
})


const EVIDENCE = [{ name: 'repo-20261126-1000.md', kind: 'file', size: 1, mtimeMs: NOW, isLink: false }]

test('done gate: a newer record that says result: fail stays red', async ($, on) => {
  engine(on, [], EVIDENCE, { ...FILES, '/home/.claude/verify-evidence/repo-20261126-1000.md': 'result: fail\n3 failed' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /CHECKS FAILED/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: / VERIFIED / })).toBeFalsy()
  await ui.unmount()
})

test('done gate: a newer record with no result line stays red', async ($, on) => {
  engine(on, [], EVIDENCE, { ...FILES, '/home/.claude/verify-evidence/repo-20261126-1000.md': '# verify: typed summary, tests looked fine' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /NO RESULT/ })).toBeTruthy()
  await ui.unmount()
})


test('urgent side-agent notes skip the hold, other notes wait', () => {
  expect(isUrgent('Heads up · The main agent is about to install cache-tax')).toBe(true)
  expect(isUrgent('This will delete the worktree')).toBe(true)
  expect(isUrgent('A green done gate does not mean tests passed')).toBe(false)
})

test('an urgent note reaches Claude during a sprint and is still listed', async ($, on) => {
  engine(on)
  const sent: string[] = []
  on('prompt.submit', (_: unknown, e: any) => { sent.push(e.text); return { text: e.text } })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const urgent = 'Here is a note offered by a side agent:\n\n> **The main agent is about to push to main**'
  await $.prompt.submit({ text: urgent })
  expect(sent).toEqual([urgent])
  const r: any = await $.command.run({ command: 'sprint-critiques' })
  expect(r.text).toContain('about to push to main')
})

test('briefOf and parseJobs', () => {
  expect(briefOf({ tool: 'Bash', command: 'npm test\nmore' })).toBe('npm test')
  expect(briefOf({ tool: 'Read', file_path: 'C:/repo/src/app.ts' })).toBe('app.ts')
  const T = '2026-11-26T09:00:00Z', now = Date.parse(T) + 60000
  const lines = [
    JSON.stringify({ ts: T, taskId: 't1', to: 'antigravity', model: 'Gemini 4 Hydrogen (High)', outcome: 'started', task: 'add tests', log: 'x.log' }),
    JSON.stringify({ ts: T, taskId: 't2', to: 'opencode:free:freellmapi/auto', model: 'freellmapi/auto', outcome: 'started', task: 'map repo' }),
    JSON.stringify({ ts: T, taskId: 't2', to: 'opencode:free:freellmapi/auto', model: 'freellmapi/auto', outcome: 'ok', durS: 27 }),
  ]
  const jobs = parseJobs(lines, now)
  expect(jobs.find(j => j.task === 'add tests')?.state).toBe('running')
  expect(jobs.find(j => j.task === 'map repo')).toMatchObject({ state: 'ok', durS: 27 })
  expect(parseJobs(lines, Date.parse(T) + 31 * 60000).find(j => j.task === 'add tests')?.state).toBe('lost')
})

test('Agents tab: live subagent action, a delegated job, and btw answers', async ($, on) => {
  const tele = JSON.stringify({ ts: '2026-11-26T09:58:00Z', taskId: 't1', to: 'antigravity', model: 'Gemini 4 Hydrogen (High)', outcome: 'started', task: 'add pagination tests', log: '/home/x.log' })
  engine(on, [AGENT], [], { ...FILES, '/home/.agent-bridge/telemetry.jsonl': tele + '\n', '/home/x.log': 'running vitest' })
  on('tool.call', () => ({ result: {} }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Running the test suite; on track.', usage: { input_tokens: 1, output_tokens: 1 } } }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a1' } as any)
  const ui = await $.ui.mount({ ...PANE, requestId: 'sprint-agents', surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Research sidebar UI/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Bash npm test/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /add pagination tests/ })).toBeTruthy()
  await ui.press({ key: 'btw-a1' })
  expect(await ui.find({ type: 'Text', text: /on track/ })).toBeTruthy()
  await ui.unmount()
})
