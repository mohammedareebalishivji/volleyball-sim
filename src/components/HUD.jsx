import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { SIGNALS, SERVE_TYPES, SERVE_TARGETS, ROLE_META, COMBO_ZONES } from '../constants'
import { customSignal } from '../logic/animator'

export function Banner() {
  const system = useStore((s) => s.system)
  const rotation = useStore((s) => s.rotation)
  const panelVisible = useStore((s) => s.panelVisible)
  return (
    <div className={`banner ${panelVisible ? '' : 'hidden'}`}>
      <div className="title-card">
        <h1>3D Volleyball — Rotation &amp; Tempo Simulator</h1>
        <p>
          {system} system · Rotation {rotation + 1}/6
        </p>
      </div>
    </div>
  )
}

// Live play callout — polls the (non-reactive) play clock at low frequency
export function PlayCallout() {
  const [label, setLabel] = useState('Ready')
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    if (mode === 'serve') {
      const iv = setInterval(() => {
        const s = useStore.getState()
        const st = s.servePlan
        const t = s.play.clock
        if (!st) setLabel('Server ready')
        else if (t < 0.45) setLabel('Toss — approaching the serve')
        else if (t < st.flightTime) setLabel(`Serve in flight — ${st.speed} km/h`)
        else setLabel('Serve lands — opponent receive')
      }, 160)
      return () => clearInterval(iv)
    }
    if (mode === 'receive') {
      const iv = setInterval(() => {
        const s = useStore.getState()
        const rp = s.receivePlan
        const t = s.play.clock
        if (!rp) setLabel('Ready for serve-receive')
        else if (t < rp.serve.releaseAt) setLabel('Team B — preparing the serve…')
        else if (t < rp.serve.landAt) setLabel('Serve in flight — receiver moves…')
        else if (t < rp.pass.landAt) setLabel('1st touch — receiver passes to setter')
        else if (t < rp.set.releaseAt) setLabel('2nd touch — setter contact…')
        else if (t < rp.contactAt) setLabel('Set released → hitter approach')
        else if (t < rp.contactAt + 0.06) setLabel('3rd touch — spike!')
        else setLabel('Spike lands — point Team B')
      }, 160)
      return () => clearInterval(iv)
    }
    if (phase === 'idle') {
      setLabel('Ready — press Play')
      return
    }
    const iv = setInterval(() => {
      const s = useStore.getState()
      const plan = s.plan
      if (!plan) return setLabel('Starting sequence…')
      const t = s.play.clock
      if (t < plan.passEnd) setLabel(s.drill.enabled ? 'Feeder ball in flight → setter' : 'Pass received — setter releases…')
      else if (t < plan.releaseAt) setLabel('Setter overhead contact…')
      else if (t < plan.contactAt) setLabel(s.realisticTiming ? 'Quick tempo — hitter already in flight' : 'Set released → hitter approach')
      else if (t < plan.contactAt + 0.06) setLabel('Spike — contact!')
      else setLabel('Landing — play continues')
    }, 160)
    return () => clearInterval(iv)
  }, [phase, mode])

  const show = useStore((s) => s.panelVisible) && (phase !== 'idle' || mode === 'serve' || mode === 'receive')
  return (
    <div className={`banner ${show ? '' : 'hidden'}`} style={{ top: 'auto', bottom: 64 }}>
      <div className="callout">{label}</div>
    </div>
  )
}

export function SignalCallout() {
  const signalId = useStore((s) => s.signalId)
  const customCombo = useStore((s) => s.customCombo)
  const drill = useStore((s) => s.drill)
  const mode = useStore((s) => s.mode)
  const panelVisible = useStore((s) => s.panelVisible)
  const useCustom = customCombo.enabled || drill.enabled
  const sig = useCustom ? customSignal(customCombo) : SIGNALS.find((x) => x.id === signalId)
  if (mode !== 'attack') return null
  const zone = COMBO_ZONES.find((z) => z.id === sig.zone)
  const accent = drill.enabled ? '#7dffa0' : customCombo.enabled ? 'rgba(126,87,194,0.55)' : 'rgba(255,255,255,0.25)'
  const bg = drill.enabled ? 'rgba(125,255,160,0.14)' : customCombo.enabled ? 'rgba(126,87,194,0.18)' : 'rgba(255,255,255,0.08)'
  return (
    <div className={`banner ${panelVisible ? '' : 'hidden'}`} style={{ top: 84 }}>
      <div className={`callout ${drill.enabled ? 'drill' : customCombo.enabled ? 'custom' : ''}`} style={{ background: bg, borderColor: accent, color: '#e8edf5' }}>
        {useCustom
          ? drill.enabled
            ? `Free drill → ${sig.hitter} @ ${zone ? zone.name : 'Z' + sig.zone} · ball at (${drill.firstBall.x.toFixed(1)}, ${drill.firstBall.z.toFixed(1)}) · spike → (${drill.spikeLanding.x.toFixed(1)}, ${drill.spikeLanding.z.toFixed(1)})`
            : `${sig.name} → ${zone ? zone.name : 'Z' + sig.zone} · ${sig.hitter} · ${sig.height.toFixed(1)}m arc · tempo ${sig.tempo.toFixed(1)}`
          : `${sig.name} → Z${sig.zone} · Tempo ${sig.tempo} · ${sig.hitter} · <i>${sig.cue}</i>`}
      </div>
    </div>
  )
}

export function ServeMeta() {
  const serveType = useStore((s) => s.serveType)
  const serveTarget = useStore((s) => s.serveTarget)
  const mode = useStore((s) => s.mode)
  const panelVisible = useStore((s) => s.panelVisible)
  if (mode !== 'serve') return null
  const st = SERVE_TYPES.find((x) => x.id === serveType)
  const tg = SERVE_TARGETS.find((x) => x.id === serveTarget)
  return (
    <div className={`banner ${panelVisible ? '' : 'hidden'}`} style={{ top: 84 }}>
      <div className="callout" style={{ background: 'rgba(102,217,255,0.12)', borderColor: 'rgba(102,217,255,0.4)', color: '#c9f1ff' }}>
        {st.name} — targeting {tg.name} ({st.desc})
      </div>
    </div>
  )
}

export function HUDChips() {
  const phase = useStore((s) => s.phase)
  const signalId = useStore((s) => s.signalId)
  const rotation = useStore((s) => s.rotation)
  const system = useStore((s) => s.system)
  const mode = useStore((s) => s.mode)
  const panelVisible = useStore((s) => s.panelVisible)
  const sig = SIGNALS.find((x) => x.id === signalId)

  return (
    <div className={`hud ${panelVisible ? '' : 'hidden'}`}>
      <div className="hud-chip">Mode: <b>{mode}</b></div>
      <div className="hud-chip">System: <b>{system}</b></div>
      <div className="hud-chip">Rotation: <b>{rotation + 1}</b></div>
      {mode === 'attack' && <div className="hud-chip">Play: <b>{sig.name}</b></div>}
      <div className="hud-chip">Phase: <b>{phase}</b></div>
      <button className="hud-btn" onClick={() => useStore.getState().toggleLabels()}>Labels</button>
      <button className="hud-btn" onClick={() => useStore.getState().toggleRules()}>Rules</button>
      <button className="hud-btn" onClick={() => useStore.getState().togglePanel()}>Hide UI</button>
    </div>
  )
}

export function Scoreboard() {
  const scoreA = useStore((s) => s.scoreA)
  const scoreB = useStore((s) => s.scoreB)
  const pointEvent = useStore((s) => s.pointEvent)
  const panelVisible = useStore((s) => s.panelVisible)
  const [flash, setFlash] = useState(0)
  const prev = useRef(pointEvent)

  useEffect(() => {
    if (pointEvent !== prev.current) {
      prev.current = pointEvent
      setFlash(2)
      const iv = setTimeout(() => setFlash(0), 1200)
      return () => clearTimeout(iv)
    }
  }, [pointEvent])

  return (
    <div className={`scoreboard ${panelVisible ? '' : 'hidden'} ${flash ? 'flash' : ''}`}>
      <div className="sb-team sb-a">
        <span className="sb-side">A</span>
        <span className="sb-score">{scoreA}</span>
      </div>
      <div className="sb-mid">🏐</div>
      <div className="sb-team sb-b">
        <span className="sb-score">{scoreB}</span>
        <span className="sb-side">B</span>
      </div>
      {flash > 0 && <div className="sb-point">POINT!</div>}
    </div>
  )
}

export function Legend() {
  const panelVisible = useStore((s) => s.panelVisible)
  const items = [['S', ROLE_META.S.color, 'Setter'], ['OH', ROLE_META.OH1.color, 'Outside Hitter'], ['MB', ROLE_META.MB1.color, 'Middle Blocker'], ['OPP', ROLE_META.OPP.color, 'Opposite'], ['L', ROLE_META.L.color, 'Libero'], ['DS', ROLE_META.DS.color, 'Def. Spec.']]
  return (
    <div className={`legend ${panelVisible ? '' : 'hidden'}`}>
      {items.map(([label, color, name]) => (
        <div className="lg-item" key={label}>
          <span className="dot" style={{ background: color }} />
          <span><b>{label}</b> — {name}</span>
        </div>
      ))}
    </div>
  )
}

export function FpsChip() {
  const fps = useStore((s) => s.fps)
  const panelVisible = useStore((s) => s.panelVisible)
  const color = fps >= 55 ? '#7dffa0' : fps >= 30 ? '#ffd166' : '#ff6b6b'
  return (
    <div className={`fps-chip ${panelVisible ? '' : 'hidden'}`} style={{ color }}>
      {fps} FPS
    </div>
  )
}

export function KeyHints() {
  const panelVisible = useStore((s) => s.panelVisible)
  return (
    <div className={`key-hint ${panelVisible ? '' : 'hidden'}`}>
      <kbd>H</kbd> toggle UI · <kbd>R</kbd> rules · <kbd>drag</kbd> orbit · <kbd>scroll</kbd> zoom · <kbd>space</kbd> play
    </div>
  )
}
