export type HoldMode = 'sprint' | 'always' | 'off'
export type Critique = { id: string; at: number; title: string; text: string; status: 'open' | 'sent' }
export type ExecRow = { key: string; state: 'ok' | 'tripped' | 'new'; reason: string; untilMs: number; sinceMs: number; runs: string[] }
export type Gate = { changed: number; lastEditMs: number; verifiedMs: number; evidence: string; verdict: 'pass' | 'fail' | 'none' }
export type Snapshot = {
  active: boolean
  phase: number
  startedAtMs: number
  budgetMin: number
  phaseBudgets: number[]
  phaseStartedAtMs: number
  floorMin: number
  skillsLoaded: string[]
  execs: ExecRow[]
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
      critiques: Critique[]
      hold: HoldMode
      effort: string[]
      expandedBtw: string[]
      paneWaiting: boolean
    }
  }
}
