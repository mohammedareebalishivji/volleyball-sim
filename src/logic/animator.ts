// Per-frame orchestrator. Keeps the plan cache warm via ensure*Plan, then
// delegates player motion to teamA/teamB.

import { buildLineup, activeSetter } from './rotation'
import { ensureAttackPlan, ensureServePlan, ensureReceivePlan } from './plans'
import { teamAEntries } from './teamA'
import { teamBEntries } from './teamB'
import type { Store, AnimState } from '../types'

// Re-exported for the legacy .jsx consumers (kept stable across the TS migration).
export {
  ROSTERS,
  makeEntries,
  jumpSpot,
  approachStart,
  blockSpots,
  hitRight,
  customSignal,
  setterSpot,
  BENCH_A,
  BENCH_B,
} from './tactics'
export { liberoCoverFor, liberoSwapBetween, liberoCoverageTable } from './rotation'

export function step(s: Store, st: AnimState): void {
  const mode = s.mode
  const phase = s.phase

  if (mode === 'attack' && phase !== 'idle') {
    ensureAttackPlan(s, st)
  } else if (mode === 'serve' && phase !== 'idle') {
    ensureServePlan(s, st)
  } else if (mode === 'receive' && phase !== 'idle') {
    ensureReceivePlan(s, st)
  } else {
    if (mode === 'attack' || mode === 'serve') {
      st.receivePlan = null
      s.setReceivePlan(null)
    }
    if (mode === 'serve') {
      st.plan = null
      s.setPlan(null)
    } else if (mode === 'receive') {
      st.plan = null
      s.setPlan(null)
    }
    if (mode !== 'attack' && mode !== 'serve' && mode !== 'receive') {
      st.plan = null
      st.servePlan = null
      st.receivePlan = null
      s.setPlan(null)
      s.setServePlan(null)
      s.setReceivePlan(null)
    }
  }

  teamAEntries(s, st)
  teamBEntries(s, st)
}

// 6-2 callout info
export function sixTwoNote(s: Store): string | null {
  if (s.system !== '6-2') return null
  const lineup = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineup)
  if (!setter) return null
  return setter.isFrontRow ? 'Setter entering front row → attacking role' : 'Setter entering back row → setting role'
}
