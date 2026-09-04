import { describe, it, expect } from 'vitest'
import {
  poseIdle, poseRun, poseApproach, poseJump, poseSpike, poseLand,
  poseSet, poseServe, poseBlock, lerpPose,
} from '../animations'
import type { Pose, ServeTypeId } from '../../types'

function expectFinitePose(p: Pose) {
  for (const key of ['bounce', 'leanX', 'leanZ', 'turn', 'spine', 'headX', 'headY',
    'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'legZL', 'legZR']) {
    expect(Number.isFinite(p[key as keyof Pose])).toBe(true)
  }
  for (const arm of [p.armL, p.armR]) {
    for (const k of ['shX', 'shZ', 'elbow', 'wrist']) expect(Number.isFinite(arm[k as keyof typeof arm])).toBe(true)
  }
}

describe('pose functions', () => {
  it('every pose is finite at all stages of its cycle', () => {
    for (const prog of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      expectFinitePose(poseIdle(0.3, 1))
      expectFinitePose(poseRun(1.2))
      expectFinitePose(poseApproach(1.2, prog, 0.5))
      expectFinitePose(poseJump(0, prog, true))
      expectFinitePose(poseJump(0, prog, false))
      expectFinitePose(poseSpike(0, prog, true))
      expectFinitePose(poseLand(0.2, prog))
      expectFinitePose(poseSet(0.4, prog, 0.3))
      expectFinitePose(poseServe(0.2, prog, 'topspin'))
      expectFinitePose(poseBlock(0.1, prog))
    }
  })

  it('the jump pose drives the hitting arm up and cocks it back near the apex', () => {
    const early = poseJump(0, 0.2, true)
    const apex = poseJump(0, 0.8, true)
    // arm raised toward vertical early (shZ far negative = raised overhead)
    expect(early.armR.shZ).toBeLessThan(-1)
    // near apex the hitting arm cocks back with a bent elbow
    expect(apex.armR.elbow).toBeGreaterThan(1.5)
    expect(apex.bounce).toBeGreaterThan(0.3)
  })

  it('the spike pose snaps the hitting arm down and forward', () => {
    const cocked = poseSpike(0, 0, true)
    const snapped = poseSpike(0, 1, true)
    expect(snapped.armR.shX).toBeGreaterThan(cocked.armR.shX)
    expect(snapped.armR.elbow).toBeLessThan(cocked.armR.elbow)
    expect(snapped.armR.wrist).toBeLessThan(cocked.armR.wrist)
  })

  it('blocking raises both arms overhead', () => {
    const p = poseBlock(0, 0.5)
    expect(p.armL.shZ).toBeLessThan(-2)
    expect(p.armR.shZ).toBeLessThan(-2)
  })

  it('a jump serve gets airborne while a float serve stays grounded', () => {
    const jump = poseServe(0, 0.9, 'jump')
    const float = poseServe(0, 0.9, 'float')
    expect(jump.bounce).toBeGreaterThan(float.bounce)
  })

  it('serve poses work for every serve type', () => {
    for (const type of ['float', 'topspin', 'jump', 'jump-float'] as ServeTypeId[]) {
      expectFinitePose(poseServe(0, 0.5, type))
    }
  })
})

describe('lerpPose', () => {
  it('returns a and b at the endpoints and interpolates between', () => {
    const a = poseIdle(0, 0)
    const b = poseJump(0, 0.8, true)
    const atA = lerpPose(a, b, 0)
    const atB = lerpPose(a, b, 1)
    const mid = lerpPose(a, b, 0.5)
    expect(atA.leanX).toBeCloseTo(a.leanX, 8)
    expect(atB.armR.elbow).toBeCloseTo(b.armR.elbow, 8)
    expect(mid.bounce).toBeCloseTo((a.bounce + b.bounce) / 2, 8)
    expectFinitePose(mid)
  })

  it('clamps t outside [0,1]', () => {
    expect(lerpPose(poseIdle(0), poseIdle(1), -1).bounce).toBeCloseTo(poseIdle(0).bounce, 8)
    expect(lerpPose(poseIdle(0), poseIdle(1), 2).bounce).toBeCloseTo(poseIdle(1).bounce, 8)
  })
})
