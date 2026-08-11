// Cached, deterministic plan builders. Each mode produces a plan object whose
// `key` encodes every parameter that affects the ball; when nothing changed the
// cached plan is reused (the render loop reads plans every frame, so rebuilds
// must be cheap). Outcomes are resolved deterministically from the key.

import { SERVE_TARGETS, SERVE_TYPES, SPIKE_TARGETS } from '../constants'
import { buildLineup, activeSetter } from './rotation'
import { planPlay, planServeReceive, velocityToReach, BALL_R } from './physics'
import { outcomeForPlay } from './outcome'
import { effectiveSignal, selectHitter, jumpSpot, setterSpot, spikeLanding, receiveLanding, receivePositions, customActive } from './tactics'
import type { Store, AnimState, ServePlan, Vec2, Vec3 } from '../types'

type Plans = Pick<AnimState, 'plan' | 'servePlan' | 'receivePlan'>
type Point = { x: number; z: number }

export function ensureAttackPlan(s: Store, st: Plans): void {
  const custom = customActive(s)
  const signal = effectiveSignal(s)
  const feed = s.drill.enabled ? s.drill.firstBall : null
  const spikeT = spikeLanding(s, custom)
  const key = `a|${signal.id}|${custom}|${s.customCombo.hitter}|${s.customCombo.zone}|${s.customCombo.height}|${s.customCombo.tempo}|${s.customCombo.netDist}|${custom ? s.customCombo.spikeTarget : ''}|${s.realisticTiming}|${s.netHeight}|${s.rotation}|${feed ? feed[0] + ',' + feed[1] : ''}|${spikeT ? spikeT[0] + ',' + spikeT[1] : ''}`
  if (st.plan && st.plan.key === key) return

  const lineupA = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineupA)
  const hitter = selectHitter(lineupA, signal, custom ? s.customCombo.hitter : null)
  const isBack = !hitter?.isFrontRow
  const netDist = custom ? Math.max(0.5, Math.min(2.9, s.customCombo.netDist)) : 1.5
  const hSpot = jumpSpot(signal.zone, isBack, netDist)
  const setterPos = { x: setterSpot()[0], z: setterSpot()[1] }
  const hitterPos = { x: hSpot[0], z: hSpot[1] }
  const spikeTgt: Point | null = spikeT ? { x: spikeT[0], z: spikeT[1] } : null
  const plan = planPlay(
    signal,
    setterPos,
    hitterPos,
    s.netY(),
    s.realisticTiming,
    spikeTgt,
    custom ? s.customCombo.height : null,
    feed ? { x: feed[0], z: feed[1] } : null,
  )
  plan.key = key
  plan.signalId = signal.id
  plan.hitterRole = hitter?.role
  plan.setterRole = setter?.role
  plan.isCustom = custom
  plan.isBackRow = isBack
  plan.netDist = netDist
  plan.netHeight = s.netHeight
  plan.rotation = s.rotation
  plan.totalEnd = plan.contactAt + 0.72
  plan.outcome = outcomeForPlay({ mode: 'attack', key, blockPattern: s.blockPattern, tempo: signal.tempo, serveType: s.serveType })

  st.plan = plan
  st.servePlan = null
  st.receivePlan = null
  s.setPlan(plan)
  s.setServePlan(null)
  s.setReceivePlan(null)
}

export function ensureServePlan(s: Store, st: Plans): void {
  const target = s.manualServeTarget || (SERVE_TARGETS.find((t) => t.id === s.serveTarget) || SERVE_TARGETS[0])
  if (
    st.servePlan &&
    st.servePlan.serveType === s.serveType &&
    st.servePlan.tx === target.x &&
    st.servePlan.tz === target.z
  ) return

  const stype = SERVE_TYPES.find((t) => t.id === s.serveType) || SERVE_TYPES[1]
  const p0: Vec3 = { x: 0.4, y: 2.4, z: -9.6 }
  const land: Vec3 = { x: target.x, y: BALL_R, z: target.z }
  const speedK: Record<string, number> = { float: 1.05, topspin: 0.85, jump: 0.72, 'jump-float': 0.9 }
  const flightTime = (Math.hypot(target.x - p0.x, target.z - p0.z) / 17) * 2.4 * (speedK[stype.id] || 1)
  const v = velocityToReach(p0, land, flightTime)
  const key = `serve|${s.serveType}|${target.x}|${target.z}|${s.netHeight}`
  const netY = s.netY()
  st.servePlan = {
    p0,
    v,
    flightTime,
    landPoint: land,
    type: stype.id,
    speed: stype.speed,
    serveType: s.serveType,
    tx: target.x,
    tz: target.z,
    releaseAt: 0.45,
    landAt: 0.45 + flightTime,
    totalEnd: 0.45 + flightTime + 0.5,
    outcome: outcomeForPlay({
      mode: 'serve',
      key,
      blockPattern: s.blockPattern,
      tempo: 1,
      serveType: s.serveType,
      serve: { p0, v, flightTime, netY },
    }),
  }
  s.setServePlan(st.servePlan)
  st.plan = null
  st.receivePlan = null
  s.setPlan(null)
  s.setReceivePlan(null)
}

export function ensureReceivePlan(s: Store, st: Plans): void {
  const custom = customActive(s)
  const signal = effectiveSignal(s)
  const landing = receiveLanding(s)
  const lineupA = buildLineup(s.system, s.rotation)
  const lineupB = buildLineup('5-1', s.rotation)
  const spikeT: Vec2 =
    s.drill.enabled
      ? s.drill.spikeLanding
      : custom
        ? (() => {
            const t = SPIKE_TARGETS.find((t) => t.id === s.customCombo.spikeTarget) || SPIKE_TARGETS[1]
            return [t.x, t.z] as Vec2
          })()
        : [0, 4.6]
  const f = receivePositions(lineupA, s.receiveFormation)
  const netDist = custom ? Math.max(0.5, Math.min(2.9, s.customCombo.netDist)) : 1.5
  const key = `r|${landing[0]}|${landing[1]}|${s.receiveFormation}|${s.rotation}|${signal.id}|${custom}|${s.customCombo.hitter}|${s.customCombo.zone}|${s.customCombo.height}|${s.customCombo.tempo}|${netDist}|${spikeT[0]}|${spikeT[1]}|${s.netHeight}|${s.receiveRole || 'auto'}`
  if (st.receivePlan && st.receivePlan.key === key) return

  const setter = activeSetter(s.system, lineupA)
  const hitter = selectHitter(lineupA, signal, custom ? s.customCombo.hitter : null)
  const plan = planServeReceive({
    lineupA,
    lineupB,
    receiveFormation: f,
    serveLanding: landing,
    setterRole: setter?.role || 'S',
    hitterRole: hitter?.role || 'OH1',
    signal,
    netY: s.netY(),
    spikeTarget: { x: spikeT[0], z: spikeT[1] },
    customHeight: custom ? s.customCombo.height : null,
    realisticTiming: s.realisticTiming,
    netDist,
    manuallyReceiver: s.receiveRole || null,
  })
  plan.key = key
  plan.isCustom = custom
  plan.netDist = netDist
  plan.netHeight = s.netHeight
  plan.serveType = s.serveType
  plan.outcome = outcomeForPlay({ mode: 'receive', key, blockPattern: s.blockPattern, tempo: signal.tempo, serveType: s.serveType })

  st.receivePlan = plan
  s.setReceivePlan(plan)
  // expose serve portion so serve-plan consumers (ball/trajectory) work too
  const sp: ServePlan = {
    p0: plan.serve.p0,
    v: plan.serve.v,
    flightTime: plan.serve.flightTime,
    landPoint: plan.serve.landPoint,
    type: s.serveType,
    speed: plan.serve.speed,
    serveType: s.serveType,
    tx: plan.serve.landPoint.x,
    tz: plan.serve.landPoint.z,
    releaseAt: plan.serve.releaseAt,
    landAt: plan.serve.landAt,
  }
  st.servePlan = sp
  s.setServePlan(sp)
  st.plan = null
  s.setPlan(null)
}
