import { create } from 'zustand'
import { NET_HEIGHTS } from './constants'

// Play lifecycle phases
export const PHASE = {
  IDLE: 'idle',
  SET: 'set',
  APPROACH: 'approach',
  SPIKE: 'spike',
  LAND: 'land',
}

export const useStore = create((set, get) => ({
  // -- Rotation / system
  system: '5-1',
  rotation: 0,
  // -- Play
  phase: PHASE.IDLE,
  play: { clock: 0 },
  signalId: 4,
  realisticTiming: false,
  speed: 1,
  autoReplay: true,
  plan: null,
  servePlan: null,
  receivePlan: null,
  // -- Custom combo (attack mode override)
  customCombo: {
    enabled: false,
    hitter: 'OH1',
    zone: 4,
    height: 2.6, // set arc apex above net (m)
    tempo: 1.5,  // quickness (1 quick .. 3 high)
    spikeTarget: 'center',
    netDist: 1.5, // how far off the net the set lands (m)
  },
  // -- Free drill / manual ball placement
  drill: {
    enabled: false,
    firstBall: { x: 0, z: -4.5 },  // where the first (feeder) ball is placed on Team A's court
    spikeLanding: { x: 0, z: 4.5 }, // where the spike lands on Team B's court
    showZones: true,               // show spiking zone + placement markers
  },
  // Manual click-set targets (null = use presets)
  manualServeTarget: null,
  manualReceiveTarget: null,
  // Who plays first touch (serve-receive). null = auto-pick the best passer.
  receiveRole: null,
  // -- Score / atmosphere
  scoreA: 0,
  scoreB: 0,
  pointEvent: 0,
  rulesVisible: false,
  // -- Net
  netHeight: 'men',
  receiveFormation: 'w',
  // -- Blocking (opponent Team B)
  blockPattern: 'double',
  // -- UI
  panelVisible: true,
  labelsVisible: true,
  showTrajectory: true,
  showSignalOverlay: true,
  mode: 'attack', // 'attack' | 'receive' | 'serve'
  serveType: 'topspin',
  serveTarget: 'seam-rb',
  // -- Camera
  cameraPreset: 'broadcast',
  fps: 60,

  setSystem: (system) => set({ system, rotation: 0 }),
  setRotation: (rotation) => set({ rotation: ((rotation % 6) + 6) % 6 }),
  rotate: (dir) => set((s) => ({ rotation: ((s.rotation + dir) % 6 + 6) % 6 })),

  setPhase: (phase) => set({ phase }),
  setSignal: (signalId) => set({ signalId }),
  setCustomCombo: (patch) => set((s) => ({ customCombo: { ...s.customCombo, ...patch } })),
  setDrill: (patch) => set((s) => ({ drill: { ...s.drill, ...patch } })),
  setManualServeTarget: (manualServeTarget) => set({ manualServeTarget }),
  setManualReceiveTarget: (manualReceiveTarget) => set({ manualReceiveTarget }),
  setReceiveRole: (receiveRole) => set({ receiveRole }),
  addScore: (side) => set((s) => (
    side === 'A'
      ? { scoreA: s.scoreA + 1, pointEvent: s.pointEvent + 1 }
      : { scoreB: s.scoreB + 1, pointEvent: s.pointEvent + 1 }
  )),
  resetScore: () => set({ scoreA: 0, scoreB: 0, pointEvent: 0 }),
  toggleRules: () => set((s) => ({ rulesVisible: !s.rulesVisible })),
  toggleRealistic: () => set((s) => ({ realisticTiming: !s.realisticTiming })),
  setSpeed: (speed) => set({ speed }),
  toggleAutoReplay: () => set((s) => ({ autoReplay: !s.autoReplay })),
  setPlan: (plan) => set({ plan }),
  setServePlan: (servePlan) => set({ servePlan }),
  setReceivePlan: (receivePlan) => set({ receivePlan }),

  setNetHeight: (netHeight) => set({ netHeight }),
  setReceiveFormation: (receiveFormation) => set({ receiveFormation }),
  setBlockPattern: (blockPattern) => set({ blockPattern }),
  togglePanel: () => set((s) => ({ panelVisible: !s.panelVisible })),
  toggleLabels: () => set((s) => ({ labelsVisible: !s.labelsVisible })),
  toggleTrajectory: () => set((s) => ({ showTrajectory: !s.showTrajectory })),
  toggleSignalOverlay: () => set((s) => ({ showSignalOverlay: !s.showSignalOverlay })),
  setMode: (mode) => set({ mode }),
  setServeType: (serveType) => set({ serveType }),
  setServeTarget: (serveTarget) => set({ serveTarget }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),

  setFps: (fps) => set({ fps }),

  netY: () => NET_HEIGHTS[get().netHeight],

  // Start a play cycle
  startPlay: () => set((s) => ({ phase: PHASE.SET, play: { clock: 0 }, plan: null, servePlan: null, receivePlan: null })),
  resetPlay: () => set((s) => ({ phase: PHASE.IDLE, play: { clock: 0 }, plan: null, servePlan: null, receivePlan: null })),
}))
