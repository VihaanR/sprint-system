export type ExecRow = { key: string; state: 'ok' | 'tripped' | 'new'; reason: string; untilMs: number; sinceMs: number; runs: string[] }
export type Hop = { ts: string; to: string; model: string; outcome: string; durS: number | null }
export type Gate = { changed: number; lastEditMs: number; verifiedMs: number; evidence: string }
export type Snapshot = {
  active: boolean
  phase: number
  startedAtMs: number
  budgetMin: number
  phaseBudgets: number[]
  skillsLoaded: string[]
  execs: ExecRow[]
  hops: Hop[]
  trees: number
  readAtMs: number
  gate: Gate
}

declare module 'claude-code' {
  interface PluginState {
    'sprint-mod': {
      snap: Shaped<Snapshot | null>
      frame: number
      note: string
      compact: boolean
      keepArmed: number
      effort: string[]
    }
  }
}
