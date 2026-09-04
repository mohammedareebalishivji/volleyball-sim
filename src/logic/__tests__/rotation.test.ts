import { describe, it, expect } from 'vitest'
import { zoneForIndex, buildLineup, activeSetter, rotationLabel, setterRoleNote, liberoCoverFor, liberoSwapBetween, liberoCoverageTable } from '../rotation'
import { ZONES_LIST, BACK_ZONES } from '../../constants'
import type { System } from '../../types'

describe('zoneForIndex', () => {
  it('maps lineup index -> FIVB zone under a rotation', () => {
    expect(zoneForIndex(0, 0)).toBe(4)
    expect(zoneForIndex(1, 0)).toBe(3)
    expect(zoneForIndex(2, 0)).toBe(2)
    expect(zoneForIndex(3, 0)).toBe(1)
    expect(zoneForIndex(4, 0)).toBe(6)
    expect(zoneForIndex(5, 0)).toBe(5)
    for (let r = 0; r < 6; r++) {
      for (let i = 0; i < 6; i++) {
        expect(zoneForIndex(i, r)).toBe(ZONES_LIST[(i + r) % 6])
      }
    }
  })

  it('wraps rotations mod 6', () => {
    expect(zoneForIndex(0, 6)).toBe(zoneForIndex(0, 0))
    expect(zoneForIndex(2, 7)).toBe(zoneForIndex(2, 1))
  })
})

describe('buildLineup', () => {
  it('assigns every player to a distinct zone across the rotation cycle', () => {
    for (const system of ['5-1', '6-2'] as System[]) {
      for (let r = 0; r < 6; r++) {
        const lu = buildLineup(system, r)
        expect(lu).toHaveLength(6)
        const zones = lu.map((p) => p.zone)
        expect(new Set(zones).size).toBe(6)
        expect(zones.sort()).toEqual([1, 2, 3, 4, 5, 6])
        for (const p of lu) {
          expect(p.isFrontRow).toBe(!BACK_ZONES.has(p.zone))
        }
      }
    }
  })

  it('has the right number of setters on court per system', () => {
    for (const system of ['5-1', '6-2'] as System[]) {
      for (let r = 0; r < 6; r++) {
        const lu = buildLineup(system, r)
        // 5-1 plays one setter; 6-2 plays two setters and the back-row one sets.
        expect(lu.filter((p) => p.isSetter)).toHaveLength(system === '5-1' ? 1 : 2)
      }
    }
  })
})

describe('libero substitution', () => {
  it('puts the libero in ONLY when a middle blocker sits in a back-row zone', () => {
    for (const system of ['5-1', '6-2'] as System[]) {
      for (let r = 0; r < 6; r++) {
        const lu = buildLineup(system, r)
        const l = lu.filter((p) => p.role === 'L')
        const subbedMiddles = lu.filter((p) => p.isLiberoSub)
        // In both systems one middle is always back-row, so the libero is always in.
        expect(l).toHaveLength(1)
        // The libero must occupy a back-row zone (illegal in front row).
        expect(BACK_ZONES.has(l[0].zone)).toBe(true)
        // The covered player must be a middle blocker.
        expect(subbedMiddles).toHaveLength(1)
        expect(subbedMiddles[0].role).toBe('L')
      }
    }
  })

  it('never lets a middle blocker play the libero in the front row', () => {
    for (const system of ['5-1', '6-2'] as System[]) {
      for (let r = 0; r < 6; r++) {
        const lu = buildLineup(system, r)
        for (const p of lu) {
          if (p.role === 'L') expect(p.isFrontRow).toBe(false)
          if ((p.role === 'MB1' || p.role === 'MB2') && p.isFrontRow) {
            expect(p.role).not.toBe('L')
          }
        }
      }
    }
  })

  it('tracks which middle blocker the libero covers', () => {
    // 5-1 order: OH1 MB1 OPP S MB2 OH2
    const coverage: string[] = []
    for (let r = 0; r < 6; r++) {
      const lu = buildLineup('5-1', r)
      const l = lu.find((p) => p.role === 'L')
      coverage.push(l?.subbedFor ?? '?')
    }
    // MB2 is back-row (covers libero) in rotations 0,1,5; MB1 in 2,3,4.
    expect(coverage).toEqual(['MB2', 'MB2', 'MB1', 'MB1', 'MB1', 'MB2'])
  })

  it('swaps the libero between middles exactly when a covered middle rotates to the front row', () => {
    const prevCoverage: (string | undefined)[] = []
    for (let r = 0; r < 6; r++) prevCoverage.push(buildLineup('5-1', r).find((p) => p.role === 'L')?.subbedFor)
    for (let r = 0; r < 6; r++) {
      const next = buildLineup('5-1', (r + 1) % 6)
      const prev = prevCoverage[r]
      const nxt = next.find((p) => p.role === 'L')?.subbedFor
      // `key` keeps the original role even after the libero rename, so we can
      // ask where the previously covered middle now stands.
      const coveredNow = next.find((p) => p.key.startsWith(prev || ''))
      if (prev !== nxt) {
        // Libero left: the middle it covered rotated to the front row.
        expect(coveredNow?.isFrontRow).toBe(true)
      } else {
        // No swap: the covered middle is still back-row.
        expect(coveredNow?.isFrontRow).toBe(false)
      }
    }
  })
})

describe('activeSetter', () => {
  it('5-1 always picks the single setter', () => {
    for (let r = 0; r < 6; r++) {
      const lu = buildLineup('5-1', r)
      expect(activeSetter('5-1', lu)?.role).toBe('S')
    }
  })

  it('6-2 picks the back-row setter, falling back to any setter', () => {
    for (let r = 0; r < 6; r++) {
      const lu = buildLineup('6-2', r)
      const setter = activeSetter('6-2', lu)
      expect(['S1', 'S2']).toContain(setter?.role)
      if (lu.find((p) => p.isSetter && !p.isFrontRow)) {
        expect(setter?.isFrontRow).toBe(false)
      }
    }
  })
})

describe('labels + notes', () => {
  it('rotationLabel describes the rotation', () => {
    expect(rotationLabel('5-1', 0)).toContain('Rotation 1')
    expect(rotationLabel('5-1', 5)).toContain('Rotation 6')
  })

  it('setterRoleNote only fires for 6-2', () => {
    expect(setterRoleNote('5-1', 'S', true)).toBeNull()
    expect(setterRoleNote('6-2', 'S2', true)).toContain('front row')
    expect(setterRoleNote('6-2', 'S2', false)).toContain('back row')
  })
})

describe('libero swap helpers', () => {
  it('liberoCoverFor reports the covered middle (or null on the bench)', () => {
    expect(liberoCoverFor(buildLineup('5-1', 0))).toBe('MB2')
    expect(liberoCoverFor(buildLineup('5-1', 2))).toBe('MB1')
    // A lineup with no libero has no coverage.
    expect(liberoCoverFor(buildLineup('5-1', 0).filter((p) => p.role !== 'L'))).toBeNull()
  })

  it('liberoSwapBetween describes the relay exactly when coverage changes', () => {
    const r1 = buildLineup('5-1', 1) // covers MB2
    const r2 = buildLineup('5-1', 2) // covers MB1
    expect(liberoSwapBetween(r1, r2)).toBe('MB2 ↔ MB1')
    expect(liberoSwapBetween(r2, r1)).toBe('MB1 ↔ MB2')
    // Same coverage -> no swap
    expect(liberoSwapBetween(r1, r1)).toBeNull()
    expect(liberoSwapBetween(buildLineup('5-1', 0), buildLineup('5-1', 1))).toBeNull()
  })

  it('coverage table spans all six rotations with the expected relay points', () => {
    const table = liberoCoverageTable('5-1')
    expect(table).toHaveLength(6)
    expect(table.map((t) => t.covers)).toEqual(['MB2', 'MB2', 'MB1', 'MB1', 'MB1', 'MB2'])
    // Only two swap events across the full cycle (2<->1 and 5->0 neighbours).
    const swaps = []
    for (let i = 0; i < 6; i++) {
      const a = table[i].covers
      const b = table[(i + 1) % 6].covers
      if (a !== b) swaps.push(`${a}->${b}`)
    }
    expect(swaps).toEqual(['MB2->MB1', 'MB1->MB2'])
  })

  it('6-2 shares the same relay behaviour', () => {
    const table = liberoCoverageTable('6-2')
    expect(table.map((t) => t.covers)).toEqual(['MB2', 'MB2', 'MB1', 'MB1', 'MB1', 'MB2'])
  })
})
