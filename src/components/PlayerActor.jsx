import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Humanoid } from './Player'
import {
  poseIdle, poseRun, poseApproach, poseJump, poseSpike, poseLand, poseSet, poseServe, poseBlock,
} from '../logic/animations'
import { useStore } from '../store'

const EASE = 8 // position smoothing

const labelCache = new Map()
function labelTexture(text, color) {
  const key = `${text}|${color}`
  if (labelCache.has(key)) return labelCache.get(key)
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgba(10,16,26,0.82)'
  const w = 60 + text.length * 34
  const r = 10
  ctx.beginPath()
  ctx.roundRect((256 - w) / 2, 6, w, 52, r)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 40px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 35)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  labelCache.set(key, tex)
  return tex
}

export function PlayerActor({ data, jerseyColor }) {
  const labelsVisible = useStore((s) => s.labelsVisible)
  // `data` is a mutable entry mutated each frame by the animator
  const root = useRef()
  const cur = useRef({ x: data ? data.pos[0] : 0, z: data ? data.pos[1] : 0 })
  const pose = useRef(null)

  useFrame((_, dt) => {
    if (!data) return
    const d = data
    const k = 1 - Math.exp(-EASE * dt)
    cur.current.x += (d.pos[0] - cur.current.x) * k
    cur.current.z += (d.pos[1] - cur.current.z) * k
    if (root.current) {
      root.current.position.set(cur.current.x, 0, cur.current.z)
      root.current.rotation.y = d.facing
    }

    const t = d.t ?? 0
    const prog = d.prog ?? 0
    let p
    switch (d.anim) {
      case 'idle': p = poseIdle(t, d.seed); break
      case 'run': p = poseRun(t * 9, d.seed); break
      case 'approach': p = poseApproach(t * 9, prog, d.seed); break
      case 'jump': p = poseJump(t, prog, d.hitRight); break
      case 'spike': p = poseSpike(t, prog, d.hitRight); break
      case 'land': p = poseLand(t, prog, d.seed); break
      case 'set': p = poseSet(t, prog, d.dirYaw); break
      case 'serve': p = poseServe(t, prog, d.serveType); break
      case 'block': p = poseBlock(t, prog, d.seed); break
      case 'receive': {
        const base = poseIdle(t, d.seed)
        p = {
          ...base,
          hipL: 0.55, hipR: 0.55,
          kneeL: 1.05, kneeR: 1.05,
          leanX: 0.42,
          spine: 0.1,
          headX: -0.05,
          armL: { shX: -0.55, shZ: 0.5, elbow: 0.08, wrist: 0 },
          armR: { shX: -0.55, shZ: -0.5, elbow: 0.08, wrist: 0 },
        }
        break
      }
      default: p = poseIdle(t, d.seed)
    }
    pose.current = p
  })

  const labelTex = useMemo(
    () => (labelsVisible && data ? labelTexture(data.label, data.color) : null),
    [labelsVisible, data],
  )

  return (
    <group ref={root} visible={!data || !data.hidden}>
      <Humanoid position={[0, 0, 0]} pose={pose} jerseyColor={jerseyColor} isLibero={data && data.role === 'L'} number={data.label} role={data.role} />
      {labelsVisible && data && !data.hidden && (
        <sprite position={[0, 2.35, 0]} scale={[0.85, 0.21, 0.85]}>
          <spriteMaterial map={labelTex} transparent depthWrite={false} />
        </sprite>
      )}
    </group>
  )
}
