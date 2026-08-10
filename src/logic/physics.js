// Lightweight deterministic parabolic ball solver (gravity-only).
// Positions are THREE.Vector3 (x up, y up, z).

export const GRAVITY = 9.81
export const BALL_R = 0.105

export function solve(p0, v0, t, g = GRAVITY) {
  return {
    x: p0.x + v0.x * t,
    y: p0.y + v0.y * t - 0.5 * g * t * t,
    z: p0.z + v0.z * t,
  }
}

// Compute launch velocity so the ball travels from p0 to target (Vector3)
// in `t` seconds, landing at exactly the target point.
export function velocityToReach(p0, target, t, g = GRAVITY) {
  return {
    x: (target.x - p0.x) / t,
    y: (target.y - p0.y) / t + 0.5 * g * t,
    z: (target.z - p0.z) / t,
  }
}

// Compute launch velocity to reach horizontal target while peaking at `apex`
// metres above p0 at time of arrival. Solve for the vertical velocity and
// flight time given horizontal distance.
export function velocityToApex(p0, targetXZ, apexHeight, t, g = GRAVITY) {
  const dx = targetXZ.x - p0.x
  const dz = targetXZ.z - p0.z
  const horiz = Math.hypot(dx, dz)
  const vx = horiz / t
  // vertical: y(t) = y0 + vy*t - .5 g t^2 = apex, vy = (apex - y0 + .5 g t^2)/t
  const vy = (apexHeight - p0.y + 0.5 * g * t * t) / t
  return { x: (dx / horiz) * vx, y: vy, z: (dz / horiz) * vx }
}

// Timings per tempo (seconds) for the whole set->approach->spike sequence.
// tempo is continuous: 1 (quick) .. 3 (high). Values between keys interpolate.
export const TEMPO_KEYS = [1, 1.5, 2, 3]
export const TEMPO_APPROACH = { 1: 0.6, 1.5: 0.8, 2: 0.95, 3: 1.35 }
export const TEMPO_SETFLIGHT = { 1: 0.32, 1.5: 0.5, 2: 0.62, 3: 0.8 }

export function tempoTable(tempo, table) {
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
// Returns launch velocity + total flight time to the target.
export function velocityToArc(p0, target, apexY, g = GRAVITY) {
  const vy = Math.sqrt(Math.max(0, 2 * g * (apexY - p0.y)))
  const tRise = vy / g
  const tFall = Math.sqrt(Math.max(0, 2 * (apexY - target.y) / g))
  const t = tRise + tFall
  return {
    v: { x: (target.x - p0.x) / t, y: vy, z: (target.z - p0.z) / t },
    t,
  }
}

// Compute a full play plan for the selected signal + hitter position.
// `customHeight` (arc apex above net) overrides the set arc.
// `spikeTarget` ({x, z}) directs the spike landing on the opponent court.
// `feedFrom` ({x,z}, Team A side) moves the first (pass) ball origin here.
// Returns timings + ball parameters.
export function planPlay(signal, setterPos, hitterPos, netY, realisticTiming, spikeTarget = null, customHeight = null, feedFrom = null) {
  let passEnd = 0.28 // pass reaches the setter
  const contactHold = 0.2 // ~0.2s of hands-on-ball contact (realistic feel)
  const releaseAt = passEnd + contactHold // ball leaves the setter's hands
  const approachDur = tempoTable(signal.tempo ?? 1, TEMPO_APPROACH)
  const riseTime = 0.16 // jump launch -> apex

  // Ball target: contact point above hitter position, ~0.55m above net height
  const contactY = netY + 0.55
  const ballTarget = { x: hitterPos.x, y: contactY, z: hitterPos.z }

  // Setter release velocity from setter hands
  const setHands = { x: setterPos.x, y: (setterPos.y || 0) + 1.9, z: setterPos.z }

  let setFlight, vSet
  if (customHeight != null) {
    // User-set arc: ball peaks above the net at netY + customHeight then
    // descends into the hitter's hands at contact height.
    const { v, t } = velocityToArc(setHands, ballTarget, netY + customHeight)
    vSet = v
    setFlight = t
  } else if (realisticTiming) {
    // Elite quick timing: ball flight matches tempo directly.
    setFlight = tempoTable(signal.tempo ?? 1, TEMPO_SETFLIGHT)
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  } else {
    // Presentation mode: ball flight stretches to fit the approach.
    setFlight = approachDur + 0.05 + riseTime
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  }

  let approachStart, jumpAt, contactAt
  if (customHeight != null) {
    // Arc determines flight; sync approach/jump to arrival.
    contactAt = releaseAt + setFlight
    jumpAt = contactAt - riseTime
    if (realisticTiming) {
      approachStart = Math.max(0, jumpAt - approachDur)
    } else {
      approachStart = Math.max(0, Math.min(releaseAt + 0.05, jumpAt - approachDur))
    }
  } else if (realisticTiming) {
    contactAt = releaseAt + setFlight
    jumpAt = contactAt - riseTime
    approachStart = Math.max(0, jumpAt - approachDur)
  } else {
    contactAt = releaseAt + setFlight
    approachStart = releaseAt + 0.05
    jumpAt = approachStart + approachDur
  }

  // Spike: ball leaves hitter hands, launched down-forward to opponent court
  let vSpike
  if (spikeTarget) {
    const land = { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z }
    vSpike = velocityToReach(ballTarget, land, 0.42)
  } else {
    const spikeSpeed = 22
    const dir = { x: -0.6, y: -1.1, z: 2 }
    const inv = Math.hypot(dir.x, dir.y, dir.z)
    vSpike = {
      x: (dir.x / inv) * spikeSpeed,
      y: (dir.y / inv) * spikeSpeed,
      z: (dir.z / inv) * spikeSpeed,
    }
  }

  // Feed / pass phase: the first touch that delivers the ball to the setter.
  // If `feedFrom` is given the ball is launched from there with a friendly
  // 3m+ arc (drill mode); otherwise a short crisp pass from the court.
  let feedV
  let passP0
  if (feedFrom) {
    const pf = { x: feedFrom.x, y: 1.4, z: feedFrom.z }
    const { v } = velocityToArc(pf, setHands, Math.max(2.6, (setHands.y + 1.6)))
    feedV = v
    passP0 = pf
    passEnd = (2 * (Math.max(2.6, setHands.y + 1.6) - 1.4) / GRAVITY) + Math.sqrt((2 * (Math.max(2.6, setHands.y + 1.6) - setHands.y)) / GRAVITY)
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

// Pick which receiver should play the ball based on where the serve lands.
// Professional bias: deep serves (past the attack line) are taken by back-row
// passers; short serves by the front row.
export function pickReceiver(lineup, landing, positions) {
  let best = null
  let bestD = Infinity
  const isDeep = landing.z < -2.4
  for (const p of lineup) {
    if (p.isSetter) continue // setter is off the ball for first touch
    const pos = positions[p.role]
    if (!pos) continue
    const dx = pos[0] - landing.x
    const dz = pos[1] - landing.z
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

// Build a complete professional serve-receive sequence:
//   serve (Team B) -> receiver pass -> setter set -> hitter spike -> land.
export function planServeReceive({
  lineupA, lineupB, receiveFormation, serveLanding, setterRole, hitterRole,
  signal, netY, spikeTarget, customHeight, realisticTiming, netDist = 1.5,
  manuallyReceiver = null,
}) {
  const setterPos = { x: 0.5, z: -1.2 }
  const setter = lineupA.find((p) => p.role === setterRole) || lineupA.find((p) => p.isSetter)
  const hitter = lineupA.find((p) => p.role === hitterRole) || lineupA[0]
  const hRow = hitter && !hitter.isFrontRow ? 'back' : 'front'
  const hz = hRow === 'back' ? -Math.max(netDist, 3.2) : -netDist
  const hs = { x: (signal.zone === 4 ? -2.9 : signal.zone === 2 ? 2.9 : 0), z: hz }
  const hitterPos = { x: hs.x, z: hs.z }
  const contactY = netY + 0.55
  const ballTarget = { x: hitterPos.x, y: contactY, z: hitterPos.z }
  const setHands = { x: setterPos.x, y: 2.05, z: setterPos.z }

  // --- Serve ---
  const serveRelease = 0.45
  const serveP0 = { x: 0.6, y: 2.5, z: 9.6 }
  const serveLand = { x: serveLanding.x, y: BALL_R, z: serveLanding.z }
  const distS = Math.hypot(serveLand.x - serveP0.x, serveLand.z - serveP0.z)
  const serveFlight = (distS / 17) * 2.3
  const serveV = velocityToReach(serveP0, serveLand, serveFlight)
  const serveLandAt = serveRelease + serveFlight

  // --- Pass (receiver -> setter) ---
  const receiver =
    (manuallyReceiver && lineupA.find((p) => p.role === manuallyReceiver && !p.isSetter)) ||
    pickReceiver(lineupA, serveLanding, receiveFormation)
  const receiverRole = receiver.role
  const passP0 = { x: serveLanding.x, y: 1.5, z: serveLanding.z }
  const passHold = 0.12
  const passRelease = serveLandAt + passHold
  const passApex = 3.4
  const passFlight = (2 * (passApex - passP0.y) / GRAVITY) + Math.sqrt(2 * (passApex - setHands.y) / GRAVITY)
  const passV = velocityToArc(passP0, setHands, passApex).v
  const passLandAt = passRelease + passFlight

  // --- Set ---
  let setFlight, vSet
  if (customHeight != null) {
    const { v, t } = velocityToArc(setHands, ballTarget, netY + customHeight)
    vSet = v
    setFlight = t
  } else if (realisticTiming) {
    setFlight = tempoTable(signal.tempo ?? 1, TEMPO_SETFLIGHT)
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  } else {
    setFlight = tempoTable(signal.tempo ?? 1, TEMPO_SETFLIGHT) + 0.12
    vSet = velocityToReach(setHands, ballTarget, setFlight)
  }
  const setHold = 0.2
  const setRelease = passLandAt + setHold
  const setLandAt = setRelease + setFlight

  // --- Spike ---
  const spikeFlight = 0.42
  const spikeV = velocityToReach(ballTarget, { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z }, spikeFlight)
  const spikeEnd = setLandAt + spikeFlight

  // Approach/jump sync to contact
  const approachDur = tempoTable(signal.tempo ?? 1, TEMPO_APPROACH)
  const riseTime = 0.16
  const jumpAt = setLandAt - riseTime
  const approachStart = Math.max(0, jumpAt - approachDur)

  return {
    mode: 'receive',
    totalEnd: spikeEnd + 0.3,
    serveRelease,
    serveFlight,
    serveLandAt,
    serve: { p0: serveP0, v: serveV, flightTime: serveFlight, releaseAt: serveRelease, landAt: serveLandAt, landPoint: serveLand, speed: 95 },
    receiverRole,
    receiverPos: serveLanding,
    pass: { p0: passP0, v: passV, flightTime: passFlight, releaseAt: passRelease, landAt: passLandAt },
    setterRole: setter.role,
    setterPos,
    setHands,
    set: { v: vSet, flightTime: setFlight, releaseAt: setRelease, landAt: setLandAt },
    hitterRole: hitter.role,
    hitterPos,
    ballTarget,
    contactAt: setLandAt,
    spike: { v: spikeV, flightTime: spikeFlight, landPoint: { x: spikeTarget.x, y: BALL_R, z: spikeTarget.z } },
    approachStart,
    jumpAt,
    isBackRow: hRow === 'back',
  }
}
