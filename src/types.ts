export type Vec2 = [number, number]

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type System = '5-1' | '6-2'
export type Mode = 'attack' | 'receive' | 'serve'
export type NetHeight = 'men' | 'women'
export type ReceiveFormation = 'w' | '2' | '5'
export type BlockPatternId = 'none' | 'single' | 'double' | 'triple'
export type ServeTypeId = 'float' | 'topspin' | 'jump' | 'jump-float'
export type SpikeTargetId = 'left' | 'center' | 'right' | 'deep'
export type ServeTargetId = 'seam-rb' | 'seam-mid' | 'short-23' | 'deep-lb' | 'line'
export type CameraPresetId = 'tactical' | 'broadcast' | 'setter' | 'hitter' | 'serve'

export interface Signal {
  id: number
  name: string
  zone: number
  height: number
  tempo: number
  hitter: string
  cue: string
}

export interface ServerType {
  id: ServeTypeId
  name: string
  speed: number
  desc: string
}

export interface CourtTarget {
  id: string
  name: string
  x: number
  z: number
}

export interface BlockPattern {
  id: BlockPatternId
  name: string
  count: number
}

export interface ComboZone {
  id: number
  name: string
  label: string
}

export interface CameraPreset {
  name: string
  pos: [number, number, number]
  target: [number, number, number]
}

export interface Player {
  key: string
  role: string
  zone: number
  isLiberoSub?: boolean
  // When the libero is subbed in, this records the role it replaced (e.g. 'MB2').
  subbedFor?: string
  label: string
  isSetter: boolean
  isFrontRow: boolean
}

export interface ArmPose {
  shX: number
  shZ: number
  elbow: number
  wrist: number
}

export interface Pose {
  bounce: number
  leanX: number
  leanZ: number
  turn: number
  spine: number
  headX: number
  headY: number
  hipL: number
  hipR: number
  kneeL: number
  kneeR: number
  ankleL: number
  ankleR: number
  legZL: number
  legZR: number
  armL: ArmPose
  armR: ArmPose
}

export type AnimName =
  | 'idle'
  | 'run'
  | 'approach'
  | 'jump'
  | 'spike'
  | 'land'
  | 'set'
  | 'serve'
  | 'block'
  | 'receive'

export type PhaseName = 'idle' | 'set' | 'approach' | 'spike' | 'land'

export interface PlayerEntry {
  role: string
  label: string
  color: string
  pos: Vec2
  facing: number
  anim: AnimName
  t: number
  prog: number
  phase: PhaseName
  dirYaw: number
  hitRight: boolean
  seed: number
  serveType: ServeTypeId
  hidden: boolean
}

export interface BallSegment {
  p0?: Vec3
  v: Vec3
  flightTime: number
  releaseAt: number
  landAt: number
}

export interface ServeSegment extends BallSegment {
  p0: Vec3
  landPoint: Vec3
  speed: number
}

export interface SpikeSegment {
  v: Vec3
  flightTime: number
  landPoint: Vec3
}

export interface Outcome {
  winner: 'A' | 'B'
  tag: string
  reason: string
}

export interface AttackPlan {
  passEnd: number
  contactHold: number
  releaseAt: number
  contactAt: number
  approachStart: number
  jumpAt: number
  approachDur: number
  setFlight: number
  riseTime: number
  setHands: Vec3
  vSet: Vec3
  vSpike: Vec3
  feedV: Vec3
  passP0: Vec3
  ballTarget: Vec3
  contactY: number
  customHeight: number | null
  // filled in by the animator
  key?: string
  signalId?: number
  hitterRole?: string
  setterRole?: string
  isCustom?: boolean
  isBackRow?: boolean
  netDist?: number
  netHeight?: NetHeight
  rotation?: number
  totalEnd?: number
  outcome?: Outcome
}

export interface ReceivePlan {
  mode: 'receive'
  totalEnd: number
  serveRelease: number
  serveFlight: number
  serveLandAt: number
  serve: ServeSegment
  receiverRole: string
  receiverPos: Vec3
  pass: BallSegment
  setterRole: string
  setterPos: Vec2
  setHands: Vec3
  set: BallSegment
  hitterRole: string
  hitterPos: Vec2
  ballTarget: Vec3
  contactAt: number
  spike: SpikeSegment
  approachStart: number
  jumpAt: number
  isBackRow: boolean
  // filled in by the animator
  key?: string
  isCustom?: boolean
  netDist?: number
  netHeight?: NetHeight
  serveType?: ServeTypeId
  outcome?: Outcome
}

export interface ServePlan {
  p0: Vec3
  v: Vec3
  flightTime: number
  landPoint: Vec3
  type: string
  speed: number
  serveType: ServeTypeId
  tx: number
  tz: number
  releaseAt?: number
  landAt?: number
  totalEnd?: number
  outcome?: Outcome
}

export interface CustomCombo {
  enabled: boolean
  hitter: string
  zone: number
  height: number
  tempo: number
  spikeTarget: SpikeTargetId
  netDist: number
}

export interface Drill {
  enabled: boolean
  firstBall: Vec2
  spikeLanding: Vec2
  showZones: boolean
}

export interface Store {
  system: System
  rotation: number
  mode: Mode
  phase: string
  play: { clock: number }
  speed: number
  autoReplay: boolean
  autoRotate: boolean
  signalId: number
  realisticTiming: boolean
  plan: AttackPlan | null
  servePlan: ServePlan | null
  receivePlan: ReceivePlan | null
  customCombo: CustomCombo
  drill: Drill
  manualServeTarget: CourtTarget | null
  manualReceiveTarget: { x: number; z: number } | null
  receiveRole: string | null
  scoreA: number
  scoreB: number
  pointEvent: number
  rulesVisible: boolean
  netHeight: NetHeight
  receiveFormation: ReceiveFormation
  blockPattern: BlockPatternId
  panelVisible: boolean
  labelsVisible: boolean
  showTrajectory: boolean
  showSignalOverlay: boolean
  serveType: ServeTypeId
  serveTarget: ServeTargetId
  cameraPreset: string
  fps: number
  setSystem: (system: System) => void
  setRotation: (rotation: number) => void
  rotate: (dir: number) => void
  setPhase: (phase: string) => void
  setSignal: (signalId: number) => void
  setCustomCombo: (patch: Partial<CustomCombo>) => void
  setDrill: (patch: Partial<Drill>) => void
  setManualServeTarget: (target: CourtTarget | null) => void
  setManualReceiveTarget: (target: { x: number; z: number } | null) => void
  setReceiveRole: (role: string | null) => void
  addScore: (side: 'A' | 'B') => void
  resetScore: () => void
  toggleRules: () => void
  toggleRealistic: () => void
  setSpeed: (speed: number) => void
  toggleAutoReplay: () => void
  toggleAutoRotate: () => void
  setPlan: (plan: AttackPlan | null) => void
  setServePlan: (servePlan: ServePlan | null) => void
  setReceivePlan: (receivePlan: ReceivePlan | null) => void
  setNetHeight: (netHeight: NetHeight) => void
  setReceiveFormation: (formation: ReceiveFormation) => void
  setBlockPattern: (pattern: BlockPatternId) => void
  togglePanel: () => void
  toggleLabels: () => void
  toggleTrajectory: () => void
  toggleSignalOverlay: () => void
  setMode: (mode: Mode) => void
  setServeType: (serveType: ServeTypeId) => void
  setServeTarget: (serveTarget: ServeTargetId) => void
  setCameraPreset: (preset: string) => void
  setFps: (fps: number) => void
  netY: () => number
  startPlay: () => void
  resetPlay: () => void
}

export interface AnimState {
  playersA: Map<string, PlayerEntry>
  playersB: Map<string, PlayerEntry>
  plan: AttackPlan | null
  servePlan: ServePlan | null
  receivePlan: ReceivePlan | null
}
