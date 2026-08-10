import { useEffect, useState } from 'react'
import { useStore } from '../store'

const RULES = [
  {
    icon: '🎯',
    title: 'Object of the game',
    body: 'Two teams of six rally the ball over a high net. The rally ends when the ball touches the floor, goes out, or a team fails to return it legally. The team that wins the rally scores a point.',
  },
  {
    icon: '🏅',
    title: 'Scoring',
    body: 'Modern volleyball uses rally scoring — every rally earns a point, regardless of who served. A set is won at 25 points with a 2-point lead (15 in the deciding set). Matches are best of five sets.',
  },
  {
    icon: '🔄',
    title: 'Rotation',
    body: 'Teams rotate clockwise each time they win the serve back. The six court positions are numbered 1 (back-right) through 6 (back-left), with positions 1, 6 and 5 in the back row and 2, 3 and 4 at the net. Players must be in order at the serve.',
  },
  {
    icon: '✋',
    title: 'Three touches',
    body: 'A team may touch the ball up to three times before sending it over the net (a block does not count). The classic rhythm is pass → set → spike. A player may not touch the ball twice in a row.',
  },
  {
    icon: '🧱',
    title: 'Net rules',
    body: 'Players may not touch the net while the ball is in play. A block must be on your own side. Reaching over the net is only allowed when blocking an attack or when the ball is entirely on your side.',
  },
  {
    icon: '🚫',
    title: 'Common faults',
    body: 'Carrying or catching the ball, double contact on the first hit, stepping on or over the line while serving, touching the floor outside your own court, and four or more team touches all lose the rally.',
  },
  {
    icon: '🦸',
    title: 'Libero',
    body: 'The libero is a defensive specialist in a contrasting jersey who plays only in the back row. They replace middles freely (not counted as a substitution) and cannot attack a ball above net height.',
  },
  {
    icon: '🧊',
    title: 'Serve rules',
    body: 'The server stands behind the end line and must hit the ball with one hand or arm. The serve may not be blocked or attacked when fully above net height, but it may land anywhere in the opponent court.',
  },
  {
    icon: '🧱',
    title: 'Blocking',
    body: 'A block happens at the net with hands raised; only front-row players block (the libero never blocks). A block does not count as one of the three touches. Single, double and triple blocks are shown in the simulator — the middle blocker usually covers the quick middle set, and the outside blockers join for wide attacks.',
  },
  {
    icon: '⏱️',
    title: 'Quickness (tempo)',
    body: "Sets are classed by tempo: tempo 1 (quick/back-set, peak just over the net), tempo 2 (medium) and tempo 3 (high, slow outside sets). As tempo increases the spikes' approach and flight get longer, giving the blockers more time to react.",
  },
  {
    icon: '🗺️',
    title: 'Court zones',
    body: 'Each side is split into six zones: front row 2 (right), 3 (centre) and 4 (left) near the net, and back row 1 (right back), 6 (centre back) and 5 (left back). Front-row attackers may jump anywhere on their side; back-row attackers must take off behind the 3 m line.',
  },
  {
    icon: '🎯',
    title: 'Serve-receive',
    body: 'In pro serve-receive the defending team guards against the serve in a formation, the selected receiver plays the 1st touch to the setter, the setter delivers the 2nd touch (the set), and the hitter finishes with the 3rd — the spike.',
  },
]

export function RulesOverlay() {
  const visible = useStore((s) => s.rulesVisible)
  const toggle = useStore((s) => s.toggleRules)
  const [listening, setListening] = useState(false)

  const startReading = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setListening(true)
    RULES.forEach((r, i) => {
      const u = new SpeechSynthesisUtterance(`${r.title}. ${r.body}`)
      u.lang = 'en-US'
      u.rate = 1.04
      u.onend = i === RULES.length - 1 ? () => setListening(false) : undefined
      u.onerror = i === RULES.length - 1 ? () => setListening(false) : undefined
      window.speechSynthesis.speak(u)
    })
  }

  const stopReading = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setListening(false)
  }

  // If the overlay closes while reading, stop the voice.
  useEffect(() => {
    if (!visible && listening) stopReading()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null

  return (
    <div className="rules-overlay" onClick={toggle}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-head">
          <h2>📖 Volleyball Rules — FIVB</h2>
          <button className="rules-close" onClick={toggle}>✕</button>
        </div>
        <div className="rules-body">
          {RULES.map((r) => (
            <div className="rule-card" key={r.title}>
              <div className="rule-icon">{r.icon}</div>
              <div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rules-actions">
          {listening ? (
            <button className="play-btn" onClick={stopReading}>⏹ Stop reading</button>
          ) : (
            <button className="play-btn" onClick={startReading}>🔊 Read rules aloud</button>
          )}
          <button className="play-btn" onClick={toggle}>Got it</button>
        </div>
      </div>
    </div>
  )
}
