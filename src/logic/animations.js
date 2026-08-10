// Parametric pose system for the realistic humanoid players.
// All rotations in radians. Pose keys:
//   bounce   -> y offset of the whole body
//   leanX    -> torso forward lean (+ = chest down / forward)
//   leanZ    -> torso side lean
//   turn     -> body yaw (toward target / ball)
//   spine    -> lower-back arch (extra flexion from the hips)
//   headX, headY
//   hipL, hipR       -> thigh swing at hip (x rotation, + = leg forward)
//   kneeL, kneeR     -> knee bend (x rotation of shin, + = heel back)
//   ankleL, ankleR   -> foot point (+ = toes down)
//   legZL, legZR     -> slight leg abduction
//   armL/armR: { shX (forward swing), shZ (side raise, + out/up),
//                elbow (forearm bend), wrist (hand bend) }

export const poseIdle = (t, seed = 0) => ({
  bounce: Math.sin(t * 1.5 + seed) * 0.018 + 0.012,      // breathing
  leanX: 0.05 + Math.sin(t * 0.8 + seed) * 0.01,
  leanZ: Math.sin(t * 0.9 + seed) * 0.022,
  turn: Math.sin(t * 0.5 + seed) * 0.02,
  spine: 0,
  headX: 0,
  headY: Math.sin(t * 0.6 + seed) * 0.06,
  hipL: 0.05, hipR: 0.01, kneeL: 0.07, kneeR: 0.02, ankleL: 0, ankleR: 0,
  legZL: 0, legZR: 0,
  armL: { shX: -0.1, shZ: 0.15, elbow: 0.1, wrist: 0 },
  armR: { shX: -0.06, shZ: -0.18, elbow: 0.14, wrist: 0 },
})

// Running cycle. phase advances the cycle; opposite arm/leg swing.
export const poseRun = (phase, seed = 0) => {
  const s = Math.sin(phase)
  const s2 = Math.sin(phase + Math.PI)
  return {
    bounce: Math.abs(Math.sin(phase)) * 0.05 + 0.01,
    leanX: 0.28,
    leanZ: 0,
    turn: 0,
    spine: 0.08,
    headX: 0.16,
    headY: 0,
    hipL: s * 0.8, hipR: s2 * 0.8,
    kneeL: Math.max(0, Math.cos(phase)) * 1.1 + 0.3,
    kneeR: Math.max(0, Math.cos(phase + Math.PI)) * 1.1 + 0.3,
    ankleL: Math.max(0, Math.cos(phase + Math.PI)) * 0.25,
    ankleR: Math.max(0, Math.cos(phase)) * 0.25,
    legZL: 0, legZR: 0,
    armL: { shX: -s2 * 0.7, shZ: 0.22, elbow: 0.55, wrist: 0.1 },
    armR: { shX: -s * 0.7, shZ: -0.22, elbow: 0.55, wrist: 0.1 },
  }
}

// Approach = run then plant (last 22%): deep knee bend, arms drive back.
export const poseApproach = (phase, prog, seed = 0) => {
  if (prog < 0.78) return poseRun(phase, seed)
  const p = (prog - 0.78) / 0.22
  const s = Math.sin(phase)
  const base = poseRun(phase, seed)
  return {
    ...base,
    leanX: 0.2,
    bounce: base.bounce * 0.55,
    hipL: base.hipL * 0.4, hipR: base.hipR * 0.4,
    kneeL: 1.3 + p * 0.25, kneeR: 1.3 + p * 0.25,
    ankleL: 0.15 * p, ankleR: 0.15 * p,
    armL: { shX: -1.7 * p - 0.2, shZ: 0.55 * p, elbow: 0.95 * p + 0.1, wrist: 0.1 },
    armR: { shX: -1.7 * p - 0.2, shZ: -0.55 * p, elbow: 0.95 * p + 0.1, wrist: 0.1 },
  }
}

// Jump: crouch-launch then extend into the air; arms drive up; hitting arm
// cocks back with the shoulder, elbow high and back arched near the apex.
export const poseJump = (phase, prog, hitRight = true) => {
  const p = Math.min(1, Math.max(0, prog))
  const crouch = Math.max(0, 1 - p * 3)
  const armDrive = Math.min(1, p * 1.6)
  const rise = Math.min(1, p * 2.2)
  const hitArm = hitRight ? 'armR' : 'armL'
  const offArm = hitRight ? 'armL' : 'armR'
  const pose = {
    bounce: 0.5 * rise,
    leanX: 0.02 - 0.12 * rise,
    leanZ: 0,
    turn: 0,
    spine: 0,
    headX: -0.12,
    headY: 0,
    hipL: crouch * 0.5, hipR: crouch * 0.5,
    kneeL: crouch * 1.6, kneeR: crouch * 1.6,
    ankleL: 0.6 * rise, ankleR: 0.6 * rise,
    legZL: crouch * 0.12, legZR: crouch * 0.12,
    armL: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
    armR: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
  }
  const up = -Math.PI / 2 + 0.3
  pose[hitArm] = { shX: -0.25, shZ: up * armDrive, elbow: 0.5 * armDrive, wrist: 0.1 }
  pose[offArm] = { shX: -0.25, shZ: up * armDrive, elbow: 0.5 * armDrive, wrist: 0.1 }
  // hitting arm cocks back, elbow high near apex
  const cock = Math.max(0, (p - 0.55) / 0.45)
  pose[hitArm] = { shX: -0.5 - 0.8 * cock, shZ: -2.3 - 0.6 * cock, elbow: 1.95 + 0.4 * cock, wrist: 0.25 * cock }
  pose[offArm] = { shX: 0.25, shZ: -2.6, elbow: 0.12, wrist: 0.05 }
  pose.leanX = 0.02 - 0.12 * rise + 0.3 * cock
  pose.spine = 0.35 * cock
  pose.turn = hitRight ? 0.32 * cock : -0.32 * cock
  return pose
}

// Spike contact / whip: hitting arm snaps down-forward, hand snaps, back arches.
export const poseSpike = (phase, prog, hitRight = true) => {
  const p = Math.min(1, Math.max(0, prog))
  const hitArm = hitRight ? 'armR' : 'armL'
  const offArm = hitRight ? 'armL' : 'armR'
  const whip = p // 0 = cocked, 1 = snapped through
  const pose = {
    bounce: 0.55,
    leanX: 0.35 + 0.22 * whip,
    leanZ: 0,
    turn: (hitRight ? 0.5 : -0.5) * (0.6 + 0.4 * whip),
    spine: 0.5 * (1 - whip) + 0.14,
    headX: -0.22,
    headY: 0,
    hipL: 0.4 + 0.12 * whip, hipR: 0.4 + 0.12 * whip,
    kneeL: 0.2, kneeR: 0.2,
    ankleL: 0.28, ankleR: 0.28,
    legZL: 0, legZR: 0,
    armL: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
    armR: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
  }
  // hitting arm: cocked high behind the head then snapped down-forward
  pose[hitArm] = {
    shX: -1.15 + 2.75 * whip,
    shZ: -2.7 + 0.75 * whip,
    elbow: 2.35 - 1.95 * whip - 0.55 * Math.pow(whip, 3),
    wrist: 0.2 - 1.9 * whip,
  }
  pose[offArm] = { shX: 0.12, shZ: -2.55, elbow: 0.15, wrist: 0.08 }
  return pose
}

// Landing: absorb with bent knees and pointed-then-flexed ankles.
export const poseLand = (t, prog, seed = 0) => {
  const p = Math.min(1, Math.max(0, prog))
  const absorb = 1 - p
  return {
    bounce: 0.55 * (1 - p) * 0.9 + 0.02 * Math.sin(t * 2),
    leanX: 0.24 + 0.12 * absorb,
    leanZ: 0,
    turn: 0,
    spine: 0.1 * absorb,
    headX: 0.05,
    headY: 0,
    hipL: 0.32, hipR: 0.32,
    kneeL: 1.15 * absorb + 0.05, kneeR: 1.15 * absorb + 0.05,
    ankleL: 0.3 * (1 - p), ankleR: 0.3 * (1 - p),
    legZL: 0, legZR: 0,
    armL: { shX: -0.6, shZ: 0.35, elbow: 0.35, wrist: 0.1 },
    armR: { shX: -0.6, shZ: -0.35, elbow: 0.35, wrist: 0.1 },
  }
}

// Setter: hands triangle at forehead, absorb the ball, then extend to target.
// dirYaw = yaw toward the target zone.
export const poseSet = (phase, prog, dirYaw) => {
  const p = Math.min(1, Math.max(0, prog))
  let pose = {
    bounce: 0.05 * Math.sin(phase * 3),
    leanX: 0.08,
    leanZ: 0,
    turn: dirYaw,
    spine: 0.02,
    headX: -0.05,
    headY: dirYaw * 0.4,
    hipL: 0.1, hipR: 0.1,
    kneeL: 0.26, kneeR: 0.26,
    ankleL: 0, ankleR: 0,
    legZL: 0, legZR: 0,
    armL: { shX: 0.35, shZ: -2.15, elbow: 1.9, wrist: 0.15 },
    armR: { shX: 0.35, shZ: -2.15, elbow: 1.9, wrist: 0.15 },
  }
  if (p > 0.7) {
    const f = (p - 0.7) / 0.3
    pose.kneeL = 0.26 * (1 - f)
    pose.kneeR = 0.26 * (1 - f)
    pose.armL = { shX: 0.35 + 0.6 * f, shZ: -2.15 + 0.5 * f, elbow: 1.9 - 1.1 * f, wrist: 0.15 + 0.1 * f }
    pose.armR = { shX: 0.35 + 0.6 * f, shZ: -2.15 + 0.5 * f, elbow: 1.9 - 1.1 * f, wrist: 0.15 + 0.1 * f }
    pose.leanX = 0.08 + 0.14 * f
  } else if (p < 0.45) {
    const g = p / 0.45
    pose.kneeL = 0.08 + 0.18 * g
    pose.kneeR = 0.08 + 0.18 * g
    pose.armL.shZ = -1.45 + -0.7 * g
    pose.armR.shZ = -1.45 + -0.7 * g
  }
  return pose
}

// Serve: toss + arm swing. type: 'float'|'topspin'|'jump'|'jump-float'
export const poseServe = (phase, prog, type) => {
  const p = Math.min(1, Math.max(0, prog))
  const tossing = p < 0.4
  const hitProg = (p - 0.4) / 0.6
  const swing = Math.max(0, hitProg)
  const armR = tossing
    ? { shX: -0.4, shZ: -2.5, elbow: 0.45, wrist: -0.1 } // toss hand up
    : { shX: -3.0 + 2.9 * swing, shZ: -0.35, elbow: 2.4 - 2.2 * swing, wrist: 0.2 - 1.8 * swing } // windmill
  return {
    bounce: type === 'jump' ? Math.min(1, hitProg) * 0.5 : 0.02,
    leanX: tossing ? 0.1 : 0.3 * swing,
    leanZ: 0,
    turn: 0,
    spine: tossing ? 0 : 0.2 * swing,
    headX: tossing ? -0.2 : 0.05,
    headY: 0,
    hipL: tossing ? 0.05 : -0.35 * swing,
    hipR: tossing ? 0.05 : 0.35 * swing,
    kneeL: tossing ? 0.12 : 0.2,
    kneeR: tossing ? 0.12 : 0.2,
    ankleL: tossing ? 0 : 0.15 * swing,
    ankleR: tossing ? 0 : 0.15 * swing,
    legZL: 0, legZR: 0,
    armL: { shX: -0.25, shZ: -0.35, elbow: 0.4, wrist: 0.05 },
    armR,
  }
}

// Block: quick vertical jump at the net with both arms raised overhead,
// hands spread and slightly arched — the classic blocking stance.
export const poseBlock = (phase, prog, seed = 0) => {
  const p = Math.min(1, Math.max(0, prog))
  const rise = Math.min(1, p * 2.4)          // fast launch to apex
  const fall = Math.max(0, (p - 0.55) / 0.45) // after apex, settle back down
  const crouch = Math.max(0, 1 - p * 3.2)
  return {
    bounce: 0.52 * rise - 0.06 * fall,
    leanX: 0.12 + 0.06 * rise,
    leanZ: 0,
    turn: 0,
    spine: 0.05,
    headX: -0.1,
    headY: 0,
    hipL: crouch * 0.42, hipR: crouch * 0.42,
    kneeL: crouch * 1.55, kneeR: crouch * 1.55,
    ankleL: 0.4 * rise, ankleR: 0.4 * rise,
    legZL: 0.04, legZR: -0.04,
    armL: { shX: -0.12, shZ: -2.62, elbow: 0.16, wrist: 0.04 },
    armR: { shX: -0.12, shZ: -2.62, elbow: 0.16, wrist: 0.04 },
  }
}

// Blend two poses
export function lerpPose(a, b, t) {
  const k = Math.min(1, Math.max(0, t))
  const blend = (x, y) => x + (y - x) * k
  return {
    bounce: blend(a.bounce, b.bounce),
    leanX: blend(a.leanX, b.leanX),
    leanZ: blend(a.leanZ, b.leanZ),
    turn: blend(a.turn, b.turn),
    spine: blend(a.spine ?? 0, b.spine ?? 0),
    headX: blend(a.headX, b.headX),
    headY: blend(a.headY, b.headY),
    hipL: blend(a.hipL, b.hipL),
    hipR: blend(a.hipR, b.hipR),
    kneeL: blend(a.kneeL, b.kneeL),
    kneeR: blend(a.kneeR, b.kneeR),
    ankleL: blend(a.ankleL ?? 0, b.ankleL ?? 0),
    ankleR: blend(a.ankleR ?? 0, b.ankleR ?? 0),
    legZL: blend(a.legZL, b.legZL),
    legZR: blend(a.legZR, b.legZR),
    armL: {
      shX: blend(a.armL.shX, b.armL.shX),
      shZ: blend(a.armL.shZ, b.armL.shZ),
      elbow: blend(a.armL.elbow, b.armL.elbow),
      wrist: blend(a.armL.wrist ?? 0, b.armL.wrist ?? 0),
    },
    armR: {
      shX: blend(a.armR.shX, b.armR.shX),
      shZ: blend(a.armR.shZ, b.armR.shZ),
      elbow: blend(a.armR.elbow, b.armR.elbow),
      wrist: blend(a.armR.wrist ?? 0, b.armR.wrist ?? 0),
    },
  }
}
