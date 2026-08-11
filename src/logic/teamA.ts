// Team A per-frame targets + animation, extracted from the old animator.js.
// Pure: mutates only the player-entry maps in `st`.

import { ZONE_POS } from '../constants'
import { buildLineup } from './rotation'
import { effectiveSignal, jumpSpot, approachStart, setterSpot, receivePositions, ROSTERS, BENCH_A, hitRight } from './tactics'
import type { Store, AnimState, Vec2, PhaseName } from '../types'

// Seed the player-entry map for a roster (see makeEntries in tactics.ts).
export function teamAEntries(s: Store, st: AnimState): void {
  const lineupA = buildLineup(s.system, s.rotation)
  const mode = s.mode
  const phase = s.phase
  const t = s.play.clock
  const plan = st.plan
  const rPlan = st.receivePlan
  const signal = effectiveSignal(s)

  const entryA: Record<string, Vec2> = {}

  if (mode === 'receive') {
    const pos = receivePositions(lineupA, s.receiveFormation)
    lineupA.forEach((p) => {
      entryA[p.role] = pos[p.role] || ZONE_POS[p.zone]
    })
    // receiver drifts to the landing point before the pass
    if (rPlan && phase !== 'idle') {
      const r = rPlan.receiverRole
      if (entryA[r]) {
        const lx = rPlan.receiverPos.x
        const lz = rPlan.receiverPos.z
        if (t < rPlan.pass.releaseAt) {
          const k = Math.min(1, t / rPlan.serveLandAt)
          const base = entryA[r]
          entryA[r] = [base[0] + (lx - base[0]) * k, base[1] + (lz - base[1]) * k]
        }
      }
      // hitter moves from formation to the approach / jump spot
      const h = rPlan.hitterRole
      if (entryA[h]) {
        const netDist = rPlan.netDist || 1.5
        const hSpot = jumpSpot(signal.zone, rPlan.isBackRow, netDist)
        const aStart = approachStart(signal.zone, rPlan.isBackRow, netDist)
        const base = entryA[h]
        if (t < rPlan.approachStart) {
          const k = Math.min(1, Math.max(0, (t - (rPlan.approachStart - 0.8)) / 0.8))
          entryA[h] = [base[0] + (aStart[0] - base[0]) * k, base[1] + (aStart[1] - base[1]) * k]
        } else if (t < rPlan.jumpAt) {
          const k = (t - rPlan.approachStart) / (rPlan.jumpAt - rPlan.approachStart)
          entryA[h] = [aStart[0] + (hSpot[0] - aStart[0]) * k, aStart[1] + (hSpot[1] - aStart[1]) * k]
        } else {
          entryA[h] = hSpot
        }
      }
    }
  } else if (mode === 'serve') {
    lineupA.forEach((p) => {
      if (p.zone === 1) entryA[p.role] = [0.4, -9.6] // server
      else entryA[p.role] = ZONE_POS[p.zone]
    })
  } else {
    // attack
    if (phase !== 'idle' && plan) {
      const setterRole = plan.setterRole
      const hitterRole = plan.hitterRole
      const isBack = plan.isBackRow
      const netDist = plan.netDist || 1.5
      const hSpot = jumpSpot(signal.zone, isBack, netDist)
      const aStart = approachStart(signal.zone, isBack, netDist)
      lineupA.forEach((p) => {
        let target: Vec2 = ZONE_POS[p.zone]
        if (p.role === setterRole) target = setterSpot()
        else if (p.role === hitterRole) {
          if (t < plan.approachStart) target = aStart
          else if (t < plan.jumpAt) {
            const k = (t - plan.approachStart) / (plan.jumpAt - plan.approachStart)
            target = [aStart[0] + (hSpot[0] - aStart[0]) * k, aStart[1] + (hSpot[1] - aStart[1]) * k]
          } else target = hSpot
        }
        entryA[p.role] = target
      })
    } else {
      lineupA.forEach((p) => { entryA[p.role] = ZONE_POS[p.zone] })
    }
  }

  // Bench players (liberos / subbed middles not on court)
  ROSTERS[s.system].forEach((role) => {
    if (entryA[role] === undefined) {
      entryA[role] = BENCH_A
    }
  })

  // --- Team A animation ---
  lineupA.forEach((p) => {
    const e = st.playersA.get(p.role)
    if (!e) return
    const isHitter = plan && p.role === plan.hitterRole && mode === 'attack'
    e.pos = entryA[p.role]
    e.role = p.role
    e.label = p.label
    e.phase = phase as PhaseName
    e.hidden = entryA[p.role] === BENCH_A
    const tt = t

    if (mode === 'serve' && p.zone === 1 && phase !== 'idle') {
      e.anim = 'serve'
      e.t = tt
      e.prog = Math.min(1, tt / 1.6)
      e.serveType = s.serveType
      e.facing = Math.PI // face opponent side
    } else if (mode === 'receive' && rPlan && phase !== 'idle') {
      if (p.role === rPlan.receiverRole) {
        if (tt < rPlan.pass.releaseAt) {
          e.anim = 'receive'
          e.t = tt
          e.prog = 0
          e.facing = Math.PI
        } else {
          e.anim = 'receive'
          e.t = tt
          e.prog = Math.min(1, (tt - rPlan.pass.releaseAt) / rPlan.pass.flightTime)
          e.facing = Math.atan2(setterSpot()[0] - e.pos[0], setterSpot()[1] - e.pos[1])
        }
      } else if (p.role === rPlan.setterRole) {
        const ready = Math.max(0, rPlan.pass.releaseAt - 0.15)
        if (tt < ready) { e.anim = 'idle'; e.t = tt; e.facing = Math.PI }
        else {
          e.anim = 'set'
          e.t = tt
          e.prog = Math.max(0, Math.min(1, (tt - ready) / (rPlan.set.landAt - ready)))
          e.facing = Math.atan2(rPlan.ballTarget.x - e.pos[0], rPlan.ballTarget.z - e.pos[1])
        }
      } else if (p.role === rPlan.hitterRole) {
        if (tt < rPlan.approachStart) { e.anim = 'idle'; e.t = tt; e.facing = 0 }
        else if (tt < rPlan.jumpAt) {
          e.anim = 'approach'
          e.t = tt
          e.prog = (tt - rPlan.approachStart) / (rPlan.jumpAt - rPlan.approachStart)
          e.facing = Math.atan2(rPlan.ballTarget.x - e.pos[0], rPlan.ballTarget.z - e.pos[1])
        } else if (tt < rPlan.contactAt) {
          e.anim = 'jump'
          e.t = tt
          e.prog = (tt - rPlan.jumpAt) / (rPlan.contactAt - rPlan.jumpAt)
          e.hitRight = hitRight(signal.zone)
          e.facing = Math.atan2(rPlan.ballTarget.x - e.pos[0], rPlan.ballTarget.z - e.pos[1])
        } else if (tt < rPlan.contactAt + 0.06) {
          e.anim = 'spike'
          e.prog = (tt - rPlan.contactAt) / 0.06
          e.facing = Math.atan2(rPlan.ballTarget.x - e.pos[0], rPlan.ballTarget.z - e.pos[1])
        } else if (tt < rPlan.contactAt + 0.4) {
          e.anim = 'land'
          e.prog = (tt - rPlan.contactAt - 0.06) / 0.34
        } else {
          e.anim = 'idle'
          e.t = tt
        }
      } else {
        e.anim = 'receive'
        e.t = tt
        e.facing = Math.PI
      }
    } else if (isHitter && phase !== 'idle') {
      if (tt < plan.approachStart) { e.anim = 'idle'; e.t = tt }
      else if (tt < plan.jumpAt) { e.anim = 'approach'; e.t = tt; e.prog = (tt - plan.approachStart) / (plan.jumpAt - plan.approachStart) }
      else if (tt < plan.contactAt) { e.anim = 'jump'; e.t = tt; e.prog = (tt - plan.jumpAt) / (plan.contactAt - plan.jumpAt); e.hitRight = hitRight(signal.zone) }
      else if (tt < plan.contactAt + 0.06) { e.anim = 'spike'; e.prog = (tt - plan.contactAt) / 0.06 }
      else if (tt < plan.contactAt + 0.4) { e.anim = 'land'; e.prog = (tt - plan.contactAt - 0.06) / 0.34 }
      else e.anim = 'idle'
      // face toward hitting spot
      const [hx, hz] = jumpSpot(signal.zone, plan.isBackRow, plan.netDist || 1.5)
      const [px, pz] = e.pos
      e.facing = Math.atan2(hx - px, hz - pz)
    } else if (plan && mode === 'attack' && phase !== 'idle' && p.role === plan.setterRole) {
      e.anim = 'set'
      e.t = tt
      const end = plan.releaseAt + 0.2
      e.prog = Math.min(1, tt / end)
      const tx = plan.ballTarget.x - 0.5
      const tz = plan.ballTarget.z + 1.2
      e.dirYaw = Math.atan2(tx - e.pos[0], tz - e.pos[1]) * 0.5
      e.facing = Math.atan2(plan.ballTarget.x - e.pos[0], plan.ballTarget.z - e.pos[1])
    } else if (mode === 'receive') {
      e.anim = 'receive'
      e.t = tt
      e.facing = 0
    } else {
      e.anim = 'idle'
      e.t = tt
      e.facing = 0
    }
  })

  // roster entries not in lineup -> bench idle
  ROSTERS[s.system].forEach((role) => {
    const e = st.playersA.get(role)
    if (!e || lineupA.find((p) => p.role === role)) return
    e.pos = BENCH_A
    e.anim = 'idle'
    e.hidden = true
  })
}
