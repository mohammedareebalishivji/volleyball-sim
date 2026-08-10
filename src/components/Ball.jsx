import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { solve, BALL_R } from '../logic/physics'
import { useStore } from '../store'

const ballMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 })
const trailGeo = new THREE.SphereGeometry(BALL_R * 0.9, 8, 6)

// shared mutable ball position so the trail can follow without store churn
export const ballPos = { v: new THREE.Vector3(0, 3, -7) }

function useBallTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f4c542'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#2f3133'
    ctx.fillRect(0, 20, 256, 6)
    ctx.fillRect(0, 62, 256, 6)
    ctx.fillRect(0, 104, 256, 6)
    ctx.beginPath()
    ctx.ellipse(128, 64, 70, 52, 0, 0, Math.PI * 2)
    ctx.lineWidth = 5
    ctx.stroke()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

export function Ball() {
  const group = useRef()
  const tex = useBallTexture()
  const rot = useRef(0)
  const mat = useMemo(() => {
    const m = ballMat.clone()
    m.map = tex
    return m
  }, [tex])

  useFrame((_, dt) => {
    const s = useStore.getState()
    const p = s.mode === 'serve' ? computeServeBall(s) : s.mode === 'receive' ? computeReceiveBall(s) : computeAttackBall(s)
    ballPos.v.copy(p)
    if (import.meta.env.DEV) window.__ballPos = ballPos
    if (group.current) {
      group.current.position.copy(p)
      rot.current += dt * 7
      group.current.rotation.set(rot.current * 0.6, rot.current, rot.current * 0.35)
    }
  })

  return (
    <group>
      <group ref={group}>
        <mesh geometry={trailGeo} material={mat} castShadow />
      </group>
      <TrailParticles />
    </group>
  )
}

function computeAttackBall(s) {
  const t = s.play.clock
  const { plan } = s
  if (!plan) return new THREE.Vector3(0, 3, -7)
  const releaseAt = plan.releaseAt
  const contactAt = plan.contactAt

  if (t < plan.passEnd) {
    const p0 = new THREE.Vector3(plan.passP0.x, plan.passP0.y, plan.passP0.z)
    return solve(p0, plan.feedV, t)
  }
  if (t < releaseAt) {
    return new THREE.Vector3(plan.setHands.x, plan.setHands.y - 0.1, plan.setHands.z)
  }
  if (t < contactAt) {
    const p0 = new THREE.Vector3(plan.setHands.x, plan.setHands.y, plan.setHands.z)
    return solve(p0, plan.vSet, t - releaseAt)
  }
  if (t < contactAt + 0.42) {
    const p0 = new THREE.Vector3(plan.ballTarget.x, plan.ballTarget.y, plan.ballTarget.z)
    const p = solve(p0, plan.vSpike, t - contactAt)
    if (p.y < BALL_R) p.y = BALL_R
    return p
  }
  // landed: freeze at impact
  const p0 = new THREE.Vector3(plan.ballTarget.x, plan.ballTarget.y, plan.ballTarget.z)
  const p = solve(p0, plan.vSpike, 0.42)
  p.y = BALL_R
  return p
}

// Full professional serve-receive: serve -> pass -> set -> spike.
function computeReceiveBall(s) {
  const t = s.play.clock
  const rp = s.receivePlan
  if (!rp) return new THREE.Vector3(0, 3, -9)
  const serve = rp.serve
  // toss — ball rises in the server's hand
  if (t < serve.releaseAt) {
    const k = t / serve.releaseAt
    return new THREE.Vector3(serve.p0.x, 2.0 + k * 0.45, serve.p0.z)
  }
  // serve flight
  if (t < serve.landAt) {
    const p = solve(serve.p0, serve.v, t - serve.releaseAt)
    if (p.y < BALL_R) p.y = BALL_R
    return new THREE.Vector3(p.x, p.y, p.z)
  }
  const pass = rp.pass
  // first touch: receiver pass toward the setter
  if (t < pass.landAt) {
    const p = solve(pass.p0, pass.v, t - pass.releaseAt)
    if (p.y < BALL_R) p.y = BALL_R
    return new THREE.Vector3(p.x, p.y, p.z)
  }
  const set = rp.set
  // second touch: ball in setter's hands, then released
  if (t < set.releaseAt) {
    return new THREE.Vector3(rp.setHands.x, rp.setHands.y, rp.setHands.z)
  }
  if (t < rp.contactAt) {
    const p = solve(rp.setHands, set.v, t - set.releaseAt)
    if (p.y < BALL_R) p.y = BALL_R
    return new THREE.Vector3(p.x, p.y, p.z)
  }
  // third touch: spike toward the opponent court
  const sp = rp.spike
  if (t < rp.contactAt + sp.flightTime) {
    const p = solve(rp.ballTarget, sp.v, t - rp.contactAt)
    if (p.y < BALL_R) p.y = BALL_R
    return new THREE.Vector3(p.x, p.y, p.z)
  }
  const p = solve(rp.ballTarget, sp.v, sp.flightTime)
  p.y = BALL_R
  return p
}

function computeServeBall(s) {
  const t = s.play.clock
  const { servePlan } = s
  if (!servePlan) return new THREE.Vector3(0, 3, -9)
  const { p0, v, flightTime, landPoint } = servePlan
  if (t < 0.45) return new THREE.Vector3(p0.x, 2.0 + t * 5, p0.z)
  const t2 = t - 0.45
  if (t2 < flightTime) {
    const p = solve(p0, v, t2)
    if (p.y < BALL_R) p.y = BALL_R
    return p
  }
  return new THREE.Vector3(landPoint.x, BALL_R, landPoint.z)
}

function TrailParticles() {
  const ref = useRef()
  const items = useRef(Array.from({ length: 10 }, () => ({ p: new THREE.Vector3(0, 3, -7), a: 0 })))

  useFrame((_, dt) => {
    items.current.unshift({ p: ballPos.v.clone(), a: 1 })
    items.current.pop()
    const meshes = ref.current?.children || []
    items.current.forEach((it, i) => {
      const m = meshes[i]
      if (!m) return
      m.position.copy(it.p)
      m.material.opacity = Math.max(0, it.a * 0.16)
    })
  })

  return (
    <group ref={ref}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} geometry={trailGeo}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}
