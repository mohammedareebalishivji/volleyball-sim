import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { NET_HEIGHTS } from '../constants'

function useWoodTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 512
    const ctx = c.getContext('2d')
    // base wood
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#b8845a')
    g.addColorStop(0.5, '#c99563')
    g.addColorStop(1, '#b07a4e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 512)
    // plank lines
    for (let i = 0; i < 512; i += 34) {
      ctx.fillStyle = 'rgba(80,45,20,0.25)'
      ctx.fillRect(0, i, 1024, 3)
    }
    for (let i = 0; i < 1024; i += 128) {
      ctx.fillStyle = 'rgba(80,45,20,0.12)'
      ctx.fillRect(i, 0, 2, 512)
    }
    // subtle noise / grain
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 30},20,${0.03 + Math.random() * 0.05})`
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, 3, 2)
    }
    // team side tints (quarter zones)
    ctx.fillStyle = 'rgba(30,90,168,0.05)'
    ctx.fillRect(0, 0, 1024, 256)
    ctx.fillStyle = 'rgba(179,38,30,0.05)'
    ctx.fillRect(0, 256, 1024, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [])
}

// Realistic FIVB/VNL net: an open ~10 cm mesh of thin strands that you can see
// through, a sagging white top band, anchored at the side lines. The bottom edge
// is left open (competition nets have no bottom tape). Antennae rise 0.8 m above
// the top of the band at the side lines, and the posts stand clear of the court.
function Net() {
  const netHeight = useStore((s) => s.netHeight)
  const netY = NET_HEIGHTS[netHeight]

  const NET_LONG = 9.5 // net length (official 9.5-10 m)
  const HALF = NET_LONG / 2
  const SAG = 0.03 // slight drop in the middle of the top edge
  const CELL = 0.1 // ~10 cm square mesh
  const POST_X = 5.5 // posts ~1 m clear of the sideline (4.5 + 1 m)

  // Strands: a true instanced 3D grid of thin white cylinders (no filler plane).
  const { verts, horz } = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: '#f2f5fa', transparent: true, opacity: 0.55 })
    const geo = new THREE.CylinderGeometry(0.0038, 0.0038, 1, 6)
    const d = new THREE.Object3D()
    const nV = Math.round(NET_LONG / CELL) + 1
    const nH = Math.round(netY / CELL) + 1

    const verts = new THREE.InstancedMesh(geo, mat, nV)
    for (let i = 0; i < nV; i++) {
      const x = -HALF + (NET_LONG * i) / (nV - 1)
      const sagTop = SAG * Math.pow(Math.abs(x) / HALF, 2)
      d.position.set(x, (netY - sagTop) / 2, 0)
      d.scale.set(1, netY - sagTop, 1)
      d.updateMatrix()
      verts.setMatrixAt(i, d.matrix)
    }
    verts.instanceMatrix.needsUpdate = true

    const horz = new THREE.InstancedMesh(geo, mat, nH)
    for (let j = 0; j < nH; j++) {
      const h = (netY * j) / (nH - 1)
      d.position.set(0, h, 0)
      d.scale.set(NET_LONG, 1, 1)
      d.rotation.set(0, 0, Math.PI / 2)
      d.updateMatrix()
      horz.setMatrixAt(j, d.matrix)
    }
    horz.instanceMatrix.needsUpdate = true
    return { verts, horz }
  }, [netY])

  // Sagging white top band (7 cm wide on real nets).
  const topBandGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(NET_LONG, 0.08, 28, 1)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      pos.setY(i, pos.getY(i) - SAG * Math.pow(Math.abs(x) / HALF, 2))
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d6dae0', metalness: 0.85, roughness: 0.22 }), [])
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef0f2', metalness: 0.5, roughness: 0.4 }), [])

  return (
    <group>
      {/* the mesh itself */}
      <primitive object={verts} />
      <primitive object={horz} />

      {/* top tape */}
      <mesh geometry={topBandGeo} position={[0, netY, 0]}>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>

      {/* side bands anchored to the court sidelines (9 m apart) */}
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} position={[x, netY / 2, 0]}>
          <boxGeometry args={[0.08, netY, 0.03]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}

      {/* antennae: red/white striped rods rising 0.8 m above the net */}
      {[-4.5, 4.5].map((x) => (
        <group key={`ant${x}`} position={[x, netY, 0]}>
          {[0, 0.2, 0.4, 0.6].map((y) => (
            <mesh key={y} position={[0, y + 0.1, 0]}>
              <cylinderGeometry args={[0.011, 0.011, 0.2, 8]} />
              <meshBasicMaterial color={((y / 0.2) | 0) % 2 === 0 ? '#e0231e' : '#ffffff'} />
            </mesh>
          ))}
        </group>
      ))}

      {/* posts + weighted bases, clear of the sideline */}
      {[-POST_X, POST_X].map((x) => (
        <group key={x}>
          <mesh position={[x, (netY + 0.35) / 2, 0]} material={postMat}>
            <cylinderGeometry args={[0.045, 0.06, netY + 0.35, 12]} />
          </mesh>
          <mesh position={[x, netY + 0.3, 0]} material={postMat}>
            <cylinderGeometry args={[0.024, 0.034, 0.25, 12]} />
          </mesh>
          <mesh position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={baseMat}>
            <cylinderGeometry args={[0.22, 0.22, 0.035, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Court() {
  const wood = useWoodTexture()
  const lineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 }), [])
  const outlineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e6e6e6', roughness: 0.5 }), [])
  const strip = useMemo(() => new THREE.BoxGeometry(0.05, 0.02, 0.05), [])

  const H = 9 // court length half
  const W = 4.5 // court width half

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W * 2, H * 2]} />
        <meshStandardMaterial map={wood} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* outer court border (safety floor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[W * 2 + 5, H * 2 + 5]} />
        <meshStandardMaterial color="#1c242f" roughness={1} />
      </mesh>

      {/* line markings — Team A side (z<0) */}
      {[{ z: -H, x: 0 }, { z: 0, x: 0 }].map((l, i) => (
        <mesh key={`bl${i}`} geometry={strip} material={outlineMat} position={[l.x, 0.02, l.z]} scale={[W * 2 / 0.05, 1, 1]} />
      ))}
      {[{ x: -W, z: -H / 2 }, { x: W, z: -H / 2 }, { x: -W, z: H / 2 }, { x: W, z: H / 2 }].map((l, i) => (
        <mesh key={`bb${i}`} geometry={strip} material={outlineMat} position={[l.x, 0.02, l.z]} scale={[0.05, 1, H / 0.05]} />
      ))}
      {/* attack lines at z = ±3 */}
      <mesh geometry={strip} material={lineMat} position={[0, 0.022, -3]} scale={[W * 2 / 0.05, 1, 1]} />
      <mesh geometry={strip} material={lineMat} position={[0, 0.022, 3]} scale={[W * 2 / 0.05, 1, 1]} />
      {/* center line */}
      <mesh geometry={strip} material={outlineMat} position={[0, 0.022, 0]} scale={[W * 2 / 0.05, 1, 1]} />

      {/* net */}
      <Net />

      {/* sideline floor decals: zone numbers (FIVB, both halves mirrored) */}
      {/* Team A (defends z<0): zone 1 back right → zone 6 back middle */}
      {[
        ['1', 3.25, -4.5], ['2', 3.25, -1.4], ['3', 0, -1.4],
        ['4', -3.25, -1.4], ['5', -3.25, -4.5], ['6', 0, -4.5],
      ].map(([n, x, z]) => (
        <Sprite key={`A${n}`} text={n} position={[x, 0.03, z]} />
      ))}
      {/* Team B (mirrored, z>0): same numbering from Team B's own perspective */}
      {[
        ['1', -3.25, 4.5], ['2', -3.25, 1.4], ['3', 0, 1.4],
        ['4', 3.25, 1.4], ['5', 3.25, 4.5], ['6', 0, 4.5],
      ].map(([n, x, z]) => (
        <Sprite key={`B${n}`} text={n} position={[x, 0.03, z]} />
      ))}
    </group>
  )
}

function Sprite({ text, position }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = 'bold 44px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 32, 36)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text])
  return (
    <sprite position={position} scale={[0.7, 0.7, 0.7]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  )
}

// Arena shell with a stylised animated crowd (head + torso silhouettes,
// bob + crowd-wave + cheer on scored points).
export function Arena() {
  return (
    <group>
      <Crowd />
      {/* arena floor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0d1117" roughness={1} />
      </mesh>
      {/* scoreboard screens */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 12, 9.5, 0]} rotation={[0, side * Math.PI, 0]}>
          <mesh>
            <boxGeometry args={[7, 2, 0.3]} />
            <meshStandardMaterial color="#05070c" roughness={0.5} />
          </mesh>
          <ScoreBoard3D side={side} />
        </group>
      ))}
    </group>
  )
}

// Live TV-style scoreboard that redraws whenever the score changes.
function ScoreBoard3D({ side }) {
  const scoreA = useStore((s) => s.scoreA)
  const scoreB = useStore((s) => s.scoreB)

  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 160
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide })
  }, [])

  useEffect(() => {
    const ctx = mat.map.image.getContext('2d')
    const W = 640
    const H = 160
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#05070c'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fillRect(0, 0, W, 30)
    ctx.font = '600 26px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#8b93a3'
    ctx.fillText('VOLLEYBALL SIM · VNL · LIVE', W / 2, 21)
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(W / 2 - 2, 52, 4, H - 52)
    ctx.font = '800 30px system-ui'
    ctx.fillStyle = '#5d9dff'
    ctx.fillText('TEAM A', W / 4, 92)
    ctx.fillStyle = '#ff7a70'
    ctx.fillText('TEAM B', (3 * W) / 4, 92)
    ctx.font = '900 92px system-ui'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(scoreA), W / 4, 148)
    ctx.fillText(String(scoreB), (3 * W) / 4, 148)
    mat.map.needsUpdate = true
  }, [scoreA, scoreB, mat])

  return (
    <mesh material={mat} position={[0, 0, 0.18]}>
      <planeGeometry args={[6.4, 1.6]} />
    </mesh>
  )
}

function Crowd() {
  const prevPoint = useRef(0)
  const cheer = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const crowd = useMemo(() => {
    const n = 340
    const bodyGeo = new THREE.BoxGeometry(0.95, 1.35, 0.62)
    const headGeo = new THREE.SphereGeometry(0.42, 10, 8)
    const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), n)
    const head = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: '#d9a17a', roughness: 0.9 }), n)
    const color = new THREE.Color()
    const palette = ['#e0c28c', '#f4f4f4', '#2a3240', '#7e57c2', '#2196f3', '#ef5350', '#26a69a', '#b3261e', '#1e5aa8', '#ffd166', '#ff8c42', '#75c2e8']
    const phases = new Float32Array(n)
    const speeds = new Float32Array(n)
    const baseX = new Float32Array(n)
    const baseY = new Float32Array(n)
    const baseZ = new Float32Array(n)
    let i = 0
    for (let ring = 0; ring < 6 && i < n; ring++) {
      const r = 13 + ring * 2.5 + Math.random() * 0.8
      const per = Math.ceil((n - i) / (6 - ring))
      for (let j = 0; j < per && i < n; j++) {
        const a = (j / per) * Math.PI * 2 + Math.random() * 0.12
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const y = 0.36 + Math.random() * 0.4
        dummy.position.set(x, y, z)
        dummy.rotation.set(0, -a, 0)
        dummy.scale.setScalar(0.85 + Math.random() * 0.5)
        dummy.updateMatrix()
        body.setMatrixAt(i, dummy.matrix)
        head.setMatrixAt(i, dummy.matrix)
        color.set(palette[(Math.random() * palette.length) | 0])
        body.setColorAt(i, color)
        phases[i] = Math.random() * Math.PI * 2
        speeds[i] = 0.6 + Math.random() * 1.2
        baseX[i] = x
        baseY[i] = y
        baseZ[i] = z
        i++
        if (i === n) break
      }
    }
    body.instanceMatrix.needsUpdate = true
    body.instanceColor.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    return { body, head, phases, speeds, baseX, baseY, baseZ }
  }, [])

  useFrame((state) => {
    const s = useStore.getState()
    if (s.pointEvent !== prevPoint.current) {
      prevPoint.current = s.pointEvent
      cheer.current = 1
    }
    cheer.current = Math.max(0, cheer.current - 0.013)
    const t = state.clock.elapsedTime
    const { phases, speeds, baseX, baseY, baseZ } = crowd
    const n = crowd.body.count
    for (let i = 0; i < n; i++) {
      const bob = Math.sin(t * speeds[i] + phases[i]) * 0.06
      const swayX = Math.sin(t * 0.55 + phases[i] * 1.6) * 0.1
      const angle = Math.atan2(baseZ[i], baseX[i])
      const wave = Math.sin(angle * 2.2 - t * 1.6) * 0.11
      const jump = cheer.current > 0 ? cheer.current * Math.max(0, Math.sin(t * 8 + phases[i])) * 0.3 : 0
      dummy.position.set(baseX[i] + swayX, baseY[i] + bob + wave + jump, baseZ[i])
      dummy.rotation.set(0, -angle, 0)
      dummy.updateMatrix()
      crowd.body.setMatrixAt(i, dummy.matrix)
      // head rides ~1.4 m up the torso (offset along facing dir, keep simple)
      dummy.position.set(baseX[i] + swayX, baseY[i] + bob + wave + jump + 1.42, baseZ[i])
      dummy.updateMatrix()
      crowd.head.setMatrixAt(i, dummy.matrix)
    }
    crowd.body.instanceMatrix.needsUpdate = true
    crowd.head.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={[0, -0.1, 0]}>
      <primitive object={crowd.body} />
      <primitive object={crowd.head} />
    </group>
  )
}
