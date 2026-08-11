// Lightweight deterministic ball solver.
// Positions are {x, y, z} with y up.
// `solve` is gravity-only; `solveDrag` adds linear air drag (used for serves).

import type { Vec2, Vec3, Player, Signal, AttackPlan, ReceivePlan } from '../types'

export const GRAVITY = 9.81
export const BALL_R = 0.105

export function solve(p0: Vec3, v0: Vec3, t: number, g: number = GRAVITY): Vec3 {
  return {
    x: p0.x + v0.x * t,
    y: p0.y + v0.y * t - 0.5 * g * t * t,
    z: p0.z + v0.z * t,
  }
}

// Linear-drag integrator. v(t) = (v0 + g/k·ĵ)·e^(-kt) − g/k·ĵ.
export function solveDrag(p0: Vec3, v0: Vec3, t: number, k: number, g: number = GRAVITY): Vec3 {
  const e = Math.exp(-k * t)
  return {
    x: p0.x + (v0.x / k) * (1 - e),
    y: p0.y + ((v0.y + g / k) / k) * (1 - e) - (g / k) * t,
    z: p0.z + (v0.z / k) * (1 - e),
  }
}

// Compute launch velocity so the ball travels from p0 to target in `t` seconds.
export function velocityToReach(p0: Vec3, target: Vec3, t: number, g: number = GRAVITY): Vec3 {
  return {
    x: (target.x - p0.x) / t,
    y: (target.y - p0.y) / t + 0.5 * g * t,
    z: (target.z - p0.z) / t,
  }
}

// Inverse of solveDrag: launch velocity that reaches `target` in `t` seconds
// under linear drag `k`. Exact closed form.
export function velocityToReachDrag(p0: Vec3, target: Vec3, t: number, k: number, g: number = GRAVITY): Vec3 {
  const s = 1 - Math.exp(-k * t)
  const sx = (target.x - p0.x) * k / s
  const sz = (target.z - p0.z) * k / s
  const sy = ((target.y - p0.y) + (g / k) * t) * k / s - g / k
  return { x: sx, y: sy, z: sz }
}

// Compute launch velocity to reach horizontal target while peaking at `apex`
// metres above p0 at time of arrival.
export function velocityToApex(p0: Vec3, targetXZ: Vec3, apexHeight: number, t: number, g: number = GRAVITY): Vec3 {
  const dx = targetXZ.x - p0.x
  const dz = targetXZ.z - p0.z
  const horiz = Math.hypot(dx, dz)
  const vx = horiz / t
  const vy = (apexHeight - p0.y + 0.5 * g * t * t) / t
  return { x: (dx / horiz) * vx, y: vy, z: (dz / horiz) * vx }
}

// Timings per tempo (seconds) for the whole set->approach->spike sequence.
// tempo is continuous: 1 (quick) .. 3 (high). Values between keys interpolate.
export const TEMPO_KEYS = [1, 1.5, 2, 3]
export const TEMPO_APPROACH: Record<number, number> = { 1: 0.6, 1.5: 0.8, 2: 0.95, 3: 1.35 }
export const TEMPO_SETFLIGHT: Record<number, number> = { 1: 0.32, 1.5: 0.5, 2: 0.62, 3: 0.8 }

export function tempoTable(tempo: number, table: Record<number, number>): number {
  if (tempo <= TEMPO_KEYS[0]) return table[TEMPO_KEYS[0]]
  if (tempo >= TEMPO_KEYS[TEMPO_KEYS.length - 1]) return table[TEMPO_KEYS[TEMPO_KEYS.length - 1]]
  for (let i = 0; i < TEMPO_KEYS.length - 1; i++) {
    const lo = TEMPO_KEYS[i]
    const hi = TEMPO_KEYS[i + 1]
    if (tempo >= lo && tempo <= hi) {
      const f = (tempo - lo) / (hi - lo)
      return table[lo] + (table[hi] - table[lo]) * f
    }
  }
  return table[TEMPO_KEYS[0]]
}

// Launch the ball so it reaches target while peaking at `apexY` above ground.
export function velocityToArc(p0: Vec3, target: Vec3, apexY: number, g: number = GRAVITY): { v: Vec3; t: number } {
  const vy = Math.sqrt(Math.max(0, 2 * g * (apexY - p0.y)))
  const tRise = vy / g
  const tFall = Math.sqrt(Math.max(0, 2 * (apexY - target.y) / g))
  const t = tRise + tFall
  return {
    v: { x: (target.x - p0.x) / t, y: vy, z: (target.z - p0.z) / t },
    t,
  }
}

// Does a ballistic path (starting at p0 with velocity v, flying for `flight`)
// cross the net plane (z=0) below the top of the net? Also returns true when
// the ball would never clear the net (lands before / on the net plane).
export function netFault(p0: Vec3, v: Vec3, flight: number, netY: number, g: number = GRAVITY): boolean {
  if (v.z <= 0) return true
  const tNet = (0 - p0.z) / v.z
  if (tNet < 0 || tNet > flight) return true
  const y = solve(p0, v, tNet, g).y
  return y < netY
}

type Point = { x: number; z: number; y?: number }
type SignalLike = Pick<Signal, 'tempo' | 'zone'>

export interface PlanOptions {
  lineupA: Player[]
  lineupB: Player[]
  receiveFormation: Record<string, Vec2>
  serveLanding: Vec2
  setterRole: string
  hitterRole: string
  signal: SignalLike
  netY: number
  spikeTarget: { x: number; z: number }
  customHeight: number | null
  realisticTiming: boolean
  netDist: number
  manuallyReceiver?: string | null
}

// Full attack sequence from free-ball/first touch to spike, in seconds.
export function planPlay(
  signal: SignalLike,
  setterPos: Point,
  hitterPos: Point,
  netY: number,
  realisticTiming: boolean,
  spikeTarget: Point | null = null,
  customHeight: number | null = null,
  feedFrom: Point | null = null,
): AttackPlan {
  let passEnd = 0.28
  const contactHold = 0.2
  const releaseAt = passEnd + contactHold
  const approachDur = tempoTable(signal.tempo, TEMPO_APPROACH)
  const riseTime = 0.16

  const contactY = netY + 0.55
  const ballTarget: Vec3 = { x: hitterPos.x, y: contactY, z: hitterPos.z }
  const setHands: Vec3 = { x: setterPos.x, y: (setterPos.y || 0) + 1.9, z: setterPos.z }

  let setFlight: number
  let vSet: Vec3
  if (customHeight != null) {
    const { v, t } = velocityToArc(setHands, ballTarget, netY + customHeight)
    vSet = v
    setFlight = t
  } else if (realisticTiming) {
    setFlight = tempoTable(signal.tempo, TEMPO_SETFLIGHT)
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  } else {
    setFlight = approachDur + 0.05 + riseTime
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  }

  let approachStart: number
  let jumpAt: number
  let contactAt: number
  if (customHeight != null) {
    contactAt = releaseAt + setFlight
    jumpAt = contactAt - riseTime
    approachStart = realisticTiming ? Math.max(0, jumpAt - approachDur) : Math.max(0, Math.min(releaseAt + 0.05, jumpAt - approachDur))
  } else if (realisticTiming) {
    contactAt = releaseAt + setFlight
    jumpAt = contactAt - riseTime
    approachStart = Math.max(0, jumpAt - approachDur)
  } else {
    contactAt = releaseAt + setFlight
    approachStart = releaseAt + 0.05
    jumpAt = approachStart + approachDur
  }

  let vSpike: Vec3
  if (spikeTarget) {
    const land = { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z }
    vSpike = velocityToReach(ballTarget, land, 0.42)
  } else {
    const spikeSpeed = 22
    const dir = { x: -0.6, y: -1.1, z: 2 }
    const inv = Math.hypot(dir.x, dir.y, dir.z)
    vSpike = { x: (dir.x / inv) * spikeSpeed, y: (dir.y / inv) * spikeSpeed, z: (dir.z / inv) * spikeSpeed }
  }

  let feedV: Vec3
  let passP0: Vec3
  if (feedFrom) {
    const pf = { x: feedFrom.x, y: 1.4, z: feedFrom.z }
    const apex = Math.max(2.6, setHands.y + 1.6)
    const { v } = velocityToArc(pf, setHands, apex)
    feedV = v
    passP0 = pf
    passEnd = (2 * (apex - 1.4)) / GRAVITY + Math.sqrt((2 * (apex - setHands.y)) / GRAVITY)
  } else {
    passP0 = { x: -1.2, y: 2.6, z: -7.4 }
    feedV = velocityToReach(passP0, { x: setHands.x, y: setHands.y - 0.1, z: setHands.z }, passEnd)
  }

  return {
    passEnd,
    contactHold,
    releaseAt,
    contactAt,
    approachStart,
    jumpAt,
    approachDur,
    setFlight,
    riseTime,
    setHands,
    vSet,
    vSpike,
    feedV,
    passP0,
    ballTarget,
    contactY,
    customHeight,
  }
}

export function pickReceiver(lineup: Player[], landing: Vec2, positions: Record<string, Vec2>): Player | undefined {
  let best: Player | undefined
  let bestD = Infinity
  const isDeep = landing[1] < -2.4
  for (const p of lineup) {
    if (p.isSetter) continue
    const pos = positions[p.role]
    if (!pos) continue
    const dx = pos[0] - landing[0]
    const dz = pos[1] - landing[1]
    let d = dx * dx + dz * dz
    if (isDeep && !p.isFrontRow) d *= 0.55
    if (!isDeep && p.isFrontRow) d *= 0.7
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best || lineup.find((p) => !p.isSetter) || lineup[0]
}

// Full serve-reception sequence: serve -> pass -> set -> spike.
export function planServeReceive(opts: PlanOptions): ReceivePlan {
  const {
    lineupA,
    receiveFormation,
    serveLanding,
    setterRole,
    hitterRole,
    signal,
    netY,
    spikeTarget,
    customHeight,
    realisticTiming,
    netDist = 1.5,
    manuallyReceiver = null,
  } = opts
  const setterPos: Vec2 = [0.5, -1.2]
  const setter = lineupA.find((p) => p.role === setterRole) || lineupA.find((p) => p.isSetter)
  const hitter = lineupA.find((p) => p.role === hitterRole) || lineupA[0]
  const hRow = hitter && !hitter.isFrontRow ? 'back' : 'front'
  const hz = hRow === 'back' ? -Math.max(netDist, 3.2) : -netDist
  const hs = { x: signal.zone === 4 ? -2.9 : signal.zone === 2 ? 2.9 : 0, z: hz }
  const hitterPos: Vec2 = [hs.x, hs.z]
  const contactY = netY + 0.55
  const ballTarget: Vec3 = { x: hitterPos[0], y: contactY, z: hitterPos[1] }
  const setHands: Vec3 = { x: setterPos[0], y: 2.05, z: setterPos[1] }

  // Serve
  const serveRelease = 0.45
  const serveP0: Vec3 = { x: 0.6, y: 2.5, z: 9.6 }
  const serveLand: Vec3 = { x: serveLanding[0], y: BALL_R, z: serveLanding[1] }
  const distS = Math.hypot(serveLand.x - serveP0.x, serveLand.z - serveP0.z)
  const serveFlight = (distS / 17) * 2.3
  const serveV = velocityToReach(serveP0, serveLand, serveFlight)
  const serveLandAt = serveRelease + serveFlight

  // Pass
  const receiver =
    (manuallyReceiver && lineupA.find((p) => p.role === manuallyReceiver && !p.isSetter)) ||
    pickReceiver(lineupA, serveLanding, receiveFormation)
  const receiverRole = receiver?.role || lineupA.find((p) => !p.isSetter)?.role || 'OH1'
  const passP0: Vec3 = { x: serveLanding[0], y: 1.5, z: serveLanding[1] }
  const passHold = 0.12
  const passRelease = serveLandAt + passHold
  const passApex = 3.4
  const passFlight = (2 * (passApex - passP0.y)) / GRAVITY + Math.sqrt((2 * (passApex - setHands.y)) / GRAVITY)
  const passV = velocityToArc(passP0, setHands, passApex).v
  const passLandAt = passRelease + passFlight

  // Set
  let setFlight: number
  let vSet: Vec3
  if (customHeight != null) {
    const { v, t } = velocityToArc(setHands, ballTarget, netY + customHeight)
    vSet = v
    setFlight = t
  } else if (realisticTiming) {
    setFlight = tempoTable(signal.tempo, TEMPO_SETFLIGHT)
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  } else {
    setFlight = tempoTable(signal.tempo, TEMPO_SETFLIGHT) + 0.12
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  }
  const setHold = 0.2
  const setRelease = passLandAt + setHold
  const setLandAt = setRelease + setFlight

  // Spike
  const spikeFlight = 0.42
  const spikeV = velocityToReach(ballTarget, { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z }, spikeFlight)
  const spikeEnd = setLandAt + spikeFlight

  const approachDur = tempoTable(signal.tempo, TEMPO_APPROACH)
  const riseTime = 0.16
  const jumpAt = setLandAt - riseTime
  const approachStart = Math.max(0, jumpAt - approachDur)

  return {
    mode: 'receive',
    totalEnd: spikeEnd + 0.3,
    serveRelease,
    serveFlight,
    serveLandAt,
    serve: {
      p0: serveP0,
      v: serveV,
      flightTime: serveFlight,
      releaseAt: serveRelease,
      landAt: serveLandAt,
      landPoint: serveLand,
      speed: 95,
    },
    receiverRole,
    receiverPos: { x: serveLanding[0], y: BALL_R, z: serveLanding[1] },
    pass: { p0: passP0, v: passV, flightTime: passFlight, releaseAt: passRelease, landAt: passLandAt },
    setterRole: setter?.role || 'S',
    setterPos,
    setHands,
    set: { v: vSet, flightTime: setFlight, releaseAt: setRelease, landAt: setLandAt },
    hitterRole: hitter?.role || 'OH1',
    hitterPos,
    ballTarget,
    contactAt: setLandAt,
    spike: { v: spikeV, flightTime: spikeFlight, landPoint: { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z } },
    approachStart,
    jumpAt,
    isBackRow: hRow === 'back',
  }
}
