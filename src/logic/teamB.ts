// Team B (opponent) per-frame targets + animation.
// Pure: mutates only the player-entry maps in `st`.

import { ZONE_POS } from '../constants'
import { buildLineup } from './rotation'
import { effectiveSignal, receivePositions, blockSpots, ROSTERS, BENCH_B } from './tactics'
import type { Store, AnimState, Vec2, PhaseName } from '../types'

export function teamBEntries(s: Store, st: AnimState): void {
  const lineupB = buildLineup('5-1', s.rotation)
  const mode = s.mode
  const phase = s.phase
  const t = s.play.clock
  const plan = st.plan
  const rPlan = st.receivePlan
  const signal = effectiveSignal(s)

  const bForm = receivePositions(lineupB, 'w')

  // Blocking assignments: front-row Team B players close to the net on the
  // set zone. Picked deterministically by distance to the ball target.
  const blockMap: Record<string, { x: number; z: number }> = {}
  if (mode === 'attack' && phase !== 'idle' && plan) {
    const spots = blockSpots(signal.zone, s.blockPattern)
    if (spots.length) {
      const center = plan.ballTarget.x
      const candidates = lineupB.filter((p) => p.isFrontRow && !p.isSetter && p.role !== 'L')
      const sorted = [...candidates].sort(
        (a, b) => Math.abs(ZONE_POS[a.zone][0] - center) - Math.abs(ZONE_POS[b.zone][0] - center),
      )
      spots.forEach((sx, i) => {
        const p = sorted[i]
        if (p) blockMap[p.role] = { x: sx, z: 0.4 }
      })
    }
  }

  lineupB.forEach((p) => {
    const e = st.playersB.get(p.role)
    if (!e) return
    const blk = blockMap[p.role]
    let target: Vec2
    if (mode === 'serve') {
      const f = bForm[p.role]
      target = f ? [f[0], -f[1]] : [ZONE_POS[p.zone][0], -ZONE_POS[p.zone][1]]
    } else target = [ZONE_POS[p.zone][0], -ZONE_POS[p.zone][1]]
    e.label = p.label
    e.role = p.role
    e.hidden = false
    e.t = t
    e.phase = phase as PhaseName

    if (mode === 'receive' && rPlan && phase !== 'idle') {
      // Team B server (back-right zone on their side) serves toward Team A
      if (p.zone === 1) {
        e.pos = [0.6, 9.6]
        e.anim = 'serve'
        e.prog = Math.min(1, t / 1.6)
        e.serveType = 'topspin'
        e.facing = 0
      } else {
        e.pos = target
        e.anim = 'receive'
        e.facing = 0
      }
    } else if (mode === 'attack' && blk && plan && phase !== 'idle') {
      // Blocker: slide to the net, then jump with arms up over the spike.
      const jumpStart = Math.max(0, plan.jumpAt - 0.22)
      const jumpEnd = plan.contactAt + 0.35
      const spot: Vec2 = [blk.x, blk.z]
      if (t < jumpStart) {
        const span = Math.max(0.001, jumpStart - plan.approachStart)
        const k = Math.min(1, Math.max(0, (t - plan.approachStart) / span))
        e.pos = [target[0] + (spot[0] - target[0]) * k, target[1] + (spot[1] - target[1]) * k]
        e.anim = 'run'
        e.prog = (t * 2) % 1
        e.facing = Math.PI
      } else if (t < jumpEnd) {
        e.pos = spot
        e.anim = 'block'
        e.prog = (t - jumpStart) / (jumpEnd - jumpStart)
        e.facing = Math.PI
      } else {
        e.pos = spot
        e.anim = 'idle'
        e.facing = Math.PI
      }
    } else {
      e.pos = target
      e.anim = mode === 'serve' ? 'receive' : 'idle'
      e.facing = Math.PI
    }
  })

  ROSTERS['5-1'].forEach((role) => {
    const e = st.playersB.get(role)
    if (e && !lineupB.find((p) => p.role === role)) {
      e.pos = BENCH_B
      e.anim = 'idle'
      e.hidden = true
    }
  })
}
