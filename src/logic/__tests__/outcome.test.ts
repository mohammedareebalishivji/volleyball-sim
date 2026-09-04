import { describe, it, expect } from 'vitest'
import {
  hashSeed, mulberry32, outcomeForPlay, errorChance, crossesNet,
  BLOCK_CHANCE, ACE_CHANCE, SERVE_OUT_CHANCE,
} from '../outcome'

describe('hashSeed', () => {
  it('is deterministic and spreads across keys', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
    expect(hashSeed('')).toBe(2166136261)
  })
})

describe('mulberry32', () => {
  it('produces a reproducible sequence in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 20; i++) {
      const va = a()
      const vb = b()
      expect(va).toBe(vb)
      expect(va).toBeGreaterThanOrEqual(0)
      expect(va).toBeLessThan(1)
    }
    const c = mulberry32(43)
    expect(c()).not.toBe(b())
  })
})

describe('outcomeForPlay', () => {
  it('is fully deterministic for the same key', () => {
    const input = { mode: 'attack' as const, key: 'a|4|false|1', blockPattern: 'double' as const, tempo: 2, serveType: 'topspin' as const }
    expect(outcomeForPlay(input)).toEqual(outcomeForPlay(input))
  })

  it('varies across different keys', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 24; i++) {
      const o = outcomeForPlay({ mode: 'attack' as const, key: `k${i}`, blockPattern: 'double' as const, tempo: 2, serveType: 'topspin' as const })
      seen.add(o.tag)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('a serve that clips the net is always a fault for the server', () => {
    const out = outcomeForPlay({
      mode: 'serve', key: 'net', blockPattern: 'none', tempo: 1, serveType: 'jump',
      serve: { p0: { x: 0, y: 2.2, z: -9 }, v: { x: 0.2, y: -1.2, z: 16 }, flightTime: 1.1, netY: 2.43 },
    })
    expect(out.winner).toBe('B')
    expect(out.tag).toBe('Net!')
  })

  it('a clean serve can be an ace, side-out, or out depending on the dice', () => {
    const tags = new Set<string>()
    const winners = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const o = outcomeForPlay({ mode: 'serve', key: `s${i}`, blockPattern: 'none', tempo: 1, serveType: 'float' })
      tags.add(o.tag)
      winners.add(o.winner)
    }
    expect(tags.has('Ace!')).toBe(true)
    expect(tags.has('Side-out')).toBe(true)
    expect(winners.has('A')).toBe(true)
    expect(winners.has('B')).toBe(true)
  })

  it('attack outcome resolves to a kill, block, or error with consistent winners', () => {
    for (let i = 0; i < 30; i++) {
      const o = outcomeForPlay({ mode: 'attack', key: `a${i}`, blockPattern: 'single', tempo: 2, serveType: 'topspin' })
      if (o.tag === 'Kill!') expect(o.winner).toBe('A')
      else expect(o.winner).toBe('B')
    }
  })

  it('receive mode shares the spike resolution', () => {
    for (let i = 0; i < 30; i++) {
      const o = outcomeForPlay({ mode: 'receive', key: `r${i}`, blockPattern: 'double', tempo: 1.5, serveType: 'jump' })
      expect(['Kill!', 'Blocked!', 'Spike out!']).toContain(o.tag)
    }
  })
})

describe('errorChance + tables', () => {
  it('quicker sets carry more error', () => {
    expect(errorChance(1)).toBeGreaterThan(errorChance(2))
    expect(errorChance(2)).toBeGreaterThanOrEqual(errorChance(3))
    expect(errorChance(0.5)).toBe(0.18)
    expect(errorChance(5)).toBe(0.04)
  })

  it('tables are finite and complete for every pattern/type', () => {
    for (const v of Object.values(BLOCK_CHANCE)) expect(Number.isFinite(v)).toBe(true)
    for (const v of Object.values(ACE_CHANCE)) expect(v).toBeGreaterThan(0)
    for (const v of Object.values(SERVE_OUT_CHANCE)) expect(v).toBeGreaterThan(0)
  })
})

describe('crossesNet', () => {
  it('agrees with netFault', () => {
    expect(crossesNet({ x: 0, y: 3.5, z: -5 }, { x: 0, y: 1.4, z: 9 }, 1.2, 2.43)).toBe(true)
    expect(crossesNet({ x: 0, y: 2.2, z: -9 }, { x: 0.2, y: -1.2, z: 16 }, 1.1, 2.43)).toBe(false)
  })
})
