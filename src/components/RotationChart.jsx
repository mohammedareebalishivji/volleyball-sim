import { useStore } from '../store'
import { buildLineup, liberoCoverFor, liberoSwapBetween } from '../logic/rotation'
import { ZONES_LIST, LIBERO_COLOR } from '../constants'

// Order of the FIVB zones shown inside each rotation card, front row first.
const ZONE_ROWS = [
  [4, 3, 2], // front row
  [1, 6, 5], // back row
]

const ROT_NAMES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']

// Full rotation chart: the six serving rotations of the current system, each
// drawn as a mini court, with the libero's coverage badge and the relay arrows
// showing where the libero swaps between middle blockers.
export function RotationChart() {
  const system = useStore((s) => s.system)
  const rotation = useStore((s) => s.rotation)

  const lineups = [0, 1, 2, 3, 4, 5].map((r) => ({ rotation: r, lineup: buildLineup(system, r) }))

  return (
    <div>
      <div className="rot-grid">
        {lineups.map(({ rotation: r, lineup }) => (
          <div key={r} className={`rot-card ${r === rotation ? 'current' : ''}`}>
            <div className="rot-card-head">
              <span>{ROT_NAMES[r]}</span>
              {r === rotation && <span className="rot-now">NOW</span>}
            </div>
            {ZONE_ROWS.map((row, ri) => (
              <div key={ri} className="rot-row">
                {row.map((zone) => {
                  const p = lineup.find((x) => x.zone === zone)
                  const isLibero = p && p.role === 'L'
                  const isSetter = p && p.isSetter
                  return (
                    <div
                      key={zone}
                      className={`rot-cell ${isLibero ? 'lib' : ''} ${isSetter ? 'set' : ''} ${p && p.isFrontRow ? 'front' : 'back'}`}
                      title={p ? `Z${p.zone} · ${p.isFrontRow ? 'front' : 'back'} row` : ''}
                    >
                      {isLibero ? 'L' : p ? p.role : '·'}
                    </div>
                  )
                })}
              </div>
            ))}
            <div className="rot-cover">
              {lineup.find((x) => x.role === 'L')
                ? <span style={{ color: LIBERO_COLOR }}>L ⇄ {liberoCoverFor(lineup)}</span>
                : <span className="muted">L on bench</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="rot-swaps">
        {[0, 1, 2, 3, 4].map((i) => {
          const swap = liberoSwapBetween(lineups[i].lineup, lineups[i + 1].lineup)
          return swap ? <span key={i} className="rot-swap">R{i + 1}→R{i + 2}: {swap}</span> : null
        })}
        {(() => {
          const wrap = liberoSwapBetween(lineups[5].lineup, lineups[0].lineup)
          return wrap ? <span className="rot-swap">R6→R1: {wrap}</span> : null
        })()}
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        The libero only defends in the back row. When the middle it covers rotates to the
        front row, the libero <b>swaps out</b> and the middle returns to the net — the
        <b> {liberoCoverFor(lineups[rotation].lineup)}</b> is covered now.
      </p>
    </div>
  )
}
