import { expect, test } from 'claude-code/testing'

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
  '/home/.agent-bridge/telemetry.jsonl': JSON.stringify({ ts: '2026-11-26T09:45:00Z', to: 'antigravity', model: 'hydrogen', outcome: 'ok', durS: 40 }) + '\n',
}
const AGENT = { id: 'a1', description: 'Research sidebar UI', type: 'general-purpose', status: 'running', kind: 'local_agent', taskStatus: 'running', label: 'research', startTime: NOW, cwd: '/repo', tokenCount: 12000, tokenSamples: [], contextWindowSize: 200000 }

function engine(on: any, agents: unknown[] = [], evidence: unknown[] = [], files: Record<string, string> = FILES) {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('env.get', () => ({ value: '/home' }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: { id: 't' } }))
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
  expect(await ui.find({ type: 'Text', text: /HANDOVERS/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Research sidebar UI/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /h hud/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /DONE GATE/ })).toBeTruthy()
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
