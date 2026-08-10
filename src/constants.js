// FIVB zone conventions for one half-court (Team A defends z<0, net at z=0)
// Zone 1 = back right, Zone 2 = front right, Zone 3 = front middle,
// Zone 4 = front left, Zone 5 = back left, Zone 6 = back middle
// Court half is 9m x 9m. Attack line 3m from net.

// FIVB / VNL court is 18m x 9m; half court is 9m long x 9m wide.
// Attack line (3 m) runs parallel to the net. Net height: men 2.43 / women 2.24.

export const COURT_HALF = 4.5; // half of 9m wide
export const COURT_DEPTH = 9; // half of 18m deep
export const ATTACK_LINE = 3; // metres from net

// Home position (metres) for each zone on Team A's side (z negative side).
// Front row (2/3/4) sits near the net on the team's own side; back row (1/5/6) is deeper.
export const ZONE_POS = {
  1: [3.25, -4.5],
  2: [3.25, -1.4],
  3: [0, -1.4],
  4: [-3.25, -1.4],
  5: [-3.25, -4.5],
  6: [0, -4.5],
}

// Clockwise rotational order around the court starting front-left:
// 4 -> 3 -> 2 -> 1 -> 6 -> 5 -> 4
export const ZONES_LIST = [4, 3, 2, 1, 6, 5]

// The serve-receive/back-row zones
export const BACK_ZONES = new Set([1, 5, 6])

// Base lineup orders (position order = [Z4, Z3, Z2, Z1, Z6, Z5])
export const LINEUPS = {
  '5-1': ['OH1', 'MB1', 'OPP', 'S', 'MB2', 'OH2'],
  '6-2': ['OH1', 'MB1', 'S1', 'S2', 'MB2', 'OH2'],
}

export const ROLE_META = {
  S: { label: 'S', color: '#ffb300', short: 'Setter' },
  S1: { label: 'S', color: '#ffb300', short: 'Setter' },
  S2: { label: 'S', color: '#ffb300', short: 'Setter' },
  OH1: { label: 'OH1', color: '#2196f3', short: 'Outside Hitter' },
  OH2: { label: 'OH2', color: '#42a5f5', short: 'Outside Hitter' },
  MB1: { label: 'MB1', color: '#7e57c2', short: 'Middle Blocker' },
  MB2: { label: 'MB2', color: '#9575cd', short: 'Middle Blocker' },
  OPP: { label: 'OPP', color: '#ef5350', short: 'Opposite' },
  L: { label: 'L', color: '#26a69a', short: 'Libero' },
  DS: { label: 'DS', color: '#8d6e63', short: 'Def. Specialist' },
}

// Setter hand signals: set number, target zone, height (m above net), tempo, hitter
export const SIGNALS = [
  { id: 1, name: 'Set 1 (Quick)',     zone: 3, height: 0.9,  tempo: 1, hitter: 'MB',  cue: 'Closed fist, low behind the back' },
  { id: 2, name: 'Set 2 (Shoot)',     zone: 2, height: 1.6,  tempo: 1.5, hitter: 'OH/MB', cue: 'Fist, short shoot just outside the setter' },
  { id: 3, name: 'Set 3 (Medium)',    zone: 4, height: 2.6,  tempo: 2, hitter: 'OH',  cue: 'Open hand, three fingers up' },
  { id: 4, name: 'Set 4 (High Outside)', zone: 4, height: 4.6, tempo: 3, hitter: 'OH', cue: 'Full open hand, high' },
  { id: 5, name: 'Set 5 (Back Set High)', zone: 2, height: 4.6, tempo: 3, hitter: 'OPP', cue: 'Open hand behind the head (back set)' },
  { id: 6, name: 'Set 6 (Back Quick)', zone: 2, height: 0.9, tempo: 1, hitter: 'MB', cue: 'Two fingers behind the back (back quick)' },
  { id: 7, name: 'Slide',             zone: 2, height: 1.6, tempo: 1.5, hitter: 'MB', cue: 'Crossed fingers (slide to zone 2/3 gap)' },
]

// Serve types
export const SERVE_TYPES = [
  { id: 'float', name: 'Float Serve', speed: 55, desc: 'Minimal spin, knuckling path' },
  { id: 'topspin', name: 'Topspin Serve', speed: 80, desc: 'Fast, dipping trajectory' },
  { id: 'jump', name: 'Jump Serve', speed: 100, desc: 'Full approach + jump, most aggressive' },
  { id: 'jump-float', name: 'Jump Float', speed: 75, desc: 'Approach, no full jump, float behavior' },
]

// Spike landing targets on the opponent court (x, z)
export const SPIKE_TARGETS = [
  { id: 'left', name: 'Left', x: -2.6, z: 4.6 },
  { id: 'center', name: 'Center', x: 0, z: 4.6 },
  { id: 'right', name: 'Right', x: 2.6, z: 4.6 },
  { id: 'deep', name: 'Deep', x: 0, z: 6.6 },
]

// Zones available for custom combo set location
export const COMBO_ZONES = [
  { id: 4, name: 'Zone 4', label: 'Left' },
  { id: 3, name: 'Zone 3', label: 'Middle' },
  { id: 2, name: 'Zone 2', label: 'Right' },
]

// Blocking patterns the opponent (Team B) forms against the attack.
// `count` = number of blockers at the net.
export const BLOCK_PATTERNS = [
  { id: 'none', name: 'No block', count: 0 },
  { id: 'single', name: 'Single', count: 1 },
  { id: 'double', name: 'Double', count: 2 },
  { id: 'triple', name: 'Triple', count: 3 },
]
export const BLOCK_COLOR = '#ff9f43'

// Serve target zones on opponent court (x, z) with names
export const SERVE_TARGETS = [
  { id: 'seam-rb', name: 'Seam b/w receivers (deep 1)', x: 2.2, z: 3.2 },
  { id: 'seam-mid', name: 'Deep middle (zone 6)', x: 0, z: 3.4 },
  { id: 'short-23', name: 'Short zone 2/3 (front)', x: 1.8, z: 1.2 },
  { id: 'deep-lb', name: 'Deep left back (zone 5)', x: -2.6, z: 3.4 },
  { id: 'line', name: 'Line right back (zone 1)', x: 3.4, z: 3.0 },
]

// Where the opponent's serve lands on Team A's court (receive drill).
// Mirrored onto the defensive half (z < 0).
export const RECEIVE_TARGETS = [
  { id: 'seam-rb', name: 'Deep right (zone 1)', x: 2.6, z: -3.6 },
  { id: 'seam-mid', name: 'Deep middle (zone 6)', x: 0, z: -3.8 },
  { id: 'short-23', name: 'Short to zone 4', x: -1.8, z: -1.4 },
  { id: 'deep-lb', name: 'Deep left (zone 5)', x: -2.6, z: -3.6 },
  { id: 'line', name: 'Line (right side)', x: 3.4, z: -2.8 },
]

// Legal attacking zones (Team A half, net at z=0).
// Front-row hitters attack between the net and the 3m line.
// Back-row hitters must take off behind the 3m line (z < -ATTACK_LINE).
export const SPIKE_ZONE = {
  front: { label: 'Front-row zone', x: 4.5, z0: -ATTACK_LINE, z1: 0, color: '#66d9ff' },
  back: { label: 'Back-row zone', x: 4.5, z0: -COURT_DEPTH, z1: -ATTACK_LINE, color: '#ffd166' },
}

// The 3x3 grid cells used for manual ball placement (which "area" you want).
export const COURT_GRID = [
  // Team A rows (z < 0): front (near net), mid, deep
  ...[3, 2, 1].map((row) => ([-3, 0, 3]).map((x) => ({ x, z: -1.5 * row - 0.75, side: 'A' }))),
  // Team B rows (z > 0)
  ...[1, 2, 3].map((row) => ([-3, 0, 3]).map((x) => ({ x, z: 1.5 * row - 0.75, side: 'B' }))),
].flat()


// Camera presets: {name, position, target}
export const CAMERA_PRESETS = {
  tactical: { name: 'Tactical overhead', pos: [0, 16, 9], target: [0, 0, 0] },
  broadcast: { name: 'Sideline broadcast', pos: [0, 4.5, 16], target: [0, 1.4, 0] },
  setter: { name: 'Behind setter POV', pos: [0, 2.1, -6], target: [0, 2, 0.5] },
  hitter: { name: 'Hitter approach', pos: [-7.5, 3.5, 4], target: [-2, 2.2, -0.5] },
  serve: { name: 'Serve target POV', pos: [3.4, 3.2, -9.5], target: [0, 2.4, 2] },
}

export const TEAM_A_COLOR = '#1e5aa8'
export const TEAM_B_COLOR = '#b3261e'
export const LIBERO_COLOR = '#0f8f76'
export const NET_HEIGHTS = { men: 2.43, women: 2.24 }
