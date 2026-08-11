import { ZONES_LIST, BACK_ZONES } from '../constants'
import type { System, Player } from '../types'

// Returns the zone number for a lineup index under a given rotation (0-5).
export function zoneForIndex(index: number, rotation: number): number {
  return ZONES_LIST[(index + rotation) % 6]
}

// Build the full on-court lineup for a system + rotation, applying libero
// substitution for any middle blocker in a back-row zone.
export function buildLineup(system: System, rotation: number): Player[] {
  const order = system === '5-1' ? ['OH1', 'MB1', 'OPP', 'S', 'MB2', 'OH2'] : ['OH1', 'MB1', 'S1', 'S2', 'MB2', 'OH2']
  const players: Player[] = order.map((role, i) => {
    const zone = zoneForIndex(i, rotation)
    return {
      key: `${role}-${i}`,
      role,
      zone,
      label: role,
      isSetter: role.startsWith('S'),
      isFrontRow: !BACK_ZONES.has(zone),
    }
  })

  // Libero substitution: replace back-row middles
  const result: Player[] = players.map((p) => ({ ...p }))
  let liberoUsed = false
  for (const p of result) {
    if ((p.role === 'MB1' || p.role === 'MB2') && BACK_ZONES.has(p.zone) && !liberoUsed) {
      p.role = 'L'
      p.isLiberoSub = true
      p.label = 'L'
      liberoUsed = true
    }
  }

  for (const p of result) {
    const isSetter = p.role.startsWith('S')
    p.label = isSetter ? (p.role === 'S' ? 'S' : p.role) : p.role
    p.isSetter = isSetter
    p.isFrontRow = !BACK_ZONES.has(p.zone)
  }
  return result
}

// Active setter for a system: in 6-2 the back-row setter runs the offense.
export function activeSetter(system: System, lineup: Player[]): Player | undefined {
  if (system === '5-1') return lineup.find((p) => p.role === 'S')
  // 6-2: the setter in a back-row zone sets; the front-row one hits
  return lineup.find((p) => p.role.startsWith('S') && !p.isFrontRow) || lineup.find((p) => p.role.startsWith('S'))
}

// Human-readable rotation description
export function rotationLabel(system: System, rotation: number): string {
  const names = ['Rotation 1', 'Rotation 2', 'Rotation 3', 'Rotation 4', 'Rotation 5', 'Rotation 6']
  return `${names[rotation]} (${system})`
}

// Role description for the 6-2 transition callout
export function setterRoleNote(system: System, _role: string, isFrontRow: boolean): string | null {
  if (system !== '6-2') return null
  return isFrontRow ? 'Setter entering front row → attacking role' : 'Setter entering back row → setting role'
}
