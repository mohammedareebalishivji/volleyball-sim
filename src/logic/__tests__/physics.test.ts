import { describe, it, expect } from 'vitest'
import {
  GRAVITY, solve, solveDrag, velocityToReach, velocityToReachDrag,
  velocityToApex, velocityToArc, netFault, tempoTable, TEMPO_APPROACH,
  planPlay, pickReceiver, planServeReceive,
} from '../physics'
import { buildLineup } from '../rotation'
import { receivePositions } from '../tactics'
import type { Player, Vec2, Vec3 } from '../../types'

const p = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

describe('ballistic solver', () => {
  it('solve integrates gravity correctly', () => {
    const v = p(2, 5, -3)
    const t = 0.7
    const out = solve(p(0, 0, 0), v, t)
    expect(out.x).toBeCloseTo(v.x * t, 10)
    expect(out.z).toBeCloseTo(v.z * t, 10)
    expect(out.y).toBeCloseTo(v.y * t - 0.5 * GRAVITY * t * t, 10)
  })

  it('solveDrag starts at p0 and decelerates horizontally', () => {
    const t0 = solveDrag(p(0, 1, 0), p(10, 5, 0), 0, 0.4)
    expect(t0.x).toBeCloseTo(0, 10)
    expect(t0.y).toBeCloseTo(1, 10)
    const t1 = solveDrag(p(0, 1, 0), p(10, 5, 0), 1, 0.4)
    expect(t1.x).toBeLessThan(10)
    expect(t1.y).toBeGreaterThan(5 - 0.5 * GRAVITY)
  })

  it('velocityToReach lands exactly on target', () => {
    const p0 = p(1, 2, -3)
    const target = p(4, 0.1, 5)
    const t = 1.2
    const v = velocityToReach(p0, target, t)
    const at = solve(p0, v, t)
    expect(at.x).toBeCloseTo(target.x, 8)
    expect(at.y).toBeCloseTo(target.y, 8)
    expect(at.z).toBeCloseTo(target.z, 8)
  })

  it('velocityToReachDrag reaches the target under drag', () => {
    const p0 = p(0, 2, 0)
    const target = p(5, 0.1, 7)
    const t = 1.5
    const k = 0.3
    const v = velocityToReachDrag(p0, target, t, k)
    const at = solveDrag(p0, v, t, k)
    expect(at.x).toBeCloseTo(target.x, 8)
    expect(at.y).toBeCloseTo(target.y, 8)
    expect(at.z).toBeCloseTo(target.z, 8)
  })

  it('velocityToApex peaks at the requested height exactly at arrival time', () => {
    const p0 = p(0, 2, 0)
    const target = p(3, 0.1, 4)
    const apex = 5
    const t = 1.1
    const v = velocityToApex(p0, target, apex, t)
    const at = solve(p0, v, t)
    expect(at.x).toBeCloseTo(target.x, 8)
    expect(at.z).toBeCloseTo(target.z, 8)
    expect(at.y).toBeCloseTo(apex, 8)
  })

  it('velocityToArc reaches target and clears the apex', () => {
    const p0 = p(0, 2, -5)
    const target = p(0, 2.05, -1)
    const { v, t } = velocityToArc(p0, target, 4)
    const at = solve(p0, v, t)
    expect(at.x).toBeCloseTo(target.x, 8)
    expect(at.z).toBeCloseTo(target.z, 8)
    expect(at.y).toBeCloseTo(target.y, 8)
  })
})

describe('netFault', () => {
  it('flags a serve that clips the net', () => {
    // flat, downward serve crossing z=0 below net height
    expect(netFault(p(0, 2.2, -9), p(0.2, -1.2, 16), 1.1, 2.43)).toBe(true)
  })

  it('allows a clean lob over the net', () => {
    expect(netFault(p(0, 3.5, -5), p(0, 1.4, 9), 1.2, 2.43)).toBe(false)
  })

  it('faults when the ball never crosses the net plane', () => {
    expect(netFault(p(0, 2, -9), p(0, 0, 4), 2, 2.43)).toBe(true)
  })
})

describe('tempoTable', () => {
  it('interpolates between the documented tempo keys', () => {
    expect(tempoTable(1, TEMPO_APPROACH)).toBe(TEMPO_APPROACH[1])
    expect(tempoTable(3, TEMPO_APPROACH)).toBe(TEMPO_APPROACH[3])
    const mid = tempoTable(1.5, TEMPO_APPROACH)
    expect(mid).toBeGreaterThan(TEMPO_APPROACH[1])
    expect(mid).toBeLessThan(TEMPO_APPROACH[2])
  })

  it('clamps outside the range', () => {
    expect(tempoTable(0.2, TEMPO_APPROACH)).toBe(TEMPO_APPROACH[1])
    expect(tempoTable(9, TEMPO_APPROACH)).toBe(TEMPO_APPROACH[3])
  })
})

describe('planPlay', () => {
  const signal = { tempo: 2, zone: 4 }
  const netY = 2.43

  it('keeps the timeline strictly ordered', () => {
    const plan = planPlay(signal, { x: 0.5, z: -1.2 }, { x: -2.9, z: -1.5 }, netY, false)
    expect(plan.passEnd).toBeLessThan(plan.releaseAt)
    expect(plan.releaseAt).toBeLessThan(plan.approachStart)
    expect(plan.approachStart).toBeLessThan(plan.jumpAt)
    expect(plan.jumpAt).toBeLessThan(plan.contactAt)
    expect(plan.contactAt).toBe(plan.releaseAt + plan.setFlight)
  })

  it('launches the set so it reaches the ball target exactly at contact', () => {
    const plan = planPlay(signal, { x: 0.5, z: -1.2 }, { x: -2.9, z: -1.5 }, netY, true)
    const at = solve(plan.setHands, plan.vSet, plan.setFlight)
    expect(at.x).toBeCloseTo(plan.ballTarget.x, 6)
    expect(at.z).toBeCloseTo(plan.ballTarget.z, 6)
    expect(at.y).toBeCloseTo(plan.ballTarget.y, 6)
    expect(plan.ballTarget.y).toBeCloseTo(netY + 0.55, 8)
  })

  it('the spike lands at its target 0.42 s after contact', () => {
    const target = { x: 0, z: 4.6 }
    const plan = planPlay(signal, { x: 0.5, z: -1.2 }, { x: -2.9, z: -1.5 }, netY, true, target, null, null)
    const at = solve(plan.ballTarget, plan.vSpike, 0.42)
    expect(at.x).toBeCloseTo(target.x, 6)
    expect(at.z).toBeCloseTo(target.z, 6)
    expect(at.y).toBeCloseTo(0.105, 6)
  })

  it('custom height produces a slower, higher set', () => {
    const lo = planPlay(signal, { x: 0.5, z: -1.2 }, { x: -2.9, z: -1.5 }, netY, true, null, 0.9)
    const hi = planPlay(signal, { x: 0.5, z: -1.2 }, { x: -2.9, z: -1.5 }, netY, true, null, 3.2)
    expect(hi.setFlight).toBeGreaterThan(lo.setFlight)
    expect(hi.contactAt).toBeGreaterThan(lo.contactAt)
  })
})

describe('pickReceiver', () => {
  const lu: Player[] = buildLineup('5-1', 0)
  const pos = receivePositions(lu, 'w')

  it('never picks the setter', () => {
    const landing: Vec2 = [0.5, -1.2]
    const r = pickReceiver(lu, landing, pos)
    expect(r?.isSetter).toBe(false)
  })

  it('prefers a nearby back-row player on deep balls', () => {
    const deep: Vec2 = [0, -6]
    const r = pickReceiver(lu, deep, pos)
    expect(r?.role).not.toBe('S')
  })

  it('returns someone even in degenerate input', () => {
    const r = pickReceiver(lu, [3, -3], {})
    expect(r).toBeTruthy()
  })
})

describe('planServeReceive', () => {
  const lineupA = buildLineup('5-1', 0)
  const lineupB = buildLineup('5-1', 0)
  const opts = {
    lineupA,
    lineupB,
    receiveFormation: receivePositions(lineupA, 'w'),
    serveLanding: [0, -3.8] as Vec2,
    setterRole: 'S',
    hitterRole: 'OH1',
    signal: { tempo: 2, zone: 4 },
    netY: 2.43,
    spikeTarget: { x: 0, z: 4.6 },
    customHeight: null,
    realisticTiming: true,
    netDist: 1.5,
    manuallyReceiver: null,
  }

  it('serve lands on target, pass reaches the setter, set reaches the hitter, spike lands', () => {
    const plan = planServeReceive(opts)
    const serveAt = solve(plan.serve.p0, plan.serve.v, plan.serve.flightTime)
    expect(serveAt.x).toBeCloseTo(opts.serveLanding[0], 5)
    expect(serveAt.z).toBeCloseTo(opts.serveLanding[1], 5)
    expect(serveAt.y).toBeCloseTo(0.105, 5)

    const passAt = solve(plan.pass.p0!, plan.pass.v, plan.pass.flightTime)
    expect(passAt.x).toBeCloseTo(plan.setHands.x, 5)
    expect(passAt.z).toBeCloseTo(plan.setHands.z, 5)

    const setAt = solve(plan.setHands, plan.set.v, plan.set.flightTime)
    expect(setAt.x).toBeCloseTo(plan.ballTarget.x, 5)
    expect(setAt.z).toBeCloseTo(plan.ballTarget.z, 5)

    const spikeAt = solve(plan.ballTarget, plan.spike.v, plan.spike.flightTime)
    expect(spikeAt.x).toBeCloseTo(opts.spikeTarget.x, 5)
    expect(spikeAt.z).toBeCloseTo(opts.spikeTarget.z, 5)
  })

  it('timeline is ordered and finite', () => {
    const plan = planServeReceive(opts)
    const times = [plan.serveRelease, plan.serveLandAt, plan.pass.releaseAt, plan.pass.landAt, plan.set.releaseAt, plan.set.landAt]
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
    for (const t of times) expect(Number.isFinite(t)).toBe(true)
    // The ball reaches the hitter exactly when the spike "fires".
    expect(plan.contactAt).toBe(plan.set.landAt)
    expect(plan.totalEnd).toBeGreaterThan(plan.contactAt)
  })

  it('honors a manual receiver', () => {
    const plan = planServeReceive({ ...opts, manuallyReceiver: 'OH2' })
    expect(plan.receiverRole).toBe('OH2')
  })
})
