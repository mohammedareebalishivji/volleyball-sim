import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

const CONFETTI_COUNT = 90
const COLORS = ['#ffd166', '#ff6b6b', '#66d9ff', '#7dffa0', '#c792ea', '#ffffff']

function makeConfetti() {
  const items = []
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    items.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      rotV: new THREE.Vector3(),
      life: 0,
      maxLife: 1.2 + Math.random() * 1.1,
      active: false,
    })
  }
  return items
}

export function Confetti() {
  const group = useRef()
  const prevEvent = useRef(0)
  const items = useMemo(makeConfetti, [])
  const geo = useMemo(() => new THREE.BoxGeometry(0.09, 0.06, 0.02), [])
  const mats = useMemo(
    () => COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true })),
    [],
  )

  useFrame((_, dt) => {
    const s = useStore.getState()
    if (s.pointEvent !== prevEvent.current) {
      prevEvent.current = s.pointEvent
      items.forEach((it) => {
        it.active = true
        it.life = 0
        it.pos.set(
          (Math.random() - 0.5) * 2.5,
          3.2 + Math.random() * 1.5,
          (Math.random() - 0.5) * 2.5,
        )
        it.vel.set(
          (Math.random() - 0.5) * 4,
          4.5 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        )
        it.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
        it.rotV.set(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        )
        it.maxLife = 1.2 + Math.random() * 1.1
      })
    }

    const g = group.current
    if (!g) return
    for (let i = 0; i < items.length; i++) {
      const m = g.children[i]
      const it = items[i]
      if (!m) continue
      if (!it.active) {
        m.visible = false
        continue
      }
      it.life += dt
      if (it.life > it.maxLife) {
        it.active = false
        m.visible = false
        continue
      }
      it.vel.y -= 9.8 * dt * 0.7
      it.vel.x *= 0.985
      it.vel.z *= 0.985
      it.pos.x += it.vel.x * dt
      it.pos.y += it.vel.y * dt
      it.pos.z += it.vel.z * dt
      it.rot.x += it.rotV.x * dt
      it.rot.y += it.rotV.y * dt
      it.rot.z += it.rotV.z * dt
      const fade = Math.max(0, 1 - it.life / it.maxLife)
      m.position.copy(it.pos)
      m.rotation.copy(it.rot)
      m.scale.setScalar(0.6 + fade * 0.4)
      m.material.opacity = fade
      m.visible = it.pos.y > 0.04
    }
  })

  return (
    <group ref={group}>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <mesh key={i} geometry={geo} material={mats[i % mats.length]} visible={false} />
      ))}
    </group>
  )
}
