import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Critique, ExecRow, Gate, HoldMode, Hop, Snapshot } from '../types'

// Sprint v3 mod: an animated sidebar pane, a live status-line row and /sprint, /sprint-status.
// It reads and drives the sprint; the gates themselves live in scripts/hooks/sprint-gate.js (global hooks).

const PANE = 'sprint'
const NAMES = ['discover', 'backend', 'frontend', 'polish', 'audit', 'launch']
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPRINT_REPO = 'V:/Projects/sprint'

const snap = atom({ plugin: 'sprint-mod', key: 'snap' } as const, null, { shape: 'snap-3' })
const frame = atom({ plugin: 'sprint-mod', key: 'frame' } as const, 0)
const note = atom({ plugin: 'sprint-mod', key: 'note' } as const, '')
const compact = atom({ plugin: 'sprint-mod', key: 'compact' } as const, false)
// The sprint (its startedAt) whose keepwarm window this mod armed; 0 when it armed none.
// Side-agent critiques caught mid-sprint, waiting for a ponytail-review pass.
const critiques = atom({ plugin: 'sprint-mod', key: 'critiques' } as const, [] as Critique[])
// sprint: a note sent to the chat during a sprint is queued, not answered. always: queued any time. off: sent on.
const hold = atom({ plugin: 'sprint-mod', key: 'hold' } as const, 'sprint' as HoldMode)
const NOTE_RE = /^\s*Here is a note offered by a side agent/i
// The note's bold title line, else its first line, as the card shows it.
export function critiqueTitle(text: string): string {
  const bold = /\*\*([^*]{4,120})\*\*/.exec(text)
  const first = text.split('\n').map(l => l.replace(/^[>\s]+/, '').trim()).find(l => l && !NOTE_RE.test(l)) ?? ''
  return (bold ? bold[1] : first).slice(0, 120)
}
export function ponytailPrompt(list: Critique[]): string {
  return [
    `Review these ${list.length} side-agent critiques with the ponytail-review skill, against the current code.`,
    'For each one: find the concrete case in the code (file:line, the input that goes wrong) or reject it with the reason. No case, no fix.',
    'Fix only the confirmed ones, with the smallest change; add a focused test where the fix is risky. Then run /verify.',
    'End with a table: critique, confirmed or rejected, why, fix.',
    '',
    ...list.map((c, i) => `${i + 1}. ${c.title}\n${c.text.slice(0, 1500)}`),
  ].join('\n')
}

const keepArmed = atom({ plugin: 'sprint-mod', key: 'keepArmed' } as const, 0)

// Catppuccin Mocha, the palette prismantis defaults to, so the two mods match.
const C = { mauve: '#cba6f7', blue: '#89b4fa', sky: '#89dceb', green: '#a6e3a1', yellow: '#f9e2af', peach: '#fab387', red: '#f38ba8', text: '#cdd6f4', overlay: '#6c7086', crust: '#11111b' }

type $T = Parameters<Parameters<Register>[0]>[2] extends (...a: infer A) => unknown ? A[0] : never
type Health = { executors?: Record<string, { state?: string; until?: string | null; reason?: string; runs?: { ts: string; outcome: string }[] }> }
type State = { active?: boolean; phase?: number; startedAt?: string; skillsLoaded?: string[] }
type Config = { timeBudgetMinutes?: number; phases?: Record<string, { budgetMin?: number }> }

async function readJson<T>($: $T, path: string): Promise<T | null> {
  try { return JSON.parse(await $.fs.read(path)) as T } catch { return null }
}
async function home($: $T): Promise<string> {
  return ((await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || '~').replace(/\\/g, '/')
}

function execRows(h: Health, now: number): ExecRow[] {
  return Object.entries(h.executors ?? {}).map(([key, e]) => {
    const untilMs = e.until ? Date.parse(e.until) : 0
    const runs = (e.runs ?? []).slice(-5)
    const last = runs.length ? Date.parse(runs[runs.length - 1].ts) : now
    const tripped = e.state === 'tripped' && untilMs > now
    return { key, state: tripped ? 'tripped' : runs.length ? 'ok' : 'new', reason: e.reason ?? '', untilMs, sinceMs: last, runs: runs.map(r => r.outcome) }
  })
}

async function readHops($: $T, file: string): Promise<Hop[]> {
  try {
    const lines = (await $.fs.read(file)).trim().split('\n').slice(-8).reverse()
    return lines.flatMap(l => {
      try { const j = JSON.parse(l); return [{ ts: j.ts, to: String(j.to ?? ''), model: String(j.model ?? ''), outcome: String(j.outcome ?? ''), durS: j.durS ?? null }] } catch { return [] }
    })
  } catch { return [] }
}

// Done gate (idea from codenotary/agentmon-live): uncommitted edits need a /verify evidence file newer than the last edit.
async function doneGate($: $T, root: string, now: number): Promise<Gate> {
  const st = await $.process.run(['git', 'status', '--porcelain', '-uall'], { cwd: root }).catch(() => null)
  const files = (st?.stdout ?? '').split(String.fromCharCode(10)).filter(Boolean).map(l => l.slice(3).replace(/"/g, '').split(' -> ').pop() as string)
  let lastEditMs = 0
  for (const f of files.slice(0, 25)) {
    const t = await $.fs.stat(`${root}/${f}`).catch(() => null)
    if (t && t.kind === 'file' && t.mtimeMs > lastEditMs && t.mtimeMs <= now) lastEditMs = t.mtimeMs
  }
  const dir = `${await home($)}/.claude/verify-evidence`, name = root.split('/').pop() ?? ''
  let verifiedMs = 0, evidence = ''
  for (const e of await $.fs.list(dir).catch(() => [])) {
    if (e.kind === 'file' && e.name.startsWith(`${name}-`) && /^\d{8}-\d{4}\.md$/.test(e.name.slice(name.length + 1)) && e.mtimeMs > verifiedMs) { verifiedMs = e.mtimeMs; evidence = e.name }
  }
  // The record must say it passed: a newer file alone is not proof. scripts/verify.mjs writes this line from exit codes.
  const head = evidence ? await $.fs.read(`${dir}/${evidence}`).catch(() => '') : ''
  const m = /^result:\s*(pass|fail)\b/im.exec(head.slice(0, 2000))
  const verdict: Gate['verdict'] = m ? (m[1].toLowerCase() as 'pass' | 'fail') : 'none'
  return { changed: files.length, lastEditMs, verifiedMs, evidence, verdict }
}

// Read every 5 s by refresh(), not on each 120 ms spinner frame.
let usageCache: Awaited<ReturnType<$T['session']['usage']>> | null = null
let agentsCache: Awaited<ReturnType<$T['agent']['list']>> = []

// Keepwarm automation over cache-tax (karanb192/cache-tax). cache-tax pings only after 50 idle minutes and caps
// each break's ping spend itself (its Ping floor option), so a window shorter than an hour does nothing.
type KeepStatus = { keepwarm: 'on' | 'stopped' | 'off'; leftMs: number; autoWarm: boolean; stopped: string | null; pingSkipped: boolean; idlePingUsd: number | null; cold: boolean | null }
let keepCache: KeepStatus | null = null
let lastPhase = -1
async function keepwarm($: $T, s: Snapshot): Promise<void> {
  // No $.cacheTax where cache-tax is not installed: the call throws and the gauge stays hidden.
  try { keepCache = await ($ as unknown as { cacheTax: { status: () => Promise<KeepStatus> } }).cacheTax.status() } catch { keepCache = null }
  if (!keepCache) return
  const act = keepAction(s, await read($, keepArmed), keepCache.keepwarm)
  if (!act) return
  await update($, keepArmed, () => act.armed) // first, so a failed run is not retried every 5 s
  if (act.args) await $.command.run({ command: 'keepwarm', args: act.args }).catch(() => null)
}

// Arm once per sprint for the minutes left (at least 60: a shorter window never pings), and switch off at the
// end only a window this mod armed. A window you armed yourself is never touched.
export function keepAction(s: Pick<Snapshot, 'active' | 'budgetMin' | 'startedAtMs' | 'readAtMs'>, armed: number, keep: 'on' | 'stopped' | 'off'): { armed: number; args: string | null } | null {
  const leftMin = Math.floor(s.budgetMin - (s.readAtMs - s.startedAtMs) / 60000)
  if (s.active && leftMin >= 60 && armed !== s.startedAtMs && keep !== 'on') return { armed: s.startedAtMs, args: `${leftMin}m` }
  if (armed !== 0 && (!s.active || leftMin <= 0)) return { armed: 0, args: keep === 'on' ? 'off' : null }
  return null
}

// The queue survives restarts: kept in $.store per repo, mirrored in session state for the pane.
const critKey = async ($: $T) => `critiques:${await $.session.cwd()}`
async function saveCritiques($: $T, fn: (l: Critique[]) => Critique[]): Promise<void> {
  const list = fn(await read($, critiques))
  await update($, critiques, () => list)
  await $.store.set(await critKey($), list).catch(() => null)
}

async function applyCritiques($: $T): Promise<string> {
  const open = (await read($, critiques)).filter(c => c.status === 'open')
  if (!open.length) return 'No open critiques.'
  await saveCritiques($, l => l.map(c => (c.status === 'open' ? { ...c, status: 'sent' as const } : c)))
  // Submitted on a timer: a prompt from inside a command.run hook would wait on the turn that hook holds.
  const text = ponytailPrompt(open)
  $.clock.after(50, () => $.prompt.submit({ text }))
  return `Sent ${open.length} critique${open.length > 1 ? 's' : ''} to ponytail-review.`
}

async function refresh($: $T): Promise<Snapshot> {
  const root = (await $.session.cwd()).replace(/\\/g, '/'), ab = `${await home($)}/.agent-bridge`, now = await $.clock.now()
  const st = (await readJson<State>($, `${root}/.sprint-state.json`)) ?? {}
  const cfg = (await readJson<Config>($, `${root}/sprint.config.json`)) ?? (await readJson<Config>($, `${SPRINT_REPO}/sprint.config.json`)) ?? {}
  const trees = await $.process.run(['git', 'worktree', 'list', '--porcelain'], { cwd: root }).catch(() => null)
  const s: Snapshot = {
    active: !!st.active, phase: st.phase ?? 0, startedAtMs: st.startedAt ? Date.parse(st.startedAt) : now,
    budgetMin: cfg.timeBudgetMinutes ?? 300,
    phaseBudgets: [1, 2, 3, 4, 5, 6].map(n => cfg.phases?.[n]?.budgetMin ?? 0),
    skillsLoaded: st.skillsLoaded ?? [],
    execs: execRows((await readJson<Health>($, `${ab}/health.json`)) ?? {}, now),
    hops: await readHops($, `${ab}/telemetry.jsonl`),
    trees: (trees?.stdout ?? '').split(/\n\n/).filter(b => /refs\/heads\/route\//.test(b) && !/prunable/.test(b)).length,
    readAtMs: now,
    gate: await doneGate($, root, now),
  }
  usageCache = await $.session.usage().catch(() => null)
  agentsCache = await $.agent.list().catch(() => [])
  await keepwarm($, s).catch(() => null)
  // Held critiques get their ponytail pass at each phase boundary and when the sprint ends.
  if (lastPhase > 0 && (!s.active || s.phase > lastPhase)) await applyCritiques($).catch(() => null)
  lastPhase = s.active ? s.phase : 0
  await update($, snap, () => s)
  return s
}

// stale: edits after the newest record. fail / none: the record says fail, or has no result line.
export function gateState(g: Gate): 'clean' | 'stale' | 'fail' | 'none' | 'pass' {
  if (g.changed === 0) return 'clean'
  if (g.verifiedMs < g.lastEditMs) return 'stale'
  return g.verdict
}
const hhmm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const mins = (ms: number) => Math.max(0, Math.round(ms / 60000))
const tone = (o: string) => (o === 'ok' || o === 'advanced' ? 'success' : /quota|stall|breach|exhausted|fail|auth|blocked/.test(o) ? 'error' : 'warning')

async function run($: $T, argv: string[], cwd: string): Promise<string> {
  const r = await $.process.run(argv, { cwd }).catch(e => ({ exitCode: 1, stdout: '', stderr: String(e) }))
  return `${r.exitCode === 0 ? 'ok' : `exit ${r.exitCode}`}: ${(r.stdout || r.stderr).trim().split('\n').slice(-2).join(' ')}`.slice(0, 160)
}

// Effort routing for sprint delegation (idea from tommy5dollar/effort-router): each subagent gets the
// effort its job needs instead of inheriting the session's. An effort the caller set explicitly always wins.
type Effort = 'low' | 'medium' | 'high'
const EFFORT_BY_TYPE: Record<string, Effort> = {
  Explore: 'low', 'web-fetch': 'low', 'claude-code-guide': 'low', 'statusline-setup': 'low', launcher: 'low',
  'general-purpose': 'medium', builder: 'medium',
  discover: 'high', auditor: 'high', Plan: 'high', 'devil-advocate:advocate': 'high',
}
// Phase 2 (backend) holds the core science: builders there think harder.
function effortFor(type: string, phase: number): Effort | undefined {
  if (type === 'builder' && phase === 2) return 'high'
  return EFFORT_BY_TYPE[type]
}
const routedEffort = atom({ plugin: 'sprint-mod', key: 'effort' } as const, [] as string[])

export const register: Register = on => {
  // Catch side-agent notes sent to the chat. While held the note is queued and dropped, so Claude does not act on it
  // now and again in the ponytail pass; otherwise it goes on to Claude unchanged.
  on('prompt.submit', async ($, e, next) => {
    const isNote = e.origin?.kind === 'observer' || NOTE_RE.test(e.text)
    if (!isNote || !e.text.trim()) return next(e)
    const now = await $.clock.now()
    const text = e.text.slice(0, 4000)
    await saveCritiques($, l => (l.some(c => c.text === text) ? l : [...l, { id: `c${now}`, at: now, title: critiqueTitle(text), text, status: 'open' as const }].slice(-30)))
    const mode = await read($, hold), st = await read($, snap)
    if (mode === 'always' || (mode === 'sprint' && st?.active)) {
      return { drop: 'Queued for ponytail review, not sent to Claude. p in the sprint sidebar or /sprint-critiques apply reviews now; /sprint-critiques hold off sends notes straight through.' }
    }
    return next(e)
  })

  on('command.run', { command: 'sprint-critiques' }, async ($, e) => {
    const [sub, arg] = (e.args ?? '').trim().split(/\s+/)
    if (sub === 'apply') return { text: await applyCritiques($) }
    if (sub === 'clear') { await saveCritiques($, () => []); return { text: 'Critiques cleared.' } }
    if (sub === 'hold' && (arg === 'sprint' || arg === 'always' || arg === 'off')) await update($, hold, () => arg)
    const open = (await read($, critiques)).filter(c => c.status === 'open')
    const list = open.length ? open.map((c, i) => `${i + 1}. ${c.title}`).join('\n') + '\n\n/sprint-critiques apply  sends them through ponytail-review' : 'No open critiques.'
    return { text: `${list}\nHold: ${await read($, hold)}  (sprint | always | off: /sprint-critiques hold <mode>)` }
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.effort || e.subagent_type === 'fork') return next(e)
    const st = await read($, snap)
    if (!st?.active) return next(e) // only route effort during a sprint
    const level = effortFor(e.subagent_type ?? 'general-purpose', st?.active ? st.phase : 0)
    if (!level) return next(e)
    await update($, routedEffort, l => [...l, `${e.subagent_type ?? 'general-purpose'}→${level}`].slice(-20))
    return next({ ...e, effort: level })
  })

  // Router calls (ab-route.js) as one-line cards instead of a wall of JSON. ctrl+o still shows everything.
  const routeOf = (out: unknown) => {
    const txt = typeof out === 'object' && out ? String((out as { stdout?: unknown }).stdout ?? '') : ''
    const at = txt.indexOf('{'), end = txt.lastIndexOf('}')
    if (at < 0 || !txt.includes('"attempts"')) return null
    try { return JSON.parse(txt.slice(at, end + 1)) as { outcome?: string; class?: string; attempts?: { executor: string; outcome?: string; skipped?: string; log?: string }[] } } catch { return null }
  }
  const isRoute = (input: unknown) => /ab-route\.js/.test(String((input as { command?: unknown })?.command ?? '')) && !/--(status|reset)/.test(String((input as { command?: unknown })?.command ?? ''))
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || !isRoute(e.props.input) || e.props.isExpanded) return next(e)
    const { Text } = $.ui.resolve(e)
    const cls = (/--class\s+(\w+)/.exec(String((e.props.input as { command: string }).command)) ?? [])[1] ?? '?'
    if (e.props.isRunning) return <Text><Text color={C.peach}>⇄ route</Text> <Text bold>{cls}</Text> <Text color={C.overlay}>running…</Text></Text>
    const r = routeOf(e.props.output)
    if (!r) return next(e)
    const ok = (r.attempts ?? []).find(a => a.outcome === 'ok')
    return (
      <Text>
        <Text color={C.peach}>⇄ route</Text> <Text bold>{cls}</Text> <Text color={C.overlay}>→</Text>{' '}
        {(r.attempts ?? []).map((a, i) => (
          <Text key={String(i)} color={a.outcome === 'ok' ? C.green : a.skipped ? C.overlay : C.red}>{a.executor.replace('opencode:free:', '').replace('antigravity:', 'agy:')} {a.outcome ?? 'skip'}{i < (r.attempts ?? []).length - 1 ? ' · ' : ''}</Text>
        ))}
        {!ok && <Text color={C.red}> · do it with Claude</Text>}
      </Text>
    )
  })
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isExpanded) return next(e)
    const r = routeOf(e.props.output)
    if (!r) return next(e)
    const { Text } = $.ui.resolve(e)
    const log = (r.attempts ?? []).map(a => a.log).filter(Boolean).pop()
    return <Text color={C.overlay}>  {log ? `log ${log}` : 'no log'} · ctrl+o for full output</Text>
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sprint', description: 'Open the sprint sidebar (phases, handovers, executors)' })
    await $.command.register({ name: 'sprint-critiques', description: 'Side-agent critiques: list, apply (ponytail-review pass) or clear' })
    await $.command.register({ name: 'sprint-status', description: 'Sprint status as text (no model call)' })
    const saved = await $.store.get(await critKey($)).catch(() => null)
    if (Array.isArray(saved) && !(await read($, critiques)).length) await update($, critiques, () => saved as Critique[])
    const s = await refresh($)
    // Frame clock: spinner + countdowns tick every 120 ms; data re-reads every 5 s.
    let ticks = 0
    $.clock.every(120, async () => {
      ticks++
      await update($, frame, f => (f + 1) % SPIN.length)
      if (ticks % 40 === 0) await refresh($)
    })
    const root = (await $.session.cwd()).replace(/\\/g, '/')
    if (s.active || root === SPRINT_REPO) void $.ui.open({ id: PANE, title: 'Sprint', columns: 42 })
    return next(e)
  })

  on('command.run', { command: 'sprint' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Sprint', focus: true, columns: 42 })
    return { text: 'Sprint sidebar opened.' }
  })

  on('command.run', { command: 'sprint-status' }, async $ => {
    const s = await refresh($)
    const tripped = s.execs.filter(x => x.state === 'tripped').map(x => x.key)
    return {
      text: [
        s.active ? `Phase ${s.phase}/6 (${NAMES[s.phase - 1]}) · ${mins(s.budgetMin * 60000 - (s.readAtMs - s.startedAtMs))} min left` : 'No active sprint.',
        `Skills loaded: ${s.skillsLoaded.join(', ') || 'none'}`,
        `Router worktrees on this repo: ${s.trees}`,
        `Tripped executors: ${tripped.join(', ') || 'none'}`,
      ].join('\n'),
    }
  })

  // Status line: keep the user's own status line, add one live sprint row under it.
  on('ui.render', { component: 'StatusLine' }, async ($, e, next) => {
    const s = await read($, snap)
    const base = await next(e)
    if (!s || e.props.maxRows < 1) return base
    const { Box, Text } = $.ui.resolve(e)
    const f = await read($, frame), now = s.readAtMs
    const tripped = s.execs.filter(x => x.state === 'tripped').length
    const left = mins(s.budgetMin * 60000 - (now - s.startedAtMs))
    return (
      <Box flexDirection="column">
        {base}
        <Box>
          <Text color={s.active ? 'claude' : 'subtle'}>{s.active ? SPIN[f] : '○'} </Text>
          <Text weight="bold">{s.active ? `Sprint P${s.phase}/6 ${NAMES[s.phase - 1]}` : 'Sprint idle'}</Text>
          {s.active && <Text color={left < 30 ? 'error' : 'subtle'}> · {left}m left</Text>}
          <Text color={tripped ? 'warning' : 'success'}> · {tripped ? `${tripped} tripped` : 'router ok'}</Text>
          {s.trees > 0 && <Text color="warning"> · {s.trees} worktree live</Text>}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, snap)
    if (!s) return <Text dimColor>Reading sprint state…</Text>
    const f = await read($, frame), msg = await read($, note), now = s.readAtMs
    const root = (await $.session.cwd()).split(String.fromCharCode(92)).join('/')
    const u = usageCache
    const crit = await read($, critiques)
    const holdMode = await read($, hold), held = holdMode === 'always' || (holdMode === 'sprint' && s.active)
    const W = Math.max(20, e.props.bodyColumns)
    const small = (await read($, compact)) || W < 30
    const agents = [...agentsCache].sort((x, y) => y.startTime - x.startTime)
    const live = agents.filter(a => /running|pending|waiting/.test(a.status))
    const elapsedMin = (now - s.startedAtMs) / 60000
    const short = (k: string) => k.replace('opencode:free:', '').replace('antigravity:', '').replace('freellmapi/', '')
    const cut = (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t)
    const groups: [string, string, ExecRow[]][] = [
      ['ANTIGRAVITY', C.mauve, s.execs.filter(x => x.key.startsWith('antigravity'))],
      ['OPENCODE', C.sky, s.execs.filter(x => x.key.startsWith('opencode'))],
    ]
    const inner = W - 4
    const room = Math.max(6, Math.min(20, inner - 16))
    const bar = (part: number, color: string) => {
      const p = Math.max(0, Math.min(1, part)), n = Math.round(p * room)
      return <Text><Text dimColor>▕</Text><Text color={color}>{'█'.repeat(n)}</Text><Text dimColor>{'░'.repeat(room - n)}▏</Text></Text>
    }
    const pctColor = (p: number) => (p > 0.85 ? C.red : p > 0.6 ? C.yellow : C.green)
    const chip = (label: string, color: string) => <Text backgroundColor={color} color={C.crust} bold>{` ${label} `}</Text>
    const title = (label: string, color: string, right?: string) => (
      <Box key="title" justifyContent="space-between"><Text color={color} bold>● {label}</Text>{right ? <Text dimColor>{right}</Text> : null}</Box>
    )
    const card = (key: string, color: string, kids: unknown[]) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>{kids}</Box>
    )
    const phaseName = s.active ? NAMES[s.phase - 1] : ''
    const skillOk = s.skillsLoaded.some(x => x.endsWith(`phase-${phaseName}`))

    const header = (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text><Text bold>SPRINT</Text><Text dimColor> · </Text><Text color={C.peach} bold>{s.active ? `P${s.phase}/6 ${phaseName.toUpperCase()}` : 'IDLE'}</Text></Text>
          <Button key="compact" label={small ? '⤢' : '⤡'} hotkey="c" onPress={async () => { await update($, compact, v => !v) }} />
        </Box>
        {s.active && (
          <Text>
            {NAMES.map((n, i) => <Text key={n} color={i + 1 < s.phase ? C.green : i + 1 === s.phase ? C.peach : C.overlay}>{i + 1 < s.phase ? '━━' : i + 1 === s.phase ? `${SPIN[f]}━` : '──'}</Text>)}
            <Text dimColor> {Math.round(elapsedMin)}/{s.budgetMin}m</Text>
          </Text>
        )}
        <Text dimColor>{cut(root.split('/').pop() || root, inner)}{s.active && !skillOk ? ' · load phase skill' : ''}</Text>
      </Box>
    )

    if (small) {
      const ctx = u ? (u.context.tokens ?? 0) / u.context.window : 0
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {u && <Text><Text dimColor>ctx </Text>{bar(ctx, pctColor(ctx))} {Math.round(ctx * 100)}%</Text>}
          {groups.map(([g, c, rows]) => <Text key={g}><Text color={c}>● </Text>{g.toLowerCase()} <Text color={rows.some(x => x.state === 'tripped') ? C.red : C.green}>{rows.filter(x => x.state !== 'tripped').length}/{rows.length}</Text></Text>)}
          <Text><Text color={['clean', 'pass'].includes(gateState(s.gate)) ? C.green : C.red}>● </Text>gate {({ clean: 'clean', pass: 'ok', stale: 'not verified', fail: 'checks failed', none: 'no result' })[gateState(s.gate)]}</Text>
          <Text><Text color={C.blue}>● </Text>agents <Text color={live.length ? C.sky : C.overlay}>{live.length} running</Text></Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}

        {(() => {
          const g = s.gate, st = gateState(g), ok = st === 'clean' || st === 'pass'
          const clock = (ms: number) => hhmm(ms)
          const label = { clean: 'CLEAN', pass: 'VERIFIED', stale: 'NOT VERIFIED', fail: 'CHECKS FAILED', none: 'NO RESULT' }[st]
          const detail = st === 'stale' ? `edit ${clock(g.lastEditMs)}${g.verifiedMs ? ` · verify ${clock(g.verifiedMs)}` : ' · never'}` : g.verifiedMs ? `verify ${clock(g.verifiedMs)}` : ''
          const hint = { stale: 'run /verify before claiming done', fail: 'newest /verify record says result: fail', none: 'record has no result: line · rerun /verify', clean: '', pass: '' }[st]
          return card('gate', ok ? C.green : C.red, [
            title('DONE GATE', ok ? C.green : C.red, g.changed ? `${g.changed} changed` : 'clean'),
            <Text key="g1">{chip(label, ok ? C.green : C.red)} <Text color={C.overlay}>{detail}</Text></Text>,
            ...(hint ? [<Text key="g2" color={C.overlay}>{cut(hint, inner)}</Text>] : []),
          ])
        })()}

        {(() => {
          const open = crit.filter(c => c.status === 'open'), sent = crit.length - open.length
          if (!crit.length) return null
          return card('crit', open.length ? C.yellow : C.overlay, [
            title('CRITIQUES', open.length ? C.yellow : C.overlay, `${open.length} open${sent ? ` · ${sent} sent` : ''}`),
            ...open.slice(-4).map(c => <Text key={c.id}><Text color={C.yellow}>▸ </Text>{cut(c.title, inner - 2)}</Text>),
            ...(held ? [<Text key="held" color={C.overlay}>{cut('held: sent notes queue here · reviewed at phase end', inner)}</Text>] : []),
            ...(open.length ? [<Button key="apply" label="Review with ponytail" hotkey="p" onPress={async () => { const out = await applyCritiques($); await update($, note, () => out) }} />] : []),
          ])
        })()}

        {u && card('usage', C.text, [
          title('USAGE', C.text, u.cost ? `$${u.cost.usd.toFixed(2)}` : undefined),
          <Text key="ctx"><Text dimColor>{'context'.padEnd(8)}</Text>{bar((u.context.tokens ?? 0) / u.context.window, pctColor((u.context.tokens ?? 0) / u.context.window))} {Math.round((u.context.tokens ?? 0) / 1000)}k</Text>,
          ...u.rateLimits.slice(0, 2).map(r => (
            <Text key={r.kind}><Text dimColor>{cut(r.kind, 7).padEnd(8)}</Text>{bar(r.percentUsed / 100, pctColor(r.percentUsed / 100))} {Math.round(r.percentUsed)}%</Text>
          )),
          ...(keepCache ? [(() => {
            const k = keepCache, hm = (ms: number) => `${Math.floor(ms / 3600000)}h${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}m`
            const spent = k.idlePingUsd != null ? ` · $${k.idlePingUsd.toFixed(2)} this break` : ''
            return (
              <Text key="kw"><Text dimColor>{'warm'.padEnd(8)}</Text>{k.pingSkipped
                ? <Text color={C.red}>budget hit · pings paused{spent}</Text>
                : k.keepwarm === 'on' ? <Text color={C.green}>on · {hm(k.leftMs)} left{spent}</Text>
                : k.keepwarm === 'stopped' ? <Text color={C.yellow}>stopped · {cut(k.stopped ?? '', Math.max(8, inner - 20))}</Text>
                : <Text color={C.overlay}>off{k.cold ? ' · cache cold' : ''}</Text>}{k.autoWarm ? <Text color={C.yellow}> · auto-arm on</Text> : null}</Text>
            )
          })()] : []),
        ])}

        {agents.length > 0 && card('agents', live.length ? C.sky : C.blue, [
          title('SUBAGENTS', live.length ? C.sky : C.blue, `${live.length} running`),
          ...agents.slice(0, 4).map(a => {
            const isLive = /running|pending|waiting/.test(a.status), bad = /failed|killed/.test(a.status)
            const frac = a.contextWindowSize ? a.tokenCount / a.contextWindowSize : 0
            return (
              <Box key={a.id} flexDirection="column">
                <Text>{chip(isLive ? 'LIVE' : bad ? 'FAIL' : 'DONE', isLive ? C.sky : bad ? C.red : C.green)} <Text bold>{cut(a.name || a.type, inner - 8)}</Text></Text>
                <Text dimColor>{cut(a.description || a.label, inner)}</Text>
                <Text>{bar(frac, isLive ? C.sky : C.blue)} <Text dimColor>{Math.round(a.tokenCount / 1000)}k{a.effort ? ` · ${a.effort}` : ''}{a.model ? ` · ${cut(a.model, 10)}` : ''}</Text></Text>
              </Box>
            )
          }),
        ])}

        {groups.map(([g, c, rows]) => card(g, rows.some(x => x.state === 'tripped') ? C.red : c, [
          title(g, c, rows.length ? `${rows.filter(x => x.state !== 'tripped').length}/${rows.length} ready` : 'unused'),
          ...rows.map(x => {
            const tripped = x.state === 'tripped'
            return (
              <Box key={x.key} justifyContent="space-between">
                <Text><Text color={tripped ? C.red : x.state === 'ok' ? C.green : C.overlay}>{tripped ? '✕' : '●'} </Text>{cut(short(x.key), inner - 12)}</Text>
                {tripped
                  ? <Button key={`reset-${x.key}`} label={`${x.reason} ${mins(x.untilMs - now)}m ↺`}
                      onPress={async () => { const out = await run($, ['node', `${await home($)}/.claude/bin/ab-route.js`, '--reset', x.key], root); await update($, note, () => out); await refresh($) }} />
                  : <Text>{x.runs.length ? x.runs.map((r, i) => <Text key={String(i)} color={r === 'ok' ? C.green : C.red}>▮</Text>) : <Text dimColor>idle</Text>}</Text>}
              </Box>
            )
          }),
        ]))}

        {card('hops', C.overlay, [
          title('HANDOVERS', C.overlay, s.trees ? `${s.trees} worktree live` : undefined),
          ...(s.hops.length === 0 ? [<Text key="none" dimColor>none yet</Text>] : s.hops.slice(0, 5).map((hop, i) => (
            <Box key={`${hop.ts}-${i}`} justifyContent="space-between">
              <Text><Text dimColor>{hhmm(hop.ts)} </Text><Text color={hop.to.startsWith('antigravity') ? C.mauve : C.sky}>{cut(short(hop.to + (hop.model ? `:${hop.model}` : '')), inner - 18)}</Text></Text>
              <Text color={tone(hop.outcome) === 'success' ? C.green : tone(hop.outcome) === 'error' ? C.red : C.yellow}>{hop.outcome}{hop.durS != null ? ` ${hop.durS}s` : ''}</Text>
            </Box>
          ))),
        ])}

        <Box gap={1}>
          <Button key="hud" label="HUD" hotkey="h"
            onPress={async () => { const out = await run($, ['node', `${await home($)}/.claude/bin/ab-route.js`, '--status'], root); const h0 = await home($); await update($, note, () => (out.startsWith('ok') ? `status.html updated · ${h0}/.agent-bridge/status.html` : out)) }} />
          <Button key="refresh" label="Refresh" hotkey="r" onPress={async () => { await refresh($); await update($, note, () => 'refreshed') }} />
          {s.active && (
            <Button key="advance" label="Advance" hotkey="a"
              onPress={async () => { const out = await run($, ['node', `${SPRINT_REPO}/scripts/hooks/sprint-gate.js`, 'advance'], root); await update($, note, () => out); await refresh($) }} />
          )}
        </Box>
        <Text dimColor>c compact · r refresh · h hud · p ponytail{s.active ? ' · a advance' : ''}{msg ? ` · ${cut(msg, Math.max(8, inner - 30))}` : ''}</Text>
      </Box>
    )
  })
}
