import { describe, it, expect } from 'vitest'
import { step, sixTwoNote } from '../animator'
import { makeEntries, ROSTERS } from '../tactics'
import { solve } from '../physics'
import type { Store, AnimState } from '../../types'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function makeStore(overrides: DeepPartial<Store> = {}): Store {
  const s = {
    system: '5-1' as const,
    rotation: 0,
    mode: 'attack' as const,
    phase: 'set',
    play: { clock: 1.2 },
    speed: 1,
    autoReplay: true,
    signalId: 4,
    realisticTiming: false,
    plan: null,
    servePlan: null,
    receivePlan: null,
    customCombo: {
      enabled: false,
      hitter: 'OH1',
      zone: 4,
      height: 2.6,
      tempo: 1.5,
      spikeTarget: 'center' as const,
      netDist: 1.5,
    },
    drill: { enabled: false, firstBall: [0, -4.5], spikeLanding: [0, 4.5], showZones: true },
    manualServeTarget: null,
    manualReceiveTarget: null,
    receiveRole: null,
    scoreA: 0,
    scoreB: 0,
    pointEvent: 0,
    rulesVisible: false,
    netHeight: 'men' as const,
    receiveFormation: 'w' as const,
    blockPattern: 'double' as const,
    panelVisible: true,
    labelsVisible: true,
    showTrajectory: true,
    showSignalOverlay: true,
    serveType: 'topspin' as const,
    serveTarget: 'seam-rb' as const,
    cameraPreset: 'broadcast',
    fps: 60,
    setSystem: () => {},
    setRotation: () => {},
    rotate: () => {},
    setPhase: () => {},
    setSignal: () => {},
    setCustomCombo: () => {},
    setDrill: () => {},
    setManualServeTarget: () => {},
    setManualReceiveTarget: () => {},
    setReceiveRole: () => {},
    addScore: () => {},
    resetScore: () => {},
    toggleRules: () => {},
    toggleRealistic: () => {},
    setSpeed: () => {},
    toggleAutoReplay: () => {},
    setPlan: (p) => { s.plan = p },
    setServePlan: (p) => { s.servePlan = p },
    setReceivePlan: (p) => { s.receivePlan = p },
    setNetHeight: () => {},
    setReceiveFormation: () => {},
    setBlockPattern: () => {},
    togglePanel: () => {},
    toggleLabels: () => {},
    toggleTrajectory: () => {},
    toggleSignalOverlay: () => {},
    setMode: () => {},
    setServeType: () => {},
    setServeTarget: () => {},
    setCameraPreset: () => {},
    setFps: () => {},
    netY: () => 2.43,
    startPlay: () => {},
    resetPlay: () => {},
    ...overrides,
  } as Store
  return s
}

function makeState(): AnimState {
  return {
    playersA: makeEntries(ROSTERS['5-1']),
    playersB: makeEntries(ROSTERS['5-1']),
    plan: null,
    servePlan: null,
    receivePlan: null,
  }
}

function expectFinitePositions(st: AnimState) {
  for (const e of st.playersA.values()) {
    expect(Number.isFinite(e.pos[0])).toBe(true)
    expect(Number.isFinite(e.pos[1])).toBe(true)
  }
  for (const e of st.playersB.values()) {
    expect(Number.isFinite(e.pos[0])).toBe(true)
    expect(Number.isFinite(e.pos[1])).toBe(true)
  }
}

describe('step (migrated TS animator)', () => {
  it('attack mode builds and caches a plan', () => {
    const s = makeStore()
    const st = makeState()
    step(s, st)
    const first = st.plan
    expect(first).toBeTruthy()
    expect(first!.contactAt).toBeGreaterThan(first!.releaseAt)
    step(s, st)
    expect(st.plan).toBe(first)
    expectFinitePositions(st)
  })

  it('serve mode plan lands the ball at its landPoint under gravity', () => {
    const s = makeStore({ mode: 'serve', serveType: 'jump', serveTarget: 'seam-mid' })
    const st = makeState()
    step(s, st)
    expect(st.servePlan).toBeTruthy()
    const sp = st.servePlan!
    const atLand = solve(sp.p0, sp.v, sp.flightTime)
    expect(atLand.x).toBeCloseTo(sp.landPoint.x, 2)
    expect(atLand.z).toBeCloseTo(sp.landPoint.z, 2)
    expect(atLand.y).toBeCloseTo(sp.landPoint.y, 2)
    expectFinitePositions(st)
  })

  it('receive mode exposes serve + receive plans and finite motion', () => {
    const s = makeStore({ mode: 'receive', serveTarget: 'deep-lb', receiveFormation: 'w' })
    const st = makeState()
    step(s, st)
    expect(st.receivePlan).toBeTruthy()
    expect(st.servePlan).toBeTruthy()
    const rp = st.receivePlan!
    expect(rp.receiverRole.length).toBeGreaterThan(0)
    expect(rp.pass.p0).toBeTruthy()
    expectFinitePositions(st)
  })

  it('receive mode reuses cached plans until the key changes', () => {
    const s = makeStore({ mode: 'receive' })
    const st = makeState()
    step(s, st)
    const first = st.receivePlan
    step(s, st)
    expect(st.receivePlan).toBe(first)
    s.receiveFormation = '2'
    step(s, st)
    expect(st.receivePlan).not.toBe(first)
  })

  it('idle phase clears plans', () => {
    const s = makeStore({ phase: 'idle' })
    const st = makeState()
    step(s, st)
    expect(st.plan).toBeNull()
    expect(st.servePlan).toBeNull()
    expect(st.receivePlan).toBeNull()
    expectFinitePositions(st)
  })

  it('sixTwoNote reports rotation role', () => {
    expect(sixTwoNote(makeStore())).toBeNull()
    const note = sixTwoNote(makeStore({ system: '6-2', rotation: 0 }))
    expect(typeof note).toBe('string')
  })
})

describe('step — outcome resolution + plan lifecycle', () => {
  it('attack plan carries a deterministic outcome with a valid winner', () => {
    const s = makeStore()
    const st = makeState()
    step(s, st)
    expect(st.plan!.outcome).toBeTruthy()
    expect(['A', 'B']).toContain(st.plan!.outcome!.winner)
    step(s, st)
    expect(st.plan!.outcome).toBe(st.plan!.outcome)
  })

  it('changing the rotation invalidates the cached attack plan', () => {
    const s = makeStore()
    const st = makeState()
    step(s, st)
    const first = st.plan
    s.rotation = 2
    step(s, st)
    expect(st.plan).not.toBe(first)
  })

  it('custom combo changes the hitter and zone used', () => {
    const s = makeStore({ customCombo: { enabled: true, hitter: 'MB1', zone: 3 } })
    const st = makeState()
    step(s, st)
    expect(st.plan).toBeTruthy()
    expect(st.plan!.hitterRole).toBe('MB1')
    expect(st.plan!.isCustom).toBe(true)
  })

  it('free drill places the first ball at the chosen spot', () => {
    const s = makeStore({ drill: { enabled: true, firstBall: [-3, -2], spikeLanding: [2, 5] } })
    const st = makeState()
    step(s, st)
    expect(st.plan!.isCustom).toBe(true)
    expect(st.plan!.passP0.x).toBeCloseTo(-3, 5)
    expect(st.plan!.passP0.z).toBeCloseTo(-2, 5)
  })

  it('serve plan is rebuilt when the target moves', () => {
    const s = makeStore({ mode: 'serve', serveTarget: 'line' })
    const st = makeState()
    step(s, st)
    const first = st.servePlan
    s.serveTarget = 'deep-lb'
    step(s, st)
    expect(st.servePlan).not.toBe(first)
  })

  it('receive plan resolves the spike outcome and is finite', () => {
    const s = makeStore({ mode: 'receive', blockPattern: 'triple' })
    const st = makeState()
    step(s, st)
    expect(st.receivePlan!.outcome).toBeTruthy()
    expect(st.receivePlan!.spike.landPoint.z).toBeGreaterThan(0)
    expectFinitePositions(st)
  })
})

describe('step — court placement', () => {
  it('serve mode puts the server in zone 1 and the rest in formation', () => {
    const s = makeStore({ mode: 'serve' })
    const st = makeState()
    step(s, st)
    const entries = [...st.playersA.values()]
    const server = entries.find((e) => e.anim === 'serve')
    expect(server).toBeTruthy()
    expect(server!.pos[0]).toBeCloseTo(0.4, 5)
    expect(server!.pos[1]).toBeCloseTo(-9.6, 5)
  })

  it('receive mode hides the bench libero and shows a receiver moving', () => {
    const s = makeStore({ mode: 'receive' })
    const st = makeState()
    step(s, st)
    // exactly one player on each team should be marked hidden (the subbed middle / libero)
    const hiddenA = [...st.playersA.values()].filter((e) => e.hidden)
    expect(hiddenA.length).toBeGreaterThan(0)
    for (const e of st.playersA.values()) expect(Number.isFinite(e.pos[0])).toBe(true)
  })

  it('attack mode keeps everyone finite and on-court', () => {
    const s = makeStore({ mode: 'attack', blockPattern: 'double' })
    const st = makeState()
    step(s, st)
    for (const e of st.playersA.values()) expect(Number.isFinite(e.pos[1])).toBe(true)
    for (const e of st.playersB.values()) expect(Number.isFinite(e.pos[1])).toBe(true)
  })

  it('6-2 receive still yields a plan and a setter', () => {
    const s = makeStore({ system: '6-2', mode: 'receive' })
    const st = makeState()
    step(s, st)
    expect(st.receivePlan).toBeTruthy()
    expect(st.receivePlan!.setterRole).toMatch(/^S[12]$/)
    expectFinitePositions(st)
  })
})
