import { ZONE_POS, ROLE_META, SIGNALS, SERVE_TARGETS, RECEIVE_TARGETS, SERVE_TYPES, SPIKE_TARGETS } from '../constants'
import { buildLineup, activeSetter } from './rotation'
import { planPlay, planServeReceive, velocityToReach, BALL_R } from './physics'

export const ROSTERS = {
  '5-1': ['S', 'OH1', 'OH2', 'MB1', 'MB2', 'OPP', 'L'],
  '6-2': ['S1', 'S2', 'OH1', 'OH2', 'MB1', 'MB2', 'L'],
}

const BENCH_A = [6.6, -8.6]
const BENCH_B = [6.6, 8.6]

export function makeEntries(roster) {
  const m = new Map()
  roster.forEach((role) => {
    m.set(role, {
      role,
      label: role,
      color: ROLE_META[role] ? ROLE_META[role].color : '#ffffff',
      pos: [0, 0],
      facing: 0,
      anim: 'idle',
      t: 0,
      prog: 0,
      phase: 'idle',
      dirYaw: 0,
      hitRight: true,
      seed: role.charCodeAt(0) * 0.13,
      serveType: 'topspin',
      hidden: false,
    })
  })
  return m
}

// Jump spot per set zone (hitting location near the net).
// `netDist` = how far off the net the set lands (m).
// Back-row attackers take off behind the 3m line instead.
export function jumpSpot(zone, isBackRow = false, netDist = 1.5) {
  const x = zone === 4 ? -2.9 : zone === 2 ? 2.9 : 0
  const z = isBackRow ? -Math.max(netDist, 3.2) : -netDist
  return [x, z]
}

export function approachStart(zone, isBackRow = false, netDist = 1.5) {
  const x = zone === 4 ? -3.4 : zone === 2 ? 3.4 : 0
  const z = (isBackRow ? -Math.max(netDist, 3.2) : -netDist) - 2.7
  return [x, z]
}

// Blocking spots for Team B at the net against a given set zone + pattern.
// Returns x positions (m). Blockers stand just off the centre line (z ≈ +0.4).
export function blockSpots(zone, pattern) {
  const counts = { single: 1, double: 2, triple: 3 }
  const n = counts[pattern] || 0
  if (!n) return []
  const cx = zone === 4 ? -2.9 : zone === 2 ? 2.9 : 0
  const spacing = zone === 3 ? 0.5 : 0.44
  const out = []
  for (let i = 0; i < n; i++) out.push(cx + (i - (n - 1) / 2) * spacing)
  return out
}

function hitRight(zone) {
  // right-handed hitter for all; keep true
  return true
}

export function selectHitter(lineup, signal, exactRole = null) {
  if (exactRole) {
    const exact = lineup.find((p) => p.role === exactRole && p.role !== 'L')
    if (exact) return exact
  }
  // Exact role match first (used by custom combos), then prefix groups.
  const exact2 = lineup.find((p) => p.role === signal.hitter && p.role !== 'L')
  if (exact2) return exact2
  const want = signal.hitter.split('/').map((s) => s.trim())
  let match = lineup.filter((p) => want.some((w) => p.role.startsWith(w)) && p.role !== 'L')
  if (!match.length) match = lineup.filter((p) => p.role !== 'L')
  return match.find((p) => p.isFrontRow) || match[0]
}

// Build an effective signal from the custom-combo controls.
export function customSignal(combo) {
  return {
    id: 0,
    name: 'Custom Combo',
    zone: combo.zone,
    height: combo.height,
    tempo: combo.tempo,
    hitter: combo.hitter,
    cue: `Custom: ${combo.hitter} @ Z${combo.zone}`,
  }
}

// The setter's target spot (near the net, offset from the middle).
export function setterSpot() {
  return [0.5, -1.2]
}

function receivePositions(lineup, formation) {
  const out = {}
  const setters = lineup.filter((p) => p.isSetter)
  // The active setter (back-row setter in 6-2, the setter in 5-1) runs the offense
  const activeSetterPlayer = setters.find((p) => !p.isFrontRow) || setters[0]
  if (activeSetterPlayer) out[activeSetterPlayer.role] = [0.5, -1.2]
  const others = lineup.filter((p) => p !== activeSetterPlayer)
  const front = others.filter((p) => p.isFrontRow)
  const back = others.filter((p) => !p.isFrontRow)
  const lib = back.find((p) => p.role === 'L')
  const rest = back.filter((p) => p.role !== 'L')

  if (formation === 'w') {
    front.forEach((p) => { out[p.role] = [ZONE_POS[p.zone][0] * 0.9, -2.55] })
    if (lib) out[lib.role] = [0, -6.4]
    if (rest[0]) out[rest[0].role] = [-2.9, -5.2]
    if (rest[1]) out[rest[1].role] = [2.9, -5.2]
  } else if (formation === '2') {
    front.forEach((p) => { out[p.role] = [ZONE_POS[p.zone][0] * 0.85, -2.3] })
    if (rest[0]) out[rest[0].role] = [-3.1, -6.4]
    if (rest[1]) out[rest[1].role] = [3.1, -6.4]
    if (lib) out[lib.role] = [0, -6.7]
  } else {
    const slots = [[-3.3, -4.4], [-2.0, -4.9], [0, -5.3], [2.0, -4.9], [3.3, -4.4]]
    others.slice().sort((a, b) => a.zone - b.zone).forEach((p, i) => {
      out[p.role] = slots[i] || [0, -5]
    })
  }
  return out
}

// Serve landing point (Team A half) used by receive mode.
function receiveLanding(s) {
  if (s.manualReceiveTarget) return s.manualReceiveTarget
  const t = RECEIVE_TARGETS.find((t) => t.id === s.serveTarget) || RECEIVE_TARGETS[1]
  return { x: t.x, z: t.z }
}

// Spike landing point (Team B half) used by attack mode.
function spikeLanding(s, useCustom) {
  if (s.drill.enabled) return s.drill.spikeLanding
  if (useCustom) {
    const t = SPIKE_TARGETS.find((t) => t.id === s.customCombo.spikeTarget) || SPIKE_TARGETS[1]
    return { x: t.x, z: t.z }
  }
  return { x: 0, z: 4.6 }
}

// Main per-frame compute. `st` = { playersA, playersB, plan, servePlan, receivePlan, ... }
export function step(s, st) {
  const rosterA = ROSTERS[s.system]
  const rosterB = ROSTERS['5-1']

  const lineupA = buildLineup(s.system, s.rotation)
  const lineupB = buildLineup('5-1', s.rotation).map((p) => ({ ...p, role: p.role === 'S' ? 'S' : p.role }))

  const useCustom = s.customCombo.enabled || s.drill.enabled
  const signal = useCustom
    ? customSignal(s.customCombo)
    : SIGNALS.find((sg) => sg.id === s.signalId) || SIGNALS[3]

  const mode = s.mode
  const phase = s.phase
  const t = s.play.clock
  const netY = s.netY()

  // ============================================================
  //  PLAN MANAGEMENT
  // ============================================================
  if (mode === 'attack' && phase !== 'idle') {
    const feed = s.drill.enabled ? s.drill.firstBall : null
    const spikeTgt = spikeLanding(s, useCustom)
    const key = `a|${signal.id}|${useCustom}|${s.customCombo.hitter}|${s.customCombo.zone}|${s.customCombo.height}|${s.customCombo.tempo}|${s.customCombo.netDist}|${useCustom ? s.customCombo.spikeTarget : ''}|${s.realisticTiming}|${s.netHeight}|${s.rotation}|${feed ? feed.x + ',' + feed.z : ''}|${spikeTgt.x + ',' + spikeTgt.z}`
    if (!st.plan || st.plan.key !== key) {
      const setter = activeSetter(s.system, lineupA)
      const hitter = selectHitter(lineupA, signal, useCustom ? s.customCombo.hitter : null)
      const isBack = !hitter.isFrontRow
      const netDist = useCustom ? Math.max(0.5, Math.min(2.9, s.customCombo.netDist)) : 1.5
      const hSpot = jumpSpot(signal.zone, isBack, netDist)
      const setterPos = { x: setterSpot()[0], z: setterSpot()[1] }
      const hitterPos = { x: hSpot[0], z: hSpot[1] }
      const spikeT = spikeTgt ? { x: spikeTgt.x, z: spikeTgt.z } : null
      const plan = planPlay(
        signal, setterPos, hitterPos, netY, s.realisticTiming,
        spikeT, useCustom ? s.customCombo.height : null,
        feed ? { x: feed.x, z: feed.z } : null,
      )
      plan.key = key
      plan.signalId = signal.id
      plan.hitterRole = hitter.role
      plan.setterRole = setter.role
      plan.isCustom = useCustom
      plan.isBackRow = isBack
      plan.netDist = netDist
      plan.netHeight = s.netHeight
      plan.rotation = s.rotation
      plan.totalEnd = plan.contactAt + 0.72
      st.plan = plan
      s.setPlan(plan)
      st.servePlan = null
      st.receivePlan = null
      s.setServePlan(null)
      s.setReceivePlan(null)
    }
  } else if (mode === 'serve' && phase !== 'idle') {
    const target = s.manualServeTarget || (SERVE_TARGETS.find((t) => t.id === s.serveTarget) || SERVE_TARGETS[0])
    if (!st.servePlan || st.servePlan.serveType !== s.serveType || st.servePlan.tx !== target.x || st.servePlan.tz !== target.z) {
      const stype = SERVE_TYPES.find((t) => t.id === s.serveType) || SERVE_TYPES[1]
      const p0 = { x: 0.4, y: 2.4, z: -9.6 }
      const land = { x: target.x, y: BALL_R, z: target.z }
      const speedK = { float: 1.05, topspin: 0.85, jump: 0.72, 'jump-float': 0.9 }[stype.id] || 1
      const flightTime = (Math.hypot(target.x - p0.x, target.z - p0.z) / 17) * 2.4 * speedK
      const v = velocityToReach({ x: p0.x, y: p0.y, z: p0.z }, land, flightTime)
      st.servePlan = {
        p0, v, flightTime, landPoint: land, type: stype.id, speed: stype.speed,
        serveType: s.serveType, tx: target.x, tz: target.z,
        totalEnd: 0.45 + flightTime + 0.5,
      }
      s.setServePlan(st.servePlan)
      st.plan = null
      st.receivePlan = null
      s.setPlan(null)
      s.setReceivePlan(null)
    }
} else if (mode === 'receive' && phase !== 'idle') {
    // Professional serve-receive: serve -> pass -> set -> spike.
    const landing = receiveLanding(s)
    const spikeT = s.drill.enabled
      ? s.drill.spikeLanding
      : (s.customCombo.enabled
          ? ((SPIKE_TARGETS.find((t) => t.id === s.customCombo.spikeTarget) || SPIKE_TARGETS[1]) || { x: 0, z: 4.5 })
          : { x: 0, z: 4.6 })
    const f = receivePositions(lineupA, s.receiveFormation)
    const netDist = useCustom ? Math.max(0.5, Math.min(2.9, s.customCombo.netDist)) : 1.5
    const key = `r|${landing.x}|${landing.z}|${s.receiveFormation}|${s.rotation}|${signal.id}|${useCustom}|${s.customCombo.hitter}|${s.customCombo.zone}|${s.customCombo.height}|${s.customCombo.tempo}|${netDist}|${spikeT.x}|${spikeT.z}|${s.netHeight}|${s.receiveRole || 'auto'}`
    if (!st.receivePlan || st.receivePlan.key !== key) {
      const setter = activeSetter(s.system, lineupA)
      const hitter = selectHitter(lineupA, signal, useCustom ? s.customCombo.hitter : null)
      const plan = planServeReceive({
        lineupA,
        lineupB,
        receiveFormation: f,
        serveLanding: landing,
        setterRole: setter.role,
        hitterRole: hitter.role,
        signal,
        netY,
        spikeTarget: spikeT,
        customHeight: useCustom ? s.customCombo.height : null,
        realisticTiming: s.realisticTiming,
        netDist,
        manuallyReceiver: s.receiveRole || null,
      })
      plan.key = key
      plan.mode = 'receive'
      plan.isCustom = useCustom
      plan.netDist = netDist
      plan.netHeight = s.netHeight
      plan.serveType = s.serveType
      st.receivePlan = plan
      s.setReceivePlan(plan)
      // expose serve portion so serve-plan consumers (ball/trajectory) work too
      st.servePlan = {
        p0: plan.serve.p0, v: plan.serve.v, flightTime: plan.serve.flightTime,
        landPoint: plan.serve.landPoint, type: s.serveType, speed: plan.serve.speed,
        releaseAt: plan.serve.releaseAt, landAt: plan.serve.landAt,
      }
      s.setServePlan(st.servePlan)
      s.setPlan(null)
    }
  } else {
    if (mode === 'attack' || mode === 'serve') {
      st.receivePlan = null
      s.setReceivePlan(null)
    }
    if (mode === 'serve') {
      st.plan = null
      s.setPlan(null)
    }
    else if (mode === 'receive') {
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

  // ============================================================
  //  TEAM A TARGETS + ANIMATION
  // ============================================================
  const entryA = {}
  const plan = st.plan
  const rPlan = st.receivePlan

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
        let target = ZONE_POS[p.zone]
        if (p.role === setterRole) target = setterSpot()
        else if (p.role === hitterRole) {
          if (t < plan.approachStart) target = aStart
          else if (t < plan.jumpAt) target = aStart.map((v, i) => v + (hSpot[i] - v) * ((t - plan.approachStart) / (plan.jumpAt - plan.approachStart)))
          else target = hSpot
        }
        entryA[p.role] = target
      })
    } else {
      lineupA.forEach((p) => { entryA[p.role] = ZONE_POS[p.zone] })
    }
  }

  // Bench players (liberos / subbed middles not on court)
  rosterA.forEach((role) => {
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
    e.phase = phase
    e.hidden = entryA[p.role] === BENCH_A
    const tt = t

    if (mode === 'serve' && p.zone === 1 && phase !== 'idle') {
      e.anim = 'serve'
      e.t = tt
      e.prog = Math.min(1, tt / 1.6)
      e.serveType = s.serveType
      e.facing = Math.PI // face opponent side
    } else if (mode === 'receive' && rPlan && phase !== 'idle') {
      const serv = rPlan.serve
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
        const netDist = rPlan.netDist || 1.5
        const aStart = approachStart(signal.zone, rPlan.isBackRow, netDist)
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
      const aStart = approachStart(signal.zone, plan.isBackRow)
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
  rosterA.forEach((role) => {
    const e = st.playersA.get(role)
    if (!e || lineupA.find((p) => p.role === role)) return
    e.pos = BENCH_A
    e.anim = 'idle'
    e.hidden = true
  })

  // ============================================================
  //  TEAM B (opponent)
  // ============================================================
  const bForm = receivePositions(lineupB, 'w')

  // Blocking assignments: front-row Team B players close to the net on the
  // set zone. Picked deterministically by distance to the ball target.
  const blockMap = {}
  if (mode === 'attack' && phase !== 'idle' && plan) {
    const spots = blockSpots(signal.zone, s.blockPattern)
    if (spots.length) {
      const center = plan.ballTarget.x
      const candidates = lineupB.filter((p) => p.isFrontRow && !p.isSetter && p.role !== 'L')
      const sorted = [...candidates].sort((a, b) =>
        Math.abs(ZONE_POS[a.zone][0] - center) - Math.abs(ZONE_POS[b.zone][0] - center)
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
    let target
    if (mode === 'serve') {
      const f = bForm[p.role]
      target = f ? [f[0], -f[1]] : [ZONE_POS[p.zone][0], -ZONE_POS[p.zone][1]]
    } else target = [ZONE_POS[p.zone][0], -ZONE_POS[p.zone][1]]
    e.label = p.label
    e.role = p.role
    e.hidden = false
    e.t = t
    e.phase = phase

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
      const spot = [blk.x, blk.z]
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
  rosterB.forEach((role) => {
    const e = st.playersB.get(role)
    if (e && !lineupB.find((p) => p.role === role)) { e.pos = BENCH_B; e.anim = 'idle'; e.hidden = true }
  })
}

// 6-2 callout info
export function sixTwoNote(s) {
  if (s.system !== '6-2') return null
  const lineup = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineup)
  if (!setter) return null
  return setter.isFrontRow ? 'Setter entering front row → attacking role' : 'Setter entering back row → setting role'
}
