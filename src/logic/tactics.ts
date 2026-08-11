// Pure positioning / selection helpers shared by the plan builder and the
// per-frame animator. No three.js, no React — easy to unit test.

import { ZONE_POS, RECEIVE_TARGETS, SPIKE_TARGETS, ROLE_META, SIGNALS } from '../constants'
import type { Store, Vec2, Player, Signal, CustomCombo, PlayerEntry } from '../types'

export const ROSTERS: Record<'5-1' | '6-2', string[]> = {
  '5-1': ['S', 'OH1', 'OH2', 'MB1', 'MB2', 'OPP', 'L'],
  '6-2': ['S1', 'S2', 'OH1', 'OH2', 'MB1', 'MB2', 'L'],
}

const BENCH_A: Vec2 = [6.6, -8.6]
const BENCH_B: Vec2 = [6.6, 8.6]

export function makeEntries(roster: string[]): Map<string, PlayerEntry> {
  const m = new Map<string, PlayerEntry>()
  roster.forEach((role) => {
    m.set(role, {
      role,
      label: role,
      color: ROLE_META[role] ? ROLE_META[role].color : '#ffffff',
      pos: [0, 0],
      facing: 0,
      anim: 'idle',
      t: 0,
      prog: 0,
      phase: 'idle',
      dirYaw: 0,
      hitRight: true,
      seed: role.charCodeAt(0) * 0.13,
      serveType: 'topspin',
      hidden: false,
    })
  })
  return m
}

// Jump spot per set zone (hitting location near the net).
// `netDist` = how far off the net the set lands (m).
// Back-row attackers take off behind the 3m line instead.
export function jumpSpot(zone: number, isBackRow = false, netDist = 1.5): Vec2 {
  const x = zone === 4 ? -2.9 : zone === 2 ? 2.9 : 0
  const z = isBackRow ? -Math.max(netDist, 3.2) : -netDist
  return [x, z]
}

export function approachStart(zone: number, isBackRow = false, netDist = 1.5): Vec2 {
  const x = zone === 4 ? -3.4 : zone === 2 ? 3.4 : 0
  const z = (isBackRow ? -Math.max(netDist, 3.2) : -netDist) - 2.7
  return [x, z]
}

// Blocking spots for Team B at the net against a given set zone + pattern.
// Returns x positions (m). Blockers stand just off the centre line (z ≈ +0.4).
export function blockSpots(zone: number, pattern: 'none' | 'single' | 'double' | 'triple'): number[] {
  const counts: Record<string, number> = { single: 1, double: 2, triple: 3 }
  const n = counts[pattern] || 0
  if (!n) return []
  const cx = zone === 4 ? -2.9 : zone === 2 ? 2.9 : 0
  const spacing = zone === 3 ? 0.5 : 0.44
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(cx + (i - (n - 1) / 2) * spacing)
  return out
}

export function hitRight(_zone: number): boolean {
  // right-handed hitter for all; keep true
  return true
}

export function selectHitter(lineup: Player[], signal: Signal, exactRole: string | null = null): Player | undefined {
  if (exactRole) {
    const exact = lineup.find((p) => p.role === exactRole && p.role !== 'L')
    if (exact) return exact
  }
  // Exact role match first (used by custom combos), then prefix groups.
  const exact2 = lineup.find((p) => p.role === signal.hitter && p.role !== 'L')
  if (exact2) return exact2
  const want = signal.hitter.split('/').map((x) => x.trim())
  let match = lineup.filter((p) => want.some((w) => p.role.startsWith(w)) && p.role !== 'L')
  if (!match.length) match = lineup.filter((p) => p.role !== 'L')
  return match.find((p) => p.isFrontRow) || match[0]
}

// Build an effective signal from the custom-combo controls.
export function customSignal(combo: CustomCombo): Signal {
  return {
    id: 0,
    name: 'Custom Combo',
    zone: combo.zone,
    height: combo.height,
    tempo: combo.tempo,
    hitter: combo.hitter,
    cue: `Custom: ${combo.hitter} @ Z${combo.zone}`,
  }
}

// The setter's target spot (near the net, offset from the middle).
export function setterSpot(): Vec2 {
  return [0.5, -1.2]
}

export function customActive(s: Store): boolean {
  return s.customCombo.enabled || s.drill.enabled
}

// Resolve the effective signal (preset or custom combo) for the current state.
export function effectiveSignal(s: Store): Signal {
  return customActive(s) ? customSignal(s.customCombo) : SIGNALS.find((sg) => sg.id === s.signalId) || SIGNALS[3]
}

export function receivePositions(lineup: Player[], formation: 'w' | '2' | '5'): Record<string, Vec2> {
  const out: Record<string, Vec2> = {}
  const setters = lineup.filter((p) => p.isSetter)
  // The active setter (back-row setter in 6-2, the setter in 5-1) runs the offense
  const activeSetterPlayer = setters.find((p) => !p.isFrontRow) || setters[0]
  if (activeSetterPlayer) out[activeSetterPlayer.role] = [0.5, -1.2]
  const others = lineup.filter((p) => p !== activeSetterPlayer)
  const front = others.filter((p) => p.isFrontRow)
  const back = others.filter((p) => !p.isFrontRow)
  const lib = back.find((p) => p.role === 'L')
  const rest = back.filter((p) => p.role !== 'L')

  if (formation === 'w') {
    front.forEach((p) => { out[p.role] = [ZONE_POS[p.zone][0] * 0.9, -2.55] })
    if (lib) out[lib.role] = [0, -6.4]
    if (rest[0]) out[rest[0].role] = [-2.9, -5.2]
    if (rest[1]) out[rest[1].role] = [2.9, -5.2]
  } else if (formation === '2') {
    front.forEach((p) => { out[p.role] = [ZONE_POS[p.zone][0] * 0.85, -2.3] })
    if (rest[0]) out[rest[0].role] = [-3.1, -6.4]
    if (rest[1]) out[rest[1].role] = [3.1, -6.4]
    if (lib) out[lib.role] = [0, -6.7]
  } else {
    const slots: Vec2[] = [[-3.3, -4.4], [-2.0, -4.9], [0, -5.3], [2.0, -4.9], [3.3, -4.4]]
    others.slice().sort((a, b) => a.zone - b.zone).forEach((p, i) => {
      out[p.role] = slots[i] || [0, -5]
    })
  }
  return out
}

// Serve landing point (Team A half) used by receive mode.
export function receiveLanding(s: Store): Vec2 {
  if (s.manualReceiveTarget) return [s.manualReceiveTarget.x, s.manualReceiveTarget.z]
  const t = RECEIVE_TARGETS.find((t) => t.id === s.serveTarget) || RECEIVE_TARGETS[1]
  return [t.x, t.z]
}

// Spike landing point (Team B half) used by attack mode.
export function spikeLanding(s: Store, custom: boolean): Vec2 {
  if (s.drill.enabled) return s.drill.spikeLanding
  if (custom) {
    const t = SPIKE_TARGETS.find((t) => t.id === s.customCombo.spikeTarget) || SPIKE_TARGETS[1]
    return [t.x, t.z]
  }
  return [0, 4.6]
}

export { BENCH_A, BENCH_B }
