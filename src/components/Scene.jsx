import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { Court, Arena } from './Court'
import { CameraRig } from './CameraRig'
import { PlayerActor } from './PlayerActor'
import { Ball } from './Ball'
import { Trajectory } from './Trajectory'
import { Confetti } from './Confetti'
import { ZoneOverlay } from './ZoneOverlay'
import { ROSTERS, makeEntries, step } from '../logic/animator'
import { TEAM_A_COLOR, TEAM_B_COLOR, LIBERO_COLOR } from '../constants'

export function Scene() {
  const system = useStore((s) => s.system)
  const st = useRef({ plan: null, servePlan: null })
  const fpsTime = useRef(0)
  const fpsAcc = useRef(0)
  const scoredRef = useRef(false)
  const [, setTick] = useState(0)
  const { gl, scene } = useThree()

  // expose scene graph for debugging
  if (import.meta.env.DEV) {
    window.__gl = gl
    window.__scene = scene
  }

  // rebuild entry maps when the system changes
  useEffect(() => {
    st.current.playersA = makeEntries(ROSTERS[system])
    st.current.playersB = makeEntries(ROSTERS['5-1'])
    setTick((x) => x + 1)
  }, [system])

  useFrame((_, rawDt) => {
    const s = useStore.getState()
    const dt = Math.min(rawDt, 0.05)
    if (import.meta.env.DEV) window.__anim = st.current

    // advance play clock (mutate to avoid re-renders)
    if (s.phase !== 'idle') {
      s.play.clock += dt * s.speed
      let end = 1.5
      if (s.mode === 'receive' && s.receivePlan) end = s.receivePlan.totalEnd
      else if (s.mode === 'serve' && s.servePlan) end = s.servePlan.totalEnd || (s.servePlan.releaseAt || 0.45) + s.servePlan.flightTime + 0.5
      else if (s.plan) end = s.plan.totalEnd || s.plan.contactAt + 0.72
      if (s.play.clock > end) {
        if (!scoredRef.current) {
          scoredRef.current = true
          s.addScore('A')
        }
        if (s.autoReplay) {
          s.play.clock = 0
          scoredRef.current = false
          st.current.plan = null
          st.current.servePlan = null
          st.current.receivePlan = null
          s.setPlan(null)
          s.setServePlan(null)
          s.setReceivePlan(null)
        } else {
          s.setPhase('idle')
          st.current.plan = null
          st.current.servePlan = null
          st.current.receivePlan = null
        }
      }
    } else {
      scoredRef.current = false
    }

    step(s, st.current)

    // fps meter
    fpsAcc.current += 1
    fpsTime.current += rawDt
    if (fpsTime.current > 0.5) {
      s.setFps(Math.round(fpsAcc.current / fpsTime.current))
      fpsAcc.current = 0
      fpsTime.current = 0
    }
  })

  const entriesA = []
  const entriesB = []
  if (st.current.playersA) {
    for (const e of st.current.playersA.values()) entriesA.push(e)
  }
  if (st.current.playersB) {
    for (const e of st.current.playersB.values()) entriesB.push(e)
  }

  return (
    <>
      <color attach="background" args={['#0b1018']} />
      <fog attach="fog" args={['#0b1018', 26, 48]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfd8ea', '#1a202a', 0.5]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <spotLight position={[0, 20, 0]} angle={0.9} penumbra={0.6} intensity={1.6} color="#fff8e7" distance={60} decay={1.2} />

      <CameraRig />
      <CourtClick />
      <Arena />
      <Court />
      <ZoneOverlay />

      {entriesA.map((e) => (
        <PlayerActor
          key={e.role}
          data={e}
          jerseyColor={e.role === 'L' ? LIBERO_COLOR : TEAM_A_COLOR}
        />
      ))}
      {entriesB.map((e) => (
        <PlayerActor
          key={e.role}
          data={e}
          jerseyColor={e.role === 'L' ? LIBERO_COLOR : TEAM_B_COLOR}
        />
      ))}

      <Ball />
      <Trajectory />
      <Confetti />
    </>
  )
}

// Invisible floor plane that lets the user click to place the ball /
// spike / serve target anywhere on the court. Coordinates are clamped to
// the court so clicks on the surrounding arena floor still register.
function CourtClick() {
  const handle = (e) => {
    e.stopPropagation()
    const s = useStore.getState()
    if (s.phase !== 'idle') return
    const x = Math.max(-4.5, Math.min(4.5, e.point.x))
    const z = Math.max(-9, Math.min(9, e.point.z))
    if (s.mode === 'attack' && s.drill.enabled) {
      if (z < 0) s.setDrill({ firstBall: { x, z } })
      else s.setDrill({ spikeLanding: { x, z } })
    } else if (s.mode === 'serve') {
      if (z > 0) s.setManualServeTarget({ x, z })
    } else if (s.mode === 'receive') {
      if (z < 0) s.setManualReceiveTarget({ x, z })
    }
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} onPointerDown={handle}>
      <planeGeometry args={[18, 18]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
