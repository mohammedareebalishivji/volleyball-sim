import { useState, useEffect } from 'react'
import { useStore } from '../store'
import {
  SIGNALS, SERVE_TYPES, SERVE_TARGETS, RECEIVE_TARGETS, CAMERA_PRESETS, SPIKE_TARGETS,
  COMBO_ZONES, BLOCK_PATTERNS, BLOCK_COLOR, NET_HEIGHTS, COURT_GRID,
} from '../constants'
import { buildLineup, activeSetter } from '../logic/rotation'
import { jumpSpot, approachStart, setterSpot, customSignal, blockSpots } from '../logic/animator'

const ROT_NAMES = ['Rotation 1', 'Rotation 2', 'Rotation 3', 'Rotation 4', 'Rotation 5', 'Rotation 6']

const TABS = [
  { id: 'rally', label: 'Rally' },
  { id: 'serve', label: 'Serve · Receive' },
  { id: 'options', label: 'Settings' },
]

// One-tap offense patterns. Stamp a full custom combo (spiker, zone, arc, tempo).
const QUICK_PLAYS = [
  { label: 'High outside', zone: 4, height: 4.6, tempo: 3, hitter: 'OH1' },
  { label: 'Quick middle', zone: 3, height: 0.9, tempo: 1, hitter: 'MB1' },
  { label: 'Back-1 shoot', zone: 2, height: 1.6, tempo: 1.5, hitter: 'MB1' },
  { label: 'Pipe (back)', zone: 3, height: 4.6, tempo: 3, hitter: 'OH2' },
  { label: 'High back-set', zone: 2, height: 4.6, tempo: 3, hitter: 'OPP' },
  { label: 'Slide', zone: 2, height: 1.6, tempo: 1.5, hitter: 'MB1' },
]

// Quickness presets (tempo + set arc above net).
const QUICKNESS_PRESETS = [
  { label: '1 · Quick', tempo: 1, height: 0.9 },
  { label: '1.5 · Shoot', tempo: 1.5, height: 1.6 },
  { label: '2 · Medium', tempo: 2, height: 2.6 },
  { label: '3 · High', tempo: 3, height: 4.6 },
]

const MODE_LABEL = { attack: 'Attack', receive: 'Serve-receive', serve: 'Serve' }

// ---------------------------------------------------------------------------
// Single source of truth for the live rally (drives diagram, verdict, chain).
// ---------------------------------------------------------------------------
function rally(s) {
  const lineup = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineup)
  const hitters = lineup.filter((p) => !p.isSetter && p.role !== 'L')
  const combo = s.customCombo
  const playType = s.drill.enabled ? 'drill' : 'combo'
  const signal = customSignal(combo)
  const hitterRole = hitters.find((p) => p.role === combo.hitter) ? combo.hitter : (hitters[0] ? hitters[0].role : null)
  const hitter = hitters.find((p) => p.role === hitterRole) || null
  const isBack = hitter ? !hitter.isFrontRow : false
  const netDist = Math.max(0.5, Math.min(2.9, combo.netDist))
  const hSpot = jumpSpot(signal.zone, isBack, netDist)
  const aStart = approachStart(signal.zone, isBack, netDist)
  const setterPos = setterSpot()
  const spikeT = s.drill.enabled
    ? s.drill.spikeLanding
    : (SPIKE_TARGETS.find((t) => t.id === combo.spikeTarget) || { x: 0, z: 4.5 })
  const blockXs = blockSpots(signal.zone, s.blockPattern)
  return { lineup, setter, hitters, combo, playType, signal, hitter, hitterRole, isBack, netDist, hSpot, aStart, setterPos, spikeT, blockXs }
}

// Legal-attack verdict for the chosen spiker (the "spiking zone" check).
function spikeVerdict(s, r) {
  const pl = r.hitter
  if (!pl) return null
  const takeoffZ = r.isBack ? -Math.max(r.netDist, 3.2) : -r.netDist
  const back = r.isBack
  return {
    role: pl.role,
    zone: pl.zone,
    row: back ? 'back' : 'front',
    netDist: r.netDist,
    takeoffZ,
    color: back ? '#ffd166' : '#66d9ff',
    title: back ? 'Back-row attacker — take-off restricted' : 'Legal front-row attack',
    msg: back
      ? 'Back-row attackers must take off behind the 3 m attack line. The simulator forces the jump spot there automatically.'
      : 'Front-row attacker — legal attack zone between the net and the 3 m attack line.',
  }
}

// ---------------------------------------------------------------------------
// Mini tactical court (SVG) — world metres -> px
// ---------------------------------------------------------------------------
function CourtDiagram({ s, r }) {
  const scale = 16.2
  const OX = 17
  const OZ = 24
  const W = 9 * scale
  const H = 18 * scale
  const pt = (x, z) => [OX + (x + 4.5) * scale, OZ + (z + 9) * scale]
  const [, nz] = pt(0, 0)
  const [, ayz1] = pt(0, -3)
  const [, ayz2] = pt(0, 3)
  const rowColor = r.isBack ? '#ffd166' : '#66d9ff'
  const [hx, hz] = pt(...r.hSpot)
  const [sx, sz] = pt(...r.setterPos)
  const [ax, az] = pt(...r.aStart)
  const [px, pz] = pt(r.spikeT.x, r.spikeT.z)
  const manualT = s.mode === 'serve' ? s.manualServeTarget : s.mode === 'receive' ? s.manualReceiveTarget : null
  const presetT = s.mode === 'serve'
    ? (SERVE_TARGETS.find((t) => t.id === s.serveTarget) || SERVE_TARGETS[0])
    : s.mode === 'receive' ? (RECEIVE_TARGETS.find((t) => t.id === s.serveTarget) || RECEIVE_TARGETS[0]) : null

  return (
    <div className="diagram-wrap">
      <svg viewBox="0 0 180 340" className="court-diagram">
        <rect x={OX} y={OZ} width={W} height={H} rx={4} className="cd-court" />
        <line x1={OX} y1={nz} x2={OX + W} y2={nz} className="cd-center" />
        <line x1={OX} y1={ayz1} x2={OX + W} y2={ayz1} className="cd-attack" />
        <line x1={OX} y1={ayz2} x2={OX + W} y2={ayz2} className="cd-attack" />
        <line x1={OX} y1={nz} x2={OX + W} y2={nz} className="cd-net" />
        <text x={OX + 4} y={OZ + 12} className="cd-label">Team A</text>
        <text x={OX + 4} y={OZ + H - 8} className="cd-label">Team B</text>

        {/* shading of the selected attacker row on Team A half */}
        <rect x={OX} y={ayz1} width={W} height={r.isBack ? (OZ + H - ayz1) : (nz - ayz1)}
          fill={rowColor} opacity={0.06} />

        {s.mode === 'attack' && (
          <>
            <line x1={ax} y1={az} x2={hx} y2={hz} className="cd-approach" />
            <circle cx={sx} cy={sz} r={5} className="cd-setter" />
            <text x={sx} y={sz - 8} className="cd-tag">S</text>
            <circle cx={hx} cy={hz} r={7} fill="none" stroke={rowColor} strokeWidth={3} />
            <circle cx={hx} cy={hz} r={2.5} fill={rowColor} />
            <text x={hx} y={hz - 10} className="cd-tag" style={{ fill: rowColor }}>{r.hitter ? r.hitter.role : ''}</text>
            <g transform={`translate(${px},${pz})`}>
              <circle r={6} fill="none" stroke="#ff6b6b" strokeWidth={3} />
              <line x1={-4} y1={-4} x2={4} y2={4} stroke="#ff6b6b" strokeWidth={3} />
              <line x1={4} y1={-4} x2={-4} y2={4} stroke="#ff6b6b" strokeWidth={3} />
            </g>
            {r.blockXs.map((bx, i) => {
              const [bx2, bz2] = pt(bx, 0.4)
              return <circle key={i} cx={bx2} cy={bz2} r={6} fill="none" stroke={BLOCK_COLOR} strokeWidth={3} opacity={0.9} />
            })}
          </>
        )}

        {(s.mode === 'serve' || s.mode === 'receive') && (() => {
          const [mx, mz] = pt(manualT ? manualT.x : presetT.x, manualT ? manualT.z : presetT.z)
          return <circle cx={mx} cy={mz} r={6} fill="none" stroke="#66d9ff" strokeWidth={3} />
        })()}
      </svg>
      <div className="diagram-legend">
        <span><i className="dl-dot" style={{ background: '#ffb300' }} />Setter</span>
        <span><i className="dl-dot" style={{ background: rowColor }} />Hitter take-off</span>
        <span><i className="dl-dot" style={{ background: '#ff6b6b' }} />Spike land</span>
        {r.blockXs.length > 0 && <span><i className="dl-dot" style={{ background: BLOCK_COLOR }} />Block</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tap-to-place grid (manual ball / spike-landing area selection)
// ---------------------------------------------------------------------------
function TapGrid({ side, active, onPick, accent }) {
  const cells = COURT_GRID.filter((c) => c.side === side)
  const isA = side === 'A'
  return (
    <div className={`tapgrid tapgrid-${side}`}>
      {cells.map((c) => {
        const activeCell = active && Math.abs(active.x - c.x) < 0.01 && Math.abs(active.z - c.z) < 0.01
        const rowLabel = isA ? (c.z < -3 ? 'Deep' : c.z < -1.5 ? 'Mid' : 'Front') : (c.z > 3 ? 'Deep' : c.z > 1.5 ? 'Mid' : 'Front')
        return (
          <button
            key={`${c.x}-${c.z}`}
            className={`gc-cell ${activeCell ? 'active' : ''}`}
            style={activeCell ? { borderColor: accent, color: accent } : undefined}
            onClick={() => onPick({ x: c.x, z: c.z })}
            title={`${rowLabel} · x ${c.x}, z ${c.z}`}
          >
            <span className="gc-x">{c.x.toFixed(0)}</span>
            <span className="gc-row">{rowLabel}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rally sequence chain — makes the play easy to read at a glance
// ---------------------------------------------------------------------------
function RallyChain({ r, s, verdict }) {
  const land = r.spikeT
  const steps = [
    { n: '1', label: '1st touch', sub: s.drill.enabled ? `Ball → (${s.drill.firstBall.x.toFixed(1)}, ${s.drill.firstBall.z.toFixed(1)})` : 'Pass → setter', color: '#7dffa0' },
    { n: '2', label: '2nd touch', sub: r.setter ? r.setter.role : 'S', color: '#ffb300' },
    { n: '3', label: '3rd touch', sub: r.hitter ? r.hitter.role : '—', color: verdict ? verdict.color : '#66d9ff' },
    { n: '◎', label: 'Landing', sub: `Z${r.combo.zone} · (${land.x.toFixed(1)}, ${land.z.toFixed(1)})`, color: '#ff6b6b' },
  ]
  return (
    <div className="rally-chain">
      {steps.map((st, i) => (
        <span className="rc-item" key={i}>
          <span className="rc-card" style={{ borderColor: st.color }}>
            <span className="rc-n" style={{ background: st.color }}>{st.n}</span>
            <span className="rc-body">
              <span className="rc-label">{st.label}</span>
              <span className="rc-sub">{st.sub}</span>
            </span>
          </span>
          {i < steps.length - 1 && <span className="rc-arrow">→</span>}
        </span>
      ))}
    </div>
  )
}

function RangeField({ label, value, min, max, step, lo, hi, onChange }) {
  return (
    <>
      <label className="field-label">
        {label} · <span className="accent">{value.toFixed(1)}</span>
      </label>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="range-labels"><span>{lo}</span><span>{hi}</span></div>
    </>
  )
}

// ============================================================================
export function ControlPanel() {
  const s = useStore()
  const [tab, setTab] = useState('rally')

  const lineup = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineup)
  const hitters = lineup.filter((p) => !p.isSetter && p.role !== 'L')
  const comboHitter = hitters.find((p) => p.role === s.customCombo.hitter)
    ? s.customCombo.hitter
    : hitters[0] ? hitters[0].role : null

  const playType = s.drill.enabled ? 'drill' : 'combo'
  const r = rally(s)
  const verdict = spikeVerdict(s, r)

  const setPlayType = (kind) => {
    s.setCustomCombo({ enabled: kind === 'combo' })
    s.setDrill({ enabled: kind === 'drill' })
  }

  const applyQuick = (q) => {
    s.setCustomCombo({ enabled: true, zone: q.zone, height: q.height, tempo: q.tempo, hitter: q.hitter })
    s.setDrill({ enabled: false })
  }

  useEffect(() => {
    if (comboHitter && comboHitter !== s.customCombo.hitter) {
      s.setCustomCombo({ hitter: comboHitter })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboHitter, s.system, s.rotation])

  // ---- Serve / receive helpers ----
  const passers = lineup.filter((p) => !p.isSetter)
  const serveLanding = s.manualReceiveTarget || (RECEIVE_TARGETS.find((t) => t.id === s.serveTarget) || RECEIVE_TARGETS[0])

  return (
    <div className={`panel ${s.panelVisible ? '' : 'hidden'}`}>
      <h2>🏐 3D Volleyball Sim</h2>
      <p className="sub">Rotation · Tempo · Serve-receive · Blocking</p>

      <div className="panel-hints">
        <kbd>Space</kbd> play · <kbd>H</kbd> panel · <kbd>R</kbd> rules · <kbd>←</kbd><kbd>→</kbd> rotate · <b>click</b> court to aim
      </div>

      <div className="summary">
        <span className="sum-chip">{MODE_LABEL[s.mode]}</span>
        <span className="sum-play">{r.signal.name} · {r.hitter ? r.hitter.role : ''}</span>
        <span className="sum-sys">{s.system} · R{s.rotation + 1}</span>
      </div>

      <CourtDiagram s={s} r={r} />

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/*  RALLY TAB — the guided play designer                              */}
      {/* ================================================================== */}
      {tab === 'rally' && (
        <>
          <section>
            <h3>Team &amp; rotation</h3>
            <div className="seg">
              {['5-1', '6-2'].map((sys) => (
                <button key={sys} className={s.system === sys ? 'active' : ''} onClick={() => s.setSystem(sys)}>
                  {sys}
                </button>
              ))}
            </div>
            <div className="rot-btns" style={{ marginTop: 8 }}>
              <button className="arrow seg" onClick={() => s.rotate(-1)}>◀</button>
              <div className="rot-num">{ROT_NAMES[s.rotation]}</div>
              <button className="arrow seg" onClick={() => s.rotate(1)}>▶</button>
            </div>
            <p className="note">
              Zones: <b>2·3·4</b> front row · <b>1·6·5</b> back row — rotation advances clockwise after winning serve.
            </p>
            <div className="rot-mini">
              {lineup.map((p) => (
                <span key={p.role} className={`rm-chip ${p.isSetter ? 'rm-set' : ''}`} title={`Z${p.zone} · ${p.isFrontRow ? 'front' : 'back'}`}>
                  {p.role}<i>Z{p.zone}</i>
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3>Rally type</h3>
            <div className="seg">
              {[['combo', 'Custom combo'], ['drill', 'Free drill']].map(([kind, label]) => (
                <button key={kind} className={playType === kind ? 'active' : ''} onClick={() => setPlayType(kind)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="note" style={{ marginTop: 6 }}>
              {playType === 'drill'
                ? 'Free drill — tap an area (or click the 3D court) to place the 1st ball and the spike landing yourself.'
                : 'Custom combo — the setter (2nd touch) serves a ball you aim to the spiker (3rd touch).'}
            </p>
          </section>

          <section>
            <h3>Quick patterns</h3>
            <div className="seg">
              {QUICK_PLAYS.map((q) => (
                <button
                  key={q.label}
                  className={!s.drill.enabled && s.customCombo.zone === q.zone && s.customCombo.height === q.height && s.customCombo.tempo === q.tempo && s.customCombo.hitter === q.hitter ? 'active' : ''}
                  onClick={() => applyQuick(q)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>1st touch — where the ball starts</h3>
            {playType === 'drill' ? (
              <>
                <p className="note" style={{ marginBottom: 6 }}>
                  Tap an area on <b>Team A</b> to drop the feeder ball (green).
                </p>
                <TapGrid
                  side="A"
                  active={s.drill.firstBall}
                  accent="#7dffa0"
                  onPick={(pos) => s.setDrill({ firstBall: pos })}
                />
                <p className="note" style={{ marginTop: 8 }}>…or click anywhere on Team A's court in the 3D view.</p>
              </>
            ) : (
              <p className="note">
                The offense starts with a crisp pass to the setter. Use <b>Free drill</b> to place the ball anywhere yourself.
              </p>
            )}
          </section>

          <section>
            <h3>3rd touch — who spikes &amp; where the set goes</h3>
            <label className="field-label">Spiker (manual)</label>
            <div className="seg">
              {hitters.map((p) => (
                <button
                  key={p.role}
                  className={comboHitter === p.role ? 'active' : ''}
                  onClick={() => s.setCustomCombo({ hitter: p.role })}
                  title={`${p.role} — zone ${p.zone} (${p.isFrontRow ? 'front' : 'back'} row)`}
                >
                  {p.role}
                  {p.isFrontRow ? '' : ' *'}
                </button>
              ))}
            </div>
            <p className="note">* = back row — must take off behind the 3 m line.</p>

            <label className="field-label" style={{ marginTop: 8 }}>Set zone (2nd touch target)</label>
            <div className="seg">
              {COMBO_ZONES.map((z) => (
                <button
                  key={z.id}
                  className={s.customCombo.zone === z.id ? 'active' : ''}
                  onClick={() => s.setCustomCombo({ zone: z.id })}
                >
                  {z.name} <span className="muted">{z.label}</span>
                </button>
              ))}
            </div>

            <label className="field-label">Quickness &amp; arc</label>
            <div className="chips">
              {QUICKNESS_PRESETS.map((q) => (
                <button
                  key={q.label}
                  className={s.customCombo.tempo === q.tempo && s.customCombo.height === q.height ? 'active' : ''}
                  onClick={() => s.setCustomCombo({ tempo: q.tempo, height: q.height })}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <RangeField
              label="Set arc above net"
              value={s.customCombo.height}
              min={0.8} max={4.5} step={0.1}
              lo="Flat / quick" hi="High / loopy"
              onChange={(v) => s.setCustomCombo({ height: v })}
            />
            <RangeField
              label="Tempo (quick — high)"
              value={s.customCombo.tempo}
              min={1} max={3} step={0.1}
              lo="Quick (1)" hi="High (3)"
              onChange={(v) => s.setCustomCombo({ tempo: v })}
            />
            <RangeField
              label="Set distance from net"
              value={s.customCombo.netDist}
              min={0.5} max={2.9} step={0.1}
              lo="Tight to net" hi="Far off net"
              onChange={(v) => s.setCustomCombo({ netDist: v })}
            />
            <div className="combo-readout">
              <span>Net <b>{NET_HEIGHTS[s.netHeight]} m</b></span>
              <span>Set apex ≈ <b>{(NET_HEIGHTS[s.netHeight] + s.customCombo.height).toFixed(1)} m</b></span>
              <span>Quickness <b>T{s.customCombo.tempo.toFixed(1)}</b></span>
            </div>
          </section>

          <section>
            <h3>Spike landing — where it hits</h3>
            {playType === 'drill' ? (
              <>
                <p className="note" style={{ marginBottom: 6 }}>
                  Tap an area on <b>Team B</b> for the spike landing (red).
                </p>
                <TapGrid
                  side="B"
                  active={s.drill.spikeLanding}
                  accent="#ff6b6b"
                  onPick={(pos) => s.setDrill({ spikeLanding: pos })}
                />
                <p className="note" style={{ marginTop: 8 }}>…or click anywhere on Team B's court in the 3D view.</p>
              </>
            ) : (
              <div className="seg">
                {SPIKE_TARGETS.map((t) => (
                  <button
                    key={t.id}
                    className={s.customCombo.spikeTarget === t.id ? 'active' : ''}
                    onClick={() => s.setCustomCombo({ spikeTarget: t.id })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {verdict && (
            <section>
              <div className={`zone-card legal-${verdict.row}`} style={{ borderColor: verdict.color }}>
                <div className="zone-title" style={{ color: verdict.color }}>
                  {verdict.row === 'back' ? '⚠ ' : '✅ '}{verdict.title} · {verdict.role} (Z{verdict.zone})
                </div>
                <p>{verdict.msg}</p>
                <p className="legal-note">
                  Take-off: x {(r.hSpot[0]).toFixed(1)} · z {verdict.takeoffZ.toFixed(1)} m {verdict.row === 'back' ? '(behind the 3 m line)' : '(net to 3 m line)'}
                </p>
              </div>
            </section>
          )}

          <section>
            <h3>Opponent block</h3>
            <div className="seg">
              {BLOCK_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className={s.blockPattern === p.id ? 'active' : ''}
                  onClick={() => s.setBlockPattern(p.id)}
                >
                  {p.name}{p.count > 0 ? ` · ${p.count}` : ''}
                </button>
              ))}
            </div>
          </section>

          <RallyChain r={r} s={s} verdict={verdict} />
        </>
      )}

      {/* ================================================================== */}
      {/*  SERVE · RECEIVE TAB                                               */}
      {/* ================================================================== */}
      {tab === 'serve' && (
        <>
          <section>
            <h3>Mode</h3>
            <div className="seg">
              {[['attack', 'Attack'], ['receive', 'Serve-receive'], ['serve', 'Serve']].map(([m, label]) => (
                <button key={m} className={s.mode === m ? 'active' : ''} onClick={() => s.setMode(m)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {s.mode === 'receive' && (
            <>
              <section>
                <h3>Professional serve-receive (3 touches)</h3>
                <div className="seq-flow">
                  <div className="sf-step"><b>Server (Team B)</b><span>Float/Topspin → Team A court</span></div>
                  <div className="sf-arrow">↓</div>
                  <div className="sf-step sf-now"><b>1st · Receiver</b><span>Pass high to the setter</span></div>
                  <div className="sf-arrow">↓</div>
                  <div className="sf-step"><b>2nd · Setter {setter ? setter.role : 'S'}</b><span>Delivers the set from Z2/3</span></div>
                  <div className="sf-arrow">↓</div>
                  <div className="sf-step"><b>3rd · {r.hitter ? r.hitter.role : '—'}</b><span>Approach + spike (from the Rally tab)</span></div>
                </div>

                <label className="field-label" style={{ marginTop: 8 }}>Who receives the serve (1st touch)</label>
                <div className="seg">
                  <button className={s.receiveRole == null ? 'active' : ''} onClick={() => s.setReceiveRole(null)}>Auto · best passer</button>
                  {passers.map((p) => (
                    <button
                      key={p.role}
                      className={s.receiveRole === p.role ? 'active' : ''}
                      onClick={() => s.setReceiveRole(p.role)}
                      title={`${p.role} — zone ${p.zone} (${p.isFrontRow ? 'front' : 'back'} row)`}
                    >
                      {p.role}{p.isSetter ? ' (setter)' : ''}
                    </button>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 6 }}>Auto picks the nearest passer to the serve landing — set to a specific player to drill that passer.</p>

                <label className="field-label">Receive formation</label>
                <div className="seg">
                  {[['w', '3-person (W)'], ['2', '2-person'], ['5', '5-person']].map(([id, label]) => (
                    <button key={id} className={s.receiveFormation === id ? 'active' : ''} onClick={() => s.setReceiveFormation(id)}>
                      {label}
                    </button>
                  ))}
                </div>

                <label className="field-label">Where the serve lands</label>
                <div className="seg">
                  {RECEIVE_TARGETS.map((t) => (
                    <button key={t.id} className={!s.manualReceiveTarget && s.serveTarget === t.id ? 'active' : ''} onClick={() => { s.setManualReceiveTarget(null); s.setServeTarget(t.id) }}>
                      {t.name}
                    </button>
                  ))}
                </div>
                {s.manualReceiveTarget && (
                  <p className="note" style={{ marginTop: 6 }}>
                    Manual: x {s.manualReceiveTarget.x.toFixed(1)} · z {s.manualReceiveTarget.z.toFixed(1)} — click Team A's court to move.
                  </p>
                )}

                <label className="field-label">Spike landing (after the set)</label>
                <div className="seg">
                  {SPIKE_TARGETS.map((t) => (
                    <button
                      key={t.id}
                      className={s.customCombo.spikeTarget === t.id && !s.drill.enabled ? 'active' : ''}
                      onClick={() => { s.setDrill({ enabled: false }); s.setCustomCombo({ enabled: true, spikeTarget: t.id }) }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 6 }}>
                  The spiker &amp; set zone follow the <b>Rally tab</b>. Current: {r.hitter ? r.hitter.role : '—'} @ Z{r.combo.zone}.
                </p>
              </section>
            </>
          )}

          {s.mode === 'serve' && (
            <>
              <section>
                <h3>Serve type</h3>
                <div className="seg">
                  {SERVE_TYPES.map((t) => (
                    <button key={t.id} className={s.serveType === t.id ? 'active' : ''} onClick={() => s.setServeType(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 6 }}>{(SERVE_TYPES.find((t) => t.id === s.serveType) || SERVE_TYPES[1]).desc}</p>
              </section>
              <section>
                <h3>Target — against their receive</h3>
                <div className="seg">
                  {SERVE_TARGETS.map((t) => (
                    <button key={t.id} className={!s.manualServeTarget && s.serveTarget === t.id ? 'active' : ''} onClick={() => { s.setManualServeTarget(null); s.setServeTarget(t.id) }}>
                      {t.name}
                    </button>
                  ))}
                </div>
                {s.manualServeTarget && (
                  <p className="note" style={{ marginTop: 6 }}>
                    Manual: x {s.manualServeTarget.x.toFixed(1)} · z {s.manualServeTarget.z.toFixed(1)} — click Team B's court to aim.
                  </p>
                )}
              </section>
            </>
          )}

          {s.mode === 'attack' && (
            <section>
              <h3>Opponent receive</h3>
              <p className="note">Attack mode shows the offense vs. a resting opponent. Switch to <b>Serve-receive</b> to drill the full serve → pass → set → spike sequence, or <b>Serve</b> to practice serving at their formation.</p>
            </section>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/*  SETTINGS TAB                                                      */}
      {/* ================================================================== */}
      {tab === 'options' && (
        <section>
          <div className="row">
            <label>Realistic timing (approach sync)</label>
            <button className={`switch ${s.realisticTiming ? 'on' : ''}`} onClick={s.toggleRealistic} />
          </div>
          <div className="row">
            <label>Trajectory lines</label>
            <button className={`switch ${s.showTrajectory ? 'on' : ''}`} onClick={s.toggleTrajectory} />
          </div>
          <div className="row">
            <label>Spike zones &amp; markers</label>
            <button className={`switch ${s.drill.showZones ? 'on' : ''}`} onClick={() => s.setDrill({ showZones: !s.drill.showZones })} />
          </div>
          <div className="row">
            <label>Player labels</label>
            <button className={`switch ${s.labelsVisible ? 'on' : ''}`} onClick={s.toggleLabels} />
          </div>
          <div className="row">
            <label>Auto replay</label>
            <button className={`switch ${s.autoReplay ? 'on' : ''}`} onClick={s.toggleAutoReplay} />
          </div>
          <div className="row">
            <label>Playback speed</label>
            <input
              type="range" min="0.25" max="2" step="0.25"
              value={s.speed}
              onChange={(e) => s.setSpeed(parseFloat(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ color: 'var(--accent)', fontSize: 12 }}>{s.speed.toFixed(2)}×</span>
          </div>
          <div className="row">
            <label>Net height</label>
            <select value={s.netHeight} onChange={(e) => s.setNetHeight(e.target.value)}>
              <option value="men">Men (2.43 m)</option>
              <option value="women">Women (2.24 m)</option>
            </select>
          </div>
          <div className="row">
            <label>Camera</label>
            <select value={s.cameraPreset} onChange={(e) => s.setCameraPreset(e.target.value)}>
              {Object.entries(CAMERA_PRESETS).map(([id, p]) => (
                <option key={id} value={id}>{p.name}</option>
              ))}
            </select>
          </div>

          {s.system === '6-2' && (
            <div className="callout" style={{ marginTop: 8, display: 'block', textAlign: 'center' }}>
              {sixTwoLabel(s)}
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <label>Score: <b style={{ color: 'var(--accent)' }}>{s.scoreA} : {s.scoreB}</b></label>
            <button className="mini-btn" onClick={s.resetScore}>Reset</button>
          </div>
          <div className="row">
            <label>Rules &amp; info</label>
            <button className="mini-btn" onClick={s.toggleRules}>Read rules</button>
          </div>
        </section>
      )}

      <div className="play-row">
        <button
          className="play-btn"
          onClick={() => (s.phase !== 'idle' ? s.resetPlay() : s.startPlay())}
        >
          {s.phase !== 'idle' ? '■ Reset' : '▶ Play sequence'}
        </button>
        <button className="play-rules" onClick={s.toggleRules}>📖 Rules</button>
      </div>
    </div>
  )
}

function sixTwoLabel(s) {
  const lineup = buildLineup(s.system, s.rotation)
  const setter = activeSetter(s.system, lineup)
  if (!setter) return '6-2 — two setters, opposite rows'
  return setter.isFrontRow ? 'Setter in front row → attacking role' : 'Setter in back row → setting role'
}
