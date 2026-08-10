import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { SPIKE_ZONE, SIGNALS, RECEIVE_TARGETS, SERVE_TARGETS, BLOCK_PATTERNS, BLOCK_COLOR, SPIKE_TARGETS } from '../constants'
import { buildLineup } from '../logic/rotation'
import { blockSpots } from '../logic/animator'

// Solid ring marker
function Marker({ position, color, label = '', pulse = false }) {
  const tex = useMemo(() => {
    if (!label) return null
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(8,14,22,0.75)'
    ctx.beginPath()
    ctx.roundRect(8, 8, 240, 48, 12)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 34)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [label, color])

  return (
    <group position={[position[0], 0.025, position[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.78, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {tex && (
        <sprite position={[0, 1.1, 0]} scale={[1.6, 0.4, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      )}
    </group>
  )
}

// Translucent zone + dashed outline on the floor
function Zone({ x, z0, z1, color, label, dim }) {
  const h = Math.abs(z1 - z0)
  const mid = (z0 + z1) / 2
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-x, 0.02, z0), new THREE.Vector3(x, 0.02, z0),
      new THREE.Vector3(x, 0.02, z1), new THREE.Vector3(-x, 0.02, z1),
      new THREE.Vector3(-x, 0.02, z0),
    ])
    return g
  }, [x, z0, z1])
  const tex = useMemo(() => {
    if (!label) return null
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(8,14,22,0.7)'
    ctx.beginPath()
    ctx.roundRect(8, 8, 240, 48, 12)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 26px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 34)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [label, color])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, mid]}>
        <planeGeometry args={[x * 2, h]} />
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.05 : 0.13} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <line geometry={lineGeo}>
        <lineBasicMaterial color={color} transparent opacity={dim ? 0.3 : 0.9} />
      </line>
      {tex && (
        <sprite position={[x * 0.62, 0.6, mid]} scale={[1.7, 0.42, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      )}
    </group>
  )
}

function attackingRole(s) {
  const lineup = buildLineup(s.system, s.rotation)
  const combo = s.customCombo
  const useCustom = combo.enabled || s.drill.enabled
  let role = null
  if (useCustom) {
    role = combo.hitter
  } else {
    const sig = SIGNALS.find((x) => x.id === s.signalId)
    if (sig) {
      const want = sig.hitter.split('/').map((v) => v.trim())
      const m = lineup.find((p) => want.some((w) => p.role.startsWith(w)) && p.role !== 'L')
      role = m ? m.role : null
    }
  }
  const pl = lineup.find((p) => p.role === role) || lineup.find((p) => !p.isSetter && p.role !== 'L')
  return { role: pl ? pl.role : null, row: pl && !pl.isFrontRow ? 'back' : 'front', zone: pl ? pl.zone : null, pl }
}

// Jump spot in world coords, honouring the selected hitter row + net distance.
function jumpSpotFrom(atk, s) {
  const useCustom = s.customCombo.enabled || s.drill.enabled
  const netDist = useCustom ? Math.max(0.5, Math.min(2.9, s.customCombo.netDist)) : 1.5
  const x = atk.zone === 4 ? -2.9 : atk.zone === 2 ? 2.9 : 0
  const z = atk.row === 'back' ? -Math.max(netDist, 3.2) : -netDist
  return [x, z]
}

export function ZoneOverlay() {
  const mode = useStore((s) => s.mode)
  const drill = useStore((s) => s.drill)
  const showZones = useStore((s) => s.drill.showZones)
  const manualServeTarget = useStore((s) => s.manualServeTarget)
  const manualReceiveTarget = useStore((s) => s.manualReceiveTarget)
  const blockPattern = useStore((s) => s.blockPattern)
  const signalId = useStore((s) => s.signalId)
  const comboZone = useStore((s) => s.customCombo.zone)

  if (!showZones) return null

  const atk = attackingRole(useStore.getState())

  // Always show the two legal attacking zones so the user learns them.
  const front = SPIKE_ZONE.front
  const back = SPIKE_ZONE.back
  const sigZone = drill.enabled || useStore.getState().customCombo.enabled ? comboZone : (SIGNALS.find((x) => x.id === signalId) || SIGNALS[3]).zone
  const blockSpotsXs = blockSpots(sigZone, blockPattern)
  const blockPatName = BLOCK_PATTERNS.find((p) => p.id === blockPattern)

  return (
    <group>
      {/* Baseline + attack line guides for reference */}      {mode === 'attack' && (
        <>
          <Zone {...front} dim={atk.row !== 'front'} />
          <Zone {...back} dim={atk.row !== 'back'} label="Back-row take-off zone (behind 3m line)" />
          {/* Jump spot marker for the selected hitter */}
          {atk.role && (
            <Marker
              position={jumpSpotFrom(atk, useStore.getState())}
              color={atk.row === 'back' ? '#ffd166' : '#66d9ff'}
              label={`${atk.role} jumps here (Z${atk.zone} · ${atk.row === 'back' ? 'back row' : 'front row'})`}
            />
          )}
          {/* Manual ball placement + spike landing */}
          {drill.enabled && (
            <>
              <Marker position={[drill.firstBall.x, drill.firstBall.z]} color="#7dffa0" label="Feeder ball (Team A)" />
              <Marker position={[drill.spikeLanding.x, drill.spikeLanding.z]} color="#ff6b6b" label="Spike landing (Team B)" />
            </>
          )}
          {/* Blocking pattern preview on Team B's side of the net */}
          {blockSpotsXs.map((sx, i) => (
            <Marker
              key={i}
              position={[sx, 0.4]}
              color={BLOCK_COLOR}
              label={i === 0 ? `Block — ${blockPatName ? blockPatName.name : ''}` : ''}
            />
          ))}
        </>
      )}

      {mode === 'serve' && (
        <>
          <Zone {...front} dim />
          <Zone {...back} dim />
          {manualServeTarget
            ? <Marker position={[manualServeTarget.x, manualServeTarget.z]} color="#66d9ff" label="Serve target (click to move)" />
            : SERVE_TARGETS.map((t) => <Marker key={t.id} position={[t.x, t.z]} color="#66d9ff" />)}
        </>
      )}

      {mode === 'receive' && (
        <>
          <Zone {...front} dim />
          <Zone {...back} dim />
          {manualReceiveTarget
            ? <Marker position={[manualReceiveTarget.x, manualReceiveTarget.z]} color="#66d9ff" label="Serve lands here (click to move)" />
            : RECEIVE_TARGETS.map((t) => <Marker key={t.id} position={[t.x, t.z]} color="#66d9ff" />)}
          {atk.role && (
            <Marker
              position={jumpSpotFrom(atk, useStore.getState())}
              color={atk.row === 'back' ? '#ffd166' : '#66d9ff'}
              label={`${atk.role} takes off here (Z${atk.zone} · ${atk.row === 'back' ? 'back row' : 'front row'})`}
            />
          )}
          {drill.enabled && (
            <Marker position={[drill.spikeLanding.x, drill.spikeLanding.z]} color="#ff6b6b" label="Spike landing (Team B)" />
          )}
          {useStore.getState().customCombo.enabled && !drill.enabled && (() => {
            const t = SPIKE_TARGETS.find((x) => x.id === useStore.getState().customCombo.spikeTarget)
            if (!t) return null
            return <Marker position={[t.x, t.z]} color="#ff6b6b" label="Spike landing (Team B)" />
          })()}
        </>
      )}

    </group>
  )
}
