// Deterministic rally outcomes. Each play configuration (mode + plan key)
// resolves to exactly one outcome, so replays of the same play always agree
// while different plays produce varied results.
//
// Probabilities reflect the real game: harder quick attacks and aggressive
// jump serves carry more error, and more blockers mean a higher block chance.

import type { Outcome, BlockPatternId, ServeTypeId, Vec3 } from '../types'
import { netFault } from './physics'

export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const BLOCK_CHANCE: Record<BlockPatternId, number> = { none: 0, single: 0.18, double: 0.32, triple: 0.45 }
export const ACE_CHANCE: Record<ServeTypeId, number> = { float: 0.12, topspin: 0.16, jump: 0.22, 'jump-float': 0.14 }
export const SERVE_OUT_CHANCE: Record<ServeTypeId, number> = { float: 0.07, topspin: 0.09, jump: 0.12, 'jump-float': 0.08 }

// Hitters get riskier as the set gets flatter / quicker.
export function errorChance(tempo: number): number {
  if (tempo <= 1.3) return 0.18
  if (tempo >= 3) return 0.04
  return 0.08
}

export interface OutcomeInput {
  mode: 'attack' | 'receive' | 'serve'
  key: string
  blockPattern: BlockPatternId
  tempo: number
  serveType: ServeTypeId
  // serve geometry — used for deterministic net faults
  serve?: { p0: Vec3; v: Vec3; flightTime: number; netY: number }
}

export function outcomeForPlay(input: OutcomeInput): Outcome {
  const rnd = mulberry32(hashSeed(input.key))
  const mode = input.mode

  if (mode === 'serve') {
    const outChance = SERVE_OUT_CHANCE[input.serveType]
    const aceChance = ACE_CHANCE[input.serveType]
    // A serve that clips the net is always a fault, no matter what the dice say.
    if (input.serve && netFault(input.serve.p0, input.serve.v, input.serve.flightTime, input.serve.netY)) {
      return { winner: 'B', tag: 'Net!', reason: 'The serve caught the net' }
    }
    const r = rnd()
    if (r < outChance) return { winner: 'B', tag: 'Serve out!', reason: 'The serve sailed long or wide' }
    if (r < outChance + aceChance) return { winner: 'A', tag: 'Ace!', reason: 'The serve was untouchable' }
    return { winner: 'B', tag: 'Side-out', reason: 'Team B passed the serve cleanly' }
  }

  // attack + receive share the spike resolution
  const blockChance = BLOCK_CHANCE[input.blockPattern]
  const error = errorChance(input.tempo)
  const r = rnd()
  if (r < blockChance) return { winner: 'B', tag: 'Blocked!', reason: 'Team B roofed the attack at the net' }
  if (r < blockChance + error) return { winner: 'B', tag: 'Spike out!', reason: 'The spike missed the court' }
  return { winner: 'A', tag: 'Kill!', reason: 'The spike landed untouched' }
}

// Sanity check helper used by tests: does a (pure parabolic) serve cross the net?
export function crossesNet(p0: Vec3, v: Vec3, flight: number, netY: number): boolean {
  return !netFault(p0, v, flight, netY)
}
