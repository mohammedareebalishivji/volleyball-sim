import { describe, it, expect } from 'vitest'
import {
  makeEntries, jumpSpot, approachStart, blockSpots, hitRight, selectHitter,
  customSignal, customActive, effectiveSignal, receivePositions, receiveLanding,
  spikeLanding, setterSpot, ROSTERS, BENCH_A, BENCH_B,
} from '../tactics'
import { buildLineup } from '../rotation'
import { RECEIVE_TARGETS, SPIKE_TARGETS } from '../../constants'
import type { Store } from '../../types'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

const storeFor = (overrides: DeepPartial<Store> = {}) => {
  const s = {
    customCombo: {
      enabled: false, hitter: 'OH1', zone: 4, height: 2.6, tempo: 1.5,
      spikeTarget: 'center' as const, netDist: 1.5,
    },
    drill: { enabled: false, firstBall: [0, -4.5], spikeLanding: [0, 4.5], showZones: true },
    manualReceiveTarget: null,
    serveTarget: 'seam-mid' as const,
    signalId: 4,
    receiveFormation: 'w' as const,
    ...overrides,
  } as unknown as Store
  return s
}

describe('makeEntries', () => {
  it('creates an entry per roster role with sane defaults', () => {
    const m = makeEntries(ROSTERS['5-1'])
    expect(m.size).toBe(ROSTERS['5-1'].length)
    for (const e of m.values()) {
      expect(e.pos).toEqual([0, 0])
      expect(e.anim).toBe('idle')
      expect(e.hidden).toBe(false)
      expect(Number.isFinite(e.seed)).toBe(true)
    }
    expect(m.get('L')?.role).toBe('L')
  })
})

describe('jumpSpot / approachStart', () => {
  it('front-row jump spots sit near the net, zone-dependent', () => {
    expect(jumpSpot(4, false, 1.5)).toEqual([-2.9, -1.5])
    expect(jumpSpot(2, false, 1.5)).toEqual([2.9, -1.5])
    expect(jumpSpot(3, false, 1.5)).toEqual([0, -1.5])
  })

  it('back-row jump spots respect the 3 m attack line', () => {
    expect(jumpSpot(4, true, 1.5)).toEqual([-2.9, -3.2])
    expect(jumpSpot(4, true, 3.5)[1]).toBe(-3.5)
  })

  it('approach starts 2.7 m behind the jump spot', () => {
    const [jx, jz] = jumpSpot(4, false, 1.5)
    const [ax, az] = approachStart(4, false, 1.5)
    expect(ax).toBe(jx - 0.5)
    expect(az).toBe(jz - 2.7)
  })
})

describe('blockSpots', () => {
  it('returns the requested number of blockers centered on the set zone', () => {
    expect(blockSpots(3, 'none')).toEqual([])
    expect(blockSpots(3, 'single')).toHaveLength(1)
    expect(blockSpots(3, 'double')).toHaveLength(2)
    expect(blockSpots(3, 'triple')).toHaveLength(3)
    const spots = blockSpots(4, 'double')
    expect(spots[0]).toBeCloseTo(-3.12, 10)
    expect(spots[1]).toBeCloseTo(-2.68, 10)
  })
})

describe('selectHitter', () => {
  it('exact role wins, libero is never a hitter', () => {
    const lu = buildLineup('5-1', 0)
    const sig = { id: 1, name: 'x', zone: 3, height: 0.9, tempo: 1, hitter: 'MB', cue: '' }
    const h = selectHitter(lu, sig, 'OH1')
    expect(h?.role).toBe('OH1')
    expect(h?.role).not.toBe('L')
  })

  it('falls back to a front-row hitter matching the signal prefix', () => {
    const lu = buildLineup('5-1', 0)
    // R0: OH1@Z4F, MB1@Z3F, OPP@Z2F, S@Z1B, L@Z6B, OH2@Z5B
    const sig = { id: 3, name: 'x', zone: 4, height: 2.6, tempo: 2, hitter: 'OH', cue: '' }
    const h = selectHitter(lu, sig)
    expect(['OH1', 'OH2']).toContain(h?.role)
    expect(h?.isFrontRow).toBe(true)
  })
})

describe('customSignal / customActive / effectiveSignal', () => {
  it('builds a custom signal from the combo controls', () => {
    const sig = customSignal(storeFor().customCombo)
    expect(sig.zone).toBe(4)
    expect(sig.hitter).toBe('OH1')
    expect(sig.name).toContain('Custom')
  })

  it('customActive is true when combo or drill is on', () => {
    expect(customActive(storeFor())).toBe(false)
    expect(customActive(storeFor({ customCombo: { enabled: true } }))).toBe(true)
    expect(customActive(storeFor({ drill: { enabled: true } }))).toBe(true)
  })

  it('effectiveSignal picks preset or custom', () => {
    expect(effectiveSignal(storeFor()).id).toBe(4)
    expect(effectiveSignal(storeFor({ customCombo: { enabled: true, hitter: 'OH1' } })).name).toContain('Custom')
  })
})

describe('receivePositions', () => {
  it('W formation keeps the setter in, libero deep-middle, front row shallow', () => {
    const lu = buildLineup('5-1', 0)
    const pos = receivePositions(lu, 'w')
    const setter = lu.find((p) => p.isSetter)!
    expect(pos[setter.role]).toEqual([0.5, -1.2])
    const l = lu.find((p) => p.role === 'L')!
    expect(pos[l.role]).toEqual([0, -6.4])
    for (const p of lu.filter((x) => x.isFrontRow && !x.isSetter)) {
      expect(pos[p.role][1]).toBeCloseTo(-2.55, 5)
    }
  })

  it('every on-court player gets a receive position', () => {
    for (const f of ['w', '2', '5']) {
      const lu = buildLineup('5-1', 2)
      const pos = receivePositions(lu, f as 'w' | '2' | '5')
      for (const p of lu) expect(pos[p.role]).toBeTruthy()
    }
  })
})

describe('landing helpers', () => {
  it('receiveLanding uses the preset or the manual target', () => {
    const t = RECEIVE_TARGETS.find((x) => x.id === 'seam-mid')!
    expect(receiveLanding(storeFor())).toEqual([t.x, t.z])
    expect(receiveLanding(storeFor({ manualReceiveTarget: { x: 1, z: -2 } }))).toEqual([1, -2])
  })

  it('spikeLanding respects drill, custom target, and defaults', () => {
    expect(spikeLanding(storeFor(), false)).toEqual([0, 4.6])
    const t = SPIKE_TARGETS.find((x) => x.id === 'left')!
    expect(spikeLanding(storeFor({ customCombo: { enabled: true, spikeTarget: 'left' } }), true)).toEqual([t.x, t.z])
    expect(spikeLanding(storeFor({ drill: { enabled: true, spikeLanding: [2, 3] } }), true)).toEqual([2, 3])
  })

  it('hitRight is always true and setterSpot is off the middle', () => {
    expect(hitRight(4)).toBe(true)
    expect(setterSpot()).toEqual([0.5, -1.2])
  })
})

describe('bench spots', () => {
  it('bench positions exist and are off-court', () => {
    expect(Math.abs(BENCH_A[1])).toBeGreaterThan(7)
    expect(Math.abs(BENCH_B[1])).toBeGreaterThan(7)
  })
})
