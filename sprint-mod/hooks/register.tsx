import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Critique, ExecRow, Gate, HoldMode, Snapshot } from '../types'

// Sprint v3 mod: an animated sidebar pane, a live status-line row and /sprint, /sprint-status.
// It reads and drives the sprint; the gates themselves live in scripts/hooks/sprint-gate.js (global hooks).

const PANE = 'sprint'
const AGENTS = 'sprint-agents'
const NAMES = ['discover', 'backend', 'frontend', 'polish', 'audit', 'launch']
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPRINT_REPO = 'V:/Projects/sprint'

const snap = atom({ plugin: 'sprint-mod', key: 'snap' } as const, null, { shape: 'snap-4' })
const frame = atom({ plugin: 'sprint-mod', key: 'frame' } as const, 0)
const note = atom({ plugin: 'sprint-mod', key: 'note' } as const, '')
const compact = atom({ plugin: 'sprint-mod', key: 'compact' } as const, false)
// Side-agent critiques caught mid-sprint, waiting for a ponytail-review pass.
const critiques = atom({ plugin: 'sprint-mod', key: 'critiques' } as const, [] as Critique[])
// sprint: a note sent to the chat during a sprint is queued, not answered. always: queued any time. off: sent on.
const hold = atom({ plugin: 'sprint-mod', key: 'hold' } as const, 'sprint' as HoldMode)
const NOTE_RE = /^\s*Here is a note offered by a side agent/i
// A warning about something about to happen skips the hold: it reaches Claude now and is still listed.
// Words you typed under a forwarded note (any line outside its "> " quote): your question must reach Claude now.
export const hasOwnWords = (text: string) => text.split('\n').slice(1).some(l => l.trim() !== '' && !l.trimStart().startsWith('>'))
export const isUrgent = (text: string) => /\b(about to|is going to|will (delete|overwrite|push|install|drop|remove|deploy)|irreversible|data loss|destructive|secrets?|credentials?|leak|security|stop|right now|immediately|before you)\b/i.test(text)
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

// The sprint (its startedAt) whose keepwarm window this mod armed; 0 when it armed none.
const keepArmed = atom({ plugin: 'sprint-mod', key: 'keepArmed' } as const, 0)

// Catppuccin Mocha, the palette prismantis defaults to, so the two mods match.
const C = { mauve: '#cba6f7', blue: '#89b4fa', sky: '#89dceb', green: '#a6e3a1', yellow: '#f9e2af', peach: '#fab387', red: '#f38ba8', text: '#cdd6f4', overlay: '#6c7086', sub: '#a6adc8', track: '#45475a', crust: '#11111b' }

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

// ---- Delegation view: router jobs, what each subagent is doing, worktrees, model usage, /btw answers ----
type Job = { id: string; to: string; model: string; task: string; log: string; tree: string | null; state: string; startMs: number; durS: number | null; progress?: string; summary?: string; conv?: string }
type TreeRow = { path: string; branch: string; prunable: boolean; changed: number }
type UsageDoc = { agy: { model: string; gens: number; in: number; out: number }[]; agyRuns?: Record<string, { gens: number; in: number; out: number }>; agyQuota?: { pool: string; window: string; remaining: number; reset: string }[] | null; deepseek: { steps: number; in: number; out: number } | null }
let jobs: Job[] = []
let treeRows: TreeRow[] = []
let modelUsage: UsageDoc | null = null
let usageError = ''
const activity = new Map<string, { at: number; tool: string; brief: string }[]>()
const btwAnswers = new Map<string, string>()

// One line for a tool call: the command, the file, the pattern.
export function briefOf(i: Record<string, unknown>): string {
  const s = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : '')
  const t = String(i.tool)
  if (t === 'Bash') return s('command').split('\n')[0]
  if (['Read', 'Edit', 'Write', 'NotebookEdit'].includes(t)) return (s('file_path') || s('notebook_path')).split(/[\\/]/).pop() ?? ''
  if (t === 'Grep' || t === 'Glob') return s('pattern')
  if (t === 'WebFetch') return s('url').replace(/^https?:\/\//, '').split('/')[0]
  if (t === 'WebSearch') return s('query')
  if (t === 'Agent') return s('subagent_type') || s('description')
  return ''
}

// Router jobs from telemetry: a start record (task, log, worktree), then the outcome once it ends.
export function parseJobs(lines: string[], now: number): Job[] {
  const byId = new Map<string, Job>()
  for (const l of lines) {
    let t: { ts?: string; taskId?: string; to?: string; model?: string; outcome?: string; durS?: number | null; task?: string; log?: string; worktree?: string | null }
    try { t = JSON.parse(l) } catch { continue }
    if (!t.taskId || !t.to || t.to === 'router' || !t.ts) continue
    const id = `${t.taskId}|${t.to}|${t.model ?? ''}`, prev = byId.get(id)
    const base: Job = prev ?? { id, to: t.to, model: t.model ?? '', task: t.task ?? '', log: t.log ?? '', tree: t.worktree ?? null, state: 'running', startMs: Date.parse(t.ts), durS: null }
    byId.set(id, t.outcome === 'started' ? base : { ...base, state: t.outcome ?? '?', durS: t.durS ?? null })
  }
  // A start with no end after 30 minutes is a router that died mid-run.
  return [...byId.values()].map(j => (j.state === 'running' && now - j.startMs > 30 * 60000 ? { ...j, state: 'lost' } : j)).sort((a, b) => b.startMs - a.startMs).slice(0, 5)
}

// `git worktree list --porcelain`, without the main checkout.
export function parseTrees(porcelain: string): Omit<TreeRow, 'changed'>[] {
  return porcelain.split(/\n\n/).slice(1).map(b => ({
    path: /^worktree (.+)$/m.exec(b)?.[1]?.trim() ?? '',
    branch: /^branch refs\/heads\/(.+)$/m.exec(b)?.[1]?.trim() ?? '(detached)',
    prunable: /^prunable/m.test(b),
  })).filter(t => t.path)
}

async function refreshDelegation($: $T, ab: string, now: number, porcelain: string): Promise<void> {
  const list = parseJobs((await $.fs.read(`${ab}/telemetry.jsonl`).catch(() => '')).trim().split('\n').slice(-80), now)
  for (const j of list) {
    if (j.to !== 'antigravity' || !j.log) continue
    // agy runs through agent-bridge: its task folder names the agy conversation, and its status file the progress.
    const tid = /← task (\S+)/.exec((await $.fs.read(j.log).catch(() => '')).slice(0, 800))?.[1]
    if (!tid) continue
    j.conv = /"conversationId"\s*:\s*"([^"]+)"/.exec(await $.fs.read(`${ab}/tasks/${tid}/telemetry.json`).catch(() => ''))?.[1]
    if (j.state !== 'running') continue
    const st = await $.fs.read(`${ab}/tasks/${tid}/status.md`).catch(() => '')
    j.progress = /^progress:\s*(.*)$/m.exec(st)?.[1]?.trim()
    j.summary = /^summary:\s*(.*)$/m.exec(st)?.[1]?.trim()
  }
  jobs = list
  treeRows = await Promise.all(parseTrees(porcelain).slice(0, 6).map(async t => {
    const r = t.prunable ? null : await $.process.run(['git', 'status', '--porcelain'], { cwd: t.path }).catch(() => null)
    return { ...t, changed: (r?.stdout ?? '').split('\n').filter(Boolean).length }
  }))
}

// agy and DeepSeek v4.1 Flash usage today, from ~/.claude/bin/ab-usage.js (about a second: polled every minute).
async function refreshUsage($: $T): Promise<void> {
  const r = await $.process.run(['node', `${await home($)}/.claude/bin/ab-usage.js`]).catch((err: unknown) => ({ exitCode: 1, stdout: '', stderr: String(err) }))
  try {
    if (r.exitCode !== 0) throw new Error(r.stderr.trim().split('\n').pop() || `exit ${r.exitCode}`)
    modelUsage = JSON.parse(r.stdout) as UsageDoc
    usageError = ''
  } catch (err) { usageError = String(err instanceof Error ? err.message : err).slice(0, 120) }
}

// /btw for one agent: a cheap side question about it, answered from what it did. The agent is never touched.
const BTW_ASK = 'In at most two short lines: what is it doing right now, and does it look on track, stuck or looping?'
async function btwAgent($: $T, a: { id: string; type: string; description: string; label: string }): Promise<void> {
  const acts = (activity.get(a.id) ?? []).map(x => `- ${hhmm(x.at)} ${x.tool} ${x.brief}`.trimEnd()).join('\n') || '- no tool calls seen yet'
  btwAnswers.set(a.id, '… asking haiku')
  const r = await $.model.complete({ model: 'haiku', maxTokens: 160, prompt: `A coding subagent (${a.type}) is working on: ${a.description || a.label}\nIts tool calls so far, oldest first:\n${acts}\n\n${BTW_ASK}` }).catch(() => null)
  btwAnswers.set(a.id, r && r.isAnswered ? r.text.trim() : 'no answer')
}
async function btwJob($: $T, j: Job): Promise<void> {
  const log = (j.log ? await $.fs.read(j.log).catch(() => '') : '').replace(/\x1b\[[0-9;]*m/g, '')
  btwAnswers.set(j.id, '… asking haiku')
  const state = `${j.state}${j.progress ? `, ${j.progress}% done` : ''}${j.summary ? `, "${j.summary}"` : ''}`
  const r = await $.model.complete({ model: 'haiku', maxTokens: 160, prompt: `A delegated coding job runs on ${j.to}${j.model ? ` (${j.model})` : ''}.\nIts task: ${j.task || 'unknown'}\nState: ${state}\nThe end of its log:\n${log.split('\n').slice(-40).join('\n').slice(-4000) || '(empty)'}\n\n${BTW_ASK}` }).catch(() => null)
  btwAnswers.set(j.id, r && r.isAnswered ? r.text.trim() : 'no answer')
}

// The card kit both panes draw with.
type UI = ReturnType<$T['ui']['resolve']>
function kit(ui: UI, inner: number) {
  const { Box, Text } = ui
  const room = Math.max(6, Math.min(20, inner - 16))
  return {
    short: (k: string) => k.replace('opencode:free:', '').replace('antigravity:', '').replace('freellmapi/', ''),
    cut: (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t),
    tok: (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)),
    bar: (part: number, color: string) => {
      const p = Math.max(0, Math.min(1, part)), n = Math.round(p * room)
      return <Text><Text color={C.track}>▕</Text><Text color={color}>{'█'.repeat(n)}</Text><Text color={C.track}>{'░'.repeat(room - n)}▏</Text></Text>
    },
    chip: (label: string, color: string) => <Text backgroundColor={color} color={C.crust} bold>{` ${label} `}</Text>,
    title: (label: string, color: string, right?: string) => (
      <Box key="title" flexDirection="column">
        <Box justifyContent="space-between"><Text color={color} bold>● {label}</Text>{right ? <Text color={C.sub}>{right}</Text> : null}</Box>
        <Text color={C.track}>{'─'.repeat(inner)}</Text>
      </Box>
    ),
    card: (key: string, color: string, kids: unknown[]) => (color === C.red || color === C.yellow
      ? <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>{kids}</Box>
      : <Box key={key} flexDirection="column">{kids}</Box>),
    // Footer hints: the key in the accent colour, its action in plain secondary text.
    keys: (pairs: [string, string][], tail?: string) => {
      const rows: [string, string][][] = [[]]
      let width = 0
      for (const pr of pairs) {
        const w = pr[0].length + pr[1].length + 4
        if (width + w > inner && rows[rows.length - 1].length) { rows.push([]); width = 0 }
        rows[rows.length - 1].push(pr); width += w
      }
      return (
        <Box key="keys" flexDirection="column">
          {rows.map((row, r) => (
            <Text key={String(r)}>{row.map(([k, label], i) => <Text key={k}>{i ? <Text color={C.track}> · </Text> : null}<Text color={C.peach} bold>{k}</Text><Text color={C.sub}> {label}</Text></Text>)}</Text>
          ))}
          {tail ? <Text color={C.sub}>{tail}</Text> : null}
        </Box>
      )
    },
  }
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
    trees: (trees?.stdout ?? '').split(/\n\n/).filter(b => /refs\/heads\/route\//.test(b) && !/prunable/.test(b)).length,
    readAtMs: now,
    gate: await doneGate($, root, now),
  }
  usageCache = await $.session.usage().catch(() => null)
  agentsCache = await $.agent.list().catch(() => [])
  await refreshDelegation($, ab, now, trees?.stdout ?? '').catch(() => null)
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
  // What each subagent is doing, live: its tool calls as they pass. Read-only; every call goes on unchanged.
  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const list = activity.get(e.agentId) ?? []
      activity.set(e.agentId, [...list, { at: await $.clock.now(), tool: e.tool, brief: briefOf(e as unknown as Record<string, unknown>) }].slice(-15))
    }
    return next(e)
  })

  // Catch side-agent notes sent to the chat. While held the note is queued and dropped, so Claude does not act on it
  // now and again in the ponytail pass; otherwise it goes on to Claude unchanged.
  on('prompt.submit', async ($, e, next) => {
    const isNote = e.origin?.kind === 'observer' || NOTE_RE.test(e.text)
    if (!isNote || !e.text.trim()) return next(e)
    const now = await $.clock.now()
    const text = e.text.slice(0, 4000)
    const mode = await read($, hold), st = await read($, snap)
    const held = !isUrgent(text) && !hasOwnWords(text) && (mode === 'always' || (mode === 'sprint' && !!st?.active))
    await saveCritiques($, l => (l.some(c => c.text === text) ? l : [...l, { id: `c${now}`, at: now, title: critiqueTitle(text), text, status: held ? 'open' as const : 'sent' as const }].slice(-30)))
    if (held) {
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
  const isRoute = (input: unknown) => /ab-route\.js/.test(String((input as { command?: unknown })?.command ?? '')) && !/--(status|reset)\b/.test(String((input as { command?: unknown })?.command ?? ''))
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || !isRoute(e.props.input) || e.props.isExpanded) return next(e)
    const { Text } = $.ui.resolve(e)
    const cls = (/--class\s+(\w+)/.exec(String((e.props.input as { command: string }).command)) ?? [])[1] ?? '?'
    if (e.props.isRunning) return <Text><Text color={C.peach}>⇄ route</Text> <Text bold>{cls}</Text> <Text color={C.sub}>running…</Text></Text>
    const r = routeOf(e.props.output)
    if (!r) return next(e)
    const ok = (r.attempts ?? []).find(a => a.outcome === 'ok')
    return (
      <Text>
        <Text color={C.peach}>⇄ route</Text> <Text bold>{cls}</Text> <Text color={C.sub}>→</Text>{' '}
        {(r.attempts ?? []).map((a, i) => (
          <Text key={String(i)} color={a.outcome === 'ok' ? C.green : a.skipped ? C.sub : C.red}>{a.executor.replace('opencode:free:', '').replace('antigravity:', 'agy:')} {a.outcome ?? 'skip'}{i < (r.attempts ?? []).length - 1 ? ' · ' : ''}</Text>
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
    return <Text color={C.sub}>  {log ? `log ${log}` : 'no log'} · ctrl+o for full output</Text>
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sprint', description: 'Open the sprint sidebar (phases, handovers, executors)' })
    await $.command.register({ name: 'sprint-critiques', description: 'Side-agent critiques: list, apply (ponytail-review pass) or clear' })
    await $.command.register({ name: 'sprint-status', description: 'Sprint status as text (no model call)' })
    await $.command.register({ name: 'sprint-agents', description: 'Open the Agents tab: subagents, delegated jobs, worktrees, btw' })
    const saved = await $.store.get(await critKey($)).catch(() => null)
    if (Array.isArray(saved) && !(await read($, critiques)).length) await update($, critiques, () => saved as Critique[])
    const s = await refresh($)
    // Frame clock: spinner + countdowns tick every 120 ms; data re-reads every 5 s.
    let ticks = 0
    // One tick a second. The spinner frame (which redraws the panes) moves only while something runs, so an idle
    // sidebar stays still instead of repainting 8 times a second.
    $.clock.every(1000, async () => {
      ticks++
      const moving = (await read($, snap))?.active || jobs.some(j => j.state === 'running') || agentsCache.some(a => /running|pending|waiting/.test(a.status)) || [...btwAnswers.values()].some(t => t.startsWith('…'))
      if (moving) await update($, frame, f => (f + 1) % SPIN.length)
      if (ticks % 5 === 0) await refresh($)
      if (ticks % 60 === 0) void refreshUsage($)
    })
    void refreshUsage($)
    const root = (await $.session.cwd()).replace(/\\/g, '/')
    if (s.active || root === SPRINT_REPO) {
      void $.ui.open({ id: AGENTS, title: 'Agents', columns: 42 })
      void $.ui.open({ id: PANE, title: 'Sprint', columns: 42 })
    }
    return next(e)
  })

  on('command.run', { command: 'sprint' }, async $ => {
    await refresh($)
    await refreshUsage($)
    await $.ui.open({ id: PANE, title: 'Sprint', focus: true, columns: 42 })
    return { text: 'Sprint sidebar opened.' }
  })

  on('command.run', { command: 'sprint-agents' }, async $ => {
    await refresh($)
    await $.ui.open({ id: AGENTS, title: 'Agents', focus: true, columns: 42 })
    return { text: 'Agents tab opened: btw on any row asks haiku what that agent is doing, without interrupting it.' }
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
    if (!s) return <Text color={C.sub}>Reading sprint state…</Text>
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
    const inner = W - 4
    const { short, cut, tok, bar, chip, title, card, keys } = kit($.ui.resolve(e), inner)
    const groups: [string, string, ExecRow[]][] = [
      ['ANTIGRAVITY', C.mauve, s.execs.filter(x => x.key.startsWith('antigravity'))],
      ['OPENCODE', C.sky, s.execs.filter(x => x.key.startsWith('opencode'))],
    ]
    const pctColor = (p: number) => (p > 0.85 ? C.red : p > 0.6 ? C.yellow : C.green)
    const runningJobs = jobs.filter(j => j.state === 'running').length
    // agy's real quota from its own /usage: two pools (Gemini; Claude and GPT), each with a 5-hour and a weekly window.
    const quota = modelUsage?.agyQuota ?? []
    const q = (pool: RegExp, w: string) => quota.find(x => pool.test(x.pool) && x.window === w)
    const gem5 = q(/gemini/i, '5h')
    const pct = (x?: { remaining: number }) => (x ? `${Math.round(x.remaining * 100)}%` : '–')
    const qtone = (x?: { remaining: number }) => (!x ? C.sub : x.remaining < 0.15 ? C.red : x.remaining < 0.4 ? C.yellow : C.green)
    const mini = (x?: { remaining: number }) => { const n = x ? Math.round(x.remaining * 8) : 0; return <Text><Text color={C.track}>▕</Text><Text color={qtone(x)}>{'█'.repeat(n)}</Text><Text color={C.track}>{'░'.repeat(8 - n)}▏</Text></Text> }
    const poolRow = (key: string, name: string, re: RegExp) => (
      <Text key={key}><Text color={C.sub}>{name.padEnd(7)}</Text>{mini(q(re, '5h'))} <Text color={qtone(q(re, '5h'))}>{pct(q(re, '5h'))}</Text><Text color={C.sub}> 5h · </Text><Text color={qtone(q(re, 'week'))}>{pct(q(re, 'week'))}</Text><Text color={C.sub}> wk</Text></Text>
    )
    // Today's tokens per model: agy from its own run databases, DeepSeek from `opencode stats`; auto is not trackable.
    const useRow = (key: string, name: string, n: number, i: number, o: number) => (
      <Text key={key}><Text color={C.sub}>▸ </Text>{cut(name, 18).padEnd(18)} <Text color={C.sub}>{n}× {tok(i)}/{tok(o)}</Text></Text>
    )
    const usageRows = (g: string) => (g === 'ANTIGRAVITY'
      ? (modelUsage?.agy.length ? [<Text key="u-h" color={C.sub}>today · runs× tokens in/out</Text>, ...modelUsage.agy.map(m => useRow(`u-${m.model}`, m.model.replace(/^Gemini /, ''), m.gens, m.in, m.out))] : [])
      : [
          ...(modelUsage?.deepseek ? [<Text key="u-h" color={C.sub}>today · runs× tokens in/out</Text>, useRow('u-ds', 'deepseek-v4.1-flash', modelUsage.deepseek.steps, modelUsage.deepseek.in, modelUsage.deepseek.out)] : []),
          <Text key="u-auto" color={C.sub}>  auto via freellmapi: not tracked</Text>,
        ])
    const phaseName = s.active ? NAMES[s.phase - 1] : ''
    const skillOk = s.skillsLoaded.some(x => x.endsWith(`phase-${phaseName}`))

    const header = (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text><Text bold>SPRINT</Text><Text color={C.sub}> · </Text><Text color={C.peach} bold>{s.active ? `P${s.phase}/6 ${phaseName.toUpperCase()}` : 'IDLE'}</Text></Text>
          <Button key="compact" label={small ? '⤢' : '⤡'} hotkey="c" onPress={async () => { await update($, compact, v => !v) }} />
        </Box>
        {s.active && (
          <Text>
            {NAMES.map((n, i) => <Text key={n} color={i + 1 < s.phase ? C.green : i + 1 === s.phase ? C.peach : C.sub}>{i + 1 < s.phase ? '━━' : i + 1 === s.phase ? `${SPIN[f]}━` : '──'}</Text>)}
            <Text color={C.sub}> {Math.round(elapsedMin)}/{s.budgetMin}m</Text>
          </Text>
        )}
        <Text color={C.sub}>{cut(root.split('/').pop() || root, inner)}{s.active && !skillOk ? ' · load phase skill' : ''}</Text>
      </Box>
    )

    if (small) {
      const ctx = u ? (u.context.tokens ?? 0) / u.context.window : 0
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {u && <Text><Text color={C.sub}>ctx </Text>{bar(ctx, pctColor(ctx))} {Math.round(ctx * 100)}%</Text>}
          {groups.map(([g, c, rows]) => <Text key={g}><Text color={c}>● </Text>{g.toLowerCase()} <Text color={rows.some(x => x.state === 'tripped') ? C.red : C.green}>{rows.filter(x => x.state !== 'tripped').length}/{rows.length}</Text></Text>)}
          <Text><Text color={['clean', 'pass'].includes(gateState(s.gate)) ? C.green : C.red}>● </Text>gate {({ clean: 'clean', pass: 'ok', stale: 'not verified', fail: 'checks failed', none: 'no result' })[gateState(s.gate)]}</Text>
          <Text><Text color={runningJobs ? C.mauve : C.sub}>● </Text>jobs {runningJobs} running</Text>
          <Text><Text color={C.blue}>● </Text>agents <Text color={live.length ? C.sky : C.sub}>{live.length} running</Text></Text>
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
            <Text key="g1">{chip(label, ok ? C.green : C.red)} <Text color={C.sub}>{detail}</Text></Text>,
            ...(hint ? [<Text key="g2" color={C.sub}>{cut(hint, inner)}</Text>] : []),
          ])
        })()}

        {(() => {
          const open = crit.filter(c => c.status === 'open'), sent = crit.length - open.length
          if (!crit.length) return null
          return card('crit', open.length ? C.yellow : C.sub, [
            title('CRITIQUES', open.length ? C.yellow : C.sub, `${open.length} open${sent ? ` · ${sent} sent` : ''}`),
            ...open.slice(-4).map(c => <Text key={c.id}><Text color={C.yellow}>▸ </Text>{cut(c.title, inner - 2)}</Text>),
            ...(held ? [<Text key="held" color={C.sub}>{cut('held: sent notes queue here · reviewed at phase end', inner)}</Text>] : []),
            ...(open.length ? [<Button key="apply" label="Review with ponytail" hotkey="p" onPress={async () => { const out = await applyCritiques($); await update($, note, () => out) }} />] : []),
          ])
        })()}

        {u && card('usage', C.text, [
          title('USAGE', C.text, u.cost ? `$${u.cost.usd.toFixed(2)}` : undefined),
          <Text key="ctx"><Text color={C.sub}>{'context'.padEnd(8)}</Text>{bar((u.context.tokens ?? 0) / u.context.window, pctColor((u.context.tokens ?? 0) / u.context.window))} {Math.round((u.context.tokens ?? 0) / 1000)}k</Text>,
          ...u.rateLimits.slice(0, 2).map(r => (
            <Text key={r.kind}><Text color={C.sub}>{cut(r.kind, 7).padEnd(8)}</Text>{bar(r.percentUsed / 100, pctColor(r.percentUsed / 100))} {Math.round(r.percentUsed)}%</Text>
          )),
          ...(keepCache ? [(() => {
            const k = keepCache, hm = (ms: number) => `${Math.floor(ms / 3600000)}h${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}m`
            const spent = k.idlePingUsd != null ? ` · $${k.idlePingUsd.toFixed(2)} this break` : ''
            return (
              <Text key="kw"><Text color={C.sub}>{'warm'.padEnd(8)}</Text>{k.pingSkipped
                ? <Text color={C.red}>budget hit · pings paused{spent}</Text>
                : k.keepwarm === 'on' ? <Text color={C.green}>on · {hm(k.leftMs)} left{spent}</Text>
                : k.keepwarm === 'stopped' ? <Text color={C.yellow}>stopped · {cut(k.stopped ?? '', Math.max(8, inner - 20))}</Text>
                : <Text color={C.sub}>off{k.cold ? ' · cache cold' : ''}</Text>}{k.autoWarm ? <Text color={C.yellow}> · auto-arm on</Text> : null}</Text>
            )
          })()] : []),
        ])}

        {card('agents', live.length || runningJobs ? C.sky : C.sub, [
          title('AGENTS', live.length || runningJobs ? C.sky : C.sub, `${live.length} live · ${runningJobs} job${runningJobs === 1 ? '' : 's'}`),
          <Button key="open-agents" label="Open Agents tab" hotkey="g" onPress={async () => { await $.ui.open({ id: AGENTS, title: 'Agents', focus: true, columns: 42 }) }} />,
        ])}

        {groups.map(([g, c, rows]) => card(g, rows.some(x => x.state === 'tripped') ? C.red : c, [
          title(g, c, [rows.length ? `${rows.filter(x => x.state !== 'tripped').length}/${rows.length} ready` : 'unused',
            g === 'ANTIGRAVITY' && gem5 ? `${pct(gem5)} left` : ''].filter(Boolean).join(' · ')),
          ...(g === 'ANTIGRAVITY' && quota.length ? [
            poolRow('q-gem', 'gemini', /gemini/i),
            poolRow('q-cg', 'claude', /claude|gpt/i),
            <Text key="q-reset" color={C.sub}>{cut(`resets 5h ${gem5 ? hhmm(Date.parse(gem5.reset)) : '–'} · week ${q(/gemini/i, 'week') ? new Date(Date.parse(q(/gemini/i, 'week')!.reset)).toDateString().slice(4, 10) : '–'}`, inner)}</Text>,
          ] : []),
          ...(g === 'ANTIGRAVITY' && modelUsage?.agy.length ? [<Text key="q-spent" color={C.sub}>{`today ${tok(modelUsage.agy.reduce((n, m) => n + m.in, 0))} in · ${tok(modelUsage.agy.reduce((n, m) => n + m.out, 0))} out`}</Text>] : []),
          ...(usageError ? [<Text key="u-err" color={C.yellow}>{cut(`usage: ${usageError}`, inner)}</Text>] : []),
          ...rows.map(x => {
            const tripped = x.state === 'tripped'
            return (
              <Box key={x.key} justifyContent="space-between">
                <Text><Text color={tripped ? C.red : x.state === 'ok' ? C.green : C.sub}>{tripped ? '✕' : '●'} </Text>{cut(short(x.key), inner - 12)}</Text>
                {tripped
                  ? <Button key={`reset-${x.key}`} label={`${x.reason} ${mins(x.untilMs - now)}m ↺`}
                      onPress={async () => { const out = await run($, ['node', `${await home($)}/.claude/bin/ab-route.js`, '--reset', x.key], root); await update($, note, () => out); await refresh($) }} />
                  : <Text>{x.runs.length ? x.runs.map((r, i) => <Text key={String(i)} color={r === 'ok' ? C.green : C.red}>▮</Text>) : <Text color={C.sub}>idle</Text>}</Text>}
              </Box>
            )
          }),
          ...usageRows(g),
        ]))}

        <Box gap={1}>
          <Button key="hud" label="HUD" hotkey="h"
            onPress={async () => { const out = await run($, ['node', `${await home($)}/.claude/bin/ab-route.js`, '--status'], root); const h0 = await home($); await update($, note, () => (out.startsWith('ok') ? `status.html updated · ${h0}/.agent-bridge/status.html` : out)) }} />
          <Button key="refresh" label="Refresh" hotkey="r" onPress={async () => { await refresh($); await refreshUsage($); await update($, note, () => 'refreshed') }} />
          {s.active && (
            <Button key="advance" label="Advance" hotkey="a"
              onPress={async () => { const out = await run($, ['node', `${SPRINT_REPO}/scripts/hooks/sprint-gate.js`, 'advance'], root); await update($, note, () => out); await refresh($) }} />
          )}
        </Box>
        {keys([['c', 'compact'], ['g', 'agents'], ['r', 'refresh'], ['h', 'hud'], ['p', 'ponytail'], ...(s.active ? [['a', 'advance'] as [string, string]] : [])], msg ? cut(msg, Math.max(8, inner - 30)) : undefined)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: AGENTS }, async ($, e) => {
    const ui = $.ui.resolve(e), { Box, Text, Button } = ui
    const f = await read($, frame), msg = await read($, note), now = await $.clock.now()
    const inner = Math.max(20, e.props.bodyColumns) - 4
    const { short, cut, tok, bar, chip, title, card, keys } = kit(ui, inner)
    const ago = (ms: number) => { const m = Math.max(0, Math.round((now - ms) / 60000)); return m < 1 ? 'now' : `${m}m ago` }
    const isLive = (st: string) => /running|pending|waiting/.test(st)
    const agents = [...agentsCache].sort((x, y) => y.startTime - x.startTime).slice(0, 4)
    const live = agentsCache.filter(a => isLive(a.status)).length, running = jobs.filter(j => j.state === 'running').length
    const answer = (id: string) => {
      const t = btwAnswers.get(id)
      return t ? <Text key={`a-${id}`} color={C.yellow}>{t.startsWith('…') ? `${SPIN[f]} ` : '» '}{cut(t.replace(/\s+/g, ' '), inner * 2)}</Text> : null
    }
    const btw = (id: string, ask: () => Promise<void>) => (
      <Button key={`btw-${id}`} label="btw" onPress={async () => { await ask(); await update($, note, () => `btw answered at ${hhmm(now)}`) }} />
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>AGENTS</Text>
          <Text color={C.sub}>{cut('btw asks haiku; the agent keeps working', inner)}</Text>
        </Box>

        {card('subagents', live ? C.sky : C.blue, [
          title('SUBAGENTS', live ? C.sky : C.blue, `${live} running`),
          ...(agents.length ? agents.map(a => {
            const active = isLive(a.status), bad = /failed|killed/.test(a.status)
            const last = (activity.get(a.id) ?? []).at(-1)
            return (
              <Box key={a.id} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text>{chip(active ? 'LIVE' : bad ? 'FAIL' : 'DONE', active ? C.sky : bad ? C.red : C.green)} <Text bold>{cut(a.name || a.type, inner - 14)}</Text></Text>
                  {btw(a.id, () => btwAgent($, a))}
                </Box>
                <Text color={C.sub}>{cut(a.description || a.label, inner)}</Text>
                {last ? <Text><Text color={C.peach}>▸ </Text>{cut(`${last.tool} ${last.brief}`.trim(), inner - 10)} <Text color={C.sub}>{ago(last.at)}</Text></Text> : null}
                <Text>{bar(a.contextWindowSize ? a.tokenCount / a.contextWindowSize : 0, active ? C.sky : C.blue)} <Text color={C.sub}>{Math.round(a.tokenCount / 1000)}k{a.effort ? ` · ${a.effort}` : ''}</Text></Text>
                {answer(a.id)}
              </Box>
            )
          }) : [<Text key="none" color={C.sub}>none yet this session</Text>]),
        ])}

        {card('jobs', running ? C.mauve : C.sub, [
          title('DELEGATED', running ? C.mauve : C.sub, `${running} running`),
          ...(jobs.length ? [...jobs.filter(j => j.state === 'running'), ...jobs.filter(j => j.state !== 'running').slice(0, 3)].map(j => {
            const isRun = j.state === 'running', ok = j.state === 'ok' || j.state === 'no-change'
            const who = j.to === 'antigravity' ? `agy:${j.model.replace(/^Gemini /, '')}` : short(j.to)
            const used = j.conv ? modelUsage?.agyRuns?.[j.conv] : undefined
            const time = [isRun ? ago(j.startMs) : j.durS != null ? `${j.durS}s` : '', used ? `${tok(used.in)}/${tok(used.out)}` : ''].filter(Boolean).join(' · ')
            const meta = [j.progress ? `${j.progress}%` : '', j.summary ?? '', j.tree ? `tree ${j.tree.split(/[\\/]/).pop()}` : ''].filter(Boolean).join(' · ')
            return (
              <Box key={j.id} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text>{chip(isRun ? 'RUN' : j.state.toUpperCase(), isRun ? C.mauve : ok ? C.green : C.red)} <Text color={j.to === 'antigravity' ? C.mauve : C.sky}>{cut(who, inner - 26)}</Text>{time ? <Text color={C.sub}> · {time}</Text> : null}</Text>
                  {btw(j.id, () => btwJob($, j))}
                </Box>
                {j.task ? <Text color={C.sub}>{cut(j.task, inner)}</Text> : null}
                {meta ? <Text color={C.sub}>{cut(meta, inner)}</Text> : null}
                {answer(j.id)}
              </Box>
            )
          }) : [<Text key="none" color={C.sub}>no router jobs yet</Text>]),
        ])}

        {card('trees', treeRows.some(t => t.prunable) ? C.red : C.green, [
          title('WORKTREES', treeRows.some(t => t.prunable) ? C.red : C.green, `${treeRows.length} besides main`),
          ...(treeRows.length ? treeRows.map(t => {
            const name = t.path.split(/[\\/]/).pop() ?? t.path
            const job = jobs.find(j => j.tree && j.tree.split(/[\\/]/).pop() === name)
            // REVIEW: a finished job left changes there, waiting for review and a merge by hand.
            const st = t.prunable ? 'STALE' : job?.state === 'running' ? 'LIVE' : t.changed ? 'REVIEW' : 'IDLE'
            const owner = job ? ` · ${job.to === 'antigravity' ? 'agy' : short(job.to)}` : t.path.includes('.claude') ? ' · claude agent' : ''
            return (
              <Box key={t.path} flexDirection="column">
                <Text>{chip(st, { STALE: C.red, LIVE: C.mauve, REVIEW: C.yellow, IDLE: C.sub }[st])} {cut(name, inner - 10)}</Text>
                <Text color={C.sub}>{cut(`${t.branch} · ${t.changed} changed${owner}`, inner)}</Text>
              </Box>
            )
          }) : [<Text key="none" color={C.sub}>only the main checkout</Text>]),
          ...(treeRows.some(t => t.prunable) ? [<Button key="prune" label="git worktree prune"
            onPress={async () => { const out = await run($, ['git', 'worktree', 'prune'], (await $.session.cwd()).split(String.fromCharCode(92)).join('/')); await update($, note, () => out); await refresh($) }} />] : []),
        ])}

        <Box gap={1}>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={async () => { await refresh($); await update($, note, () => 'refreshed') }} />
        </Box>
        {keys([['r', 'refresh'], ['btw', 'per row']], msg ? cut(msg, Math.max(8, inner - 24)) : undefined)}
      </Box>
    )
  })
}
