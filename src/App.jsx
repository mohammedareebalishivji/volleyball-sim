import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useStore } from './store'
import { Scene } from './components/Scene'
import { ControlPanel } from './components/ControlPanel'
import { Banner, PlayCallout, SignalCallout, ServeMeta, HUDChips, Scoreboard, Legend, FpsChip, KeyHints } from './components/HUD'
import { RulesOverlay } from './components/Rules'

function Keyboard() {
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState()
      if (e.key === 'h' || e.key === 'H') s.togglePanel()
      if (e.key === 'r' || e.key === 'R') s.toggleRules()
      if (e.code === 'Space') {
        e.preventDefault()
        if (s.phase !== 'idle') s.resetPlay()
        else s.startPlay()
      }
      if (e.key === 'ArrowRight') s.rotate(1)
      if (e.key === 'ArrowLeft') s.rotate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

export default function App() {
  if (import.meta.env.DEV) {
    window.__store = useStore
  }
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 4.5, 16], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Scene />
      </Canvas>
      <div className="ui-layer">
        <ControlPanel />
        <Banner />
        <SignalCallout />
        <ServeMeta />
        <PlayCallout />
        <Scoreboard />
        <HUDChips />
        <Legend />
        <FpsChip />
        <KeyHints />
        <RulesOverlay />
      </div>
      <Keyboard />
    </>
  )
}
