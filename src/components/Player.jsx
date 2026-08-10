import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================================================
//  Athlete humanoid (~1.85 m tall) built from primitives + lathe muscle
//  profiles so the silhouette reads as a real person, not a stick figure.
//  Hierarchy: root -> body -> legs | pelvis -> spine -> torso -> neck/head/arms
// ============================================================================

// Shared materials (module singletons) so 12 players don't duplicate GPU programs
const jerseyMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.05 })
const shortsMat = new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.92 })
const shoeMat = new THREE.MeshStandardMaterial({ color: '#0e1218', roughness: 0.95 })
const soleMat = new THREE.MeshStandardMaterial({ color: '#f4f6f9', roughness: 0.9 })
const hairMat = new THREE.MeshStandardMaterial({ color: '#241a12', roughness: 0.88 })
const eyeMat = new THREE.MeshStandardMaterial({ color: '#13161c', roughness: 0.2 })
const mouthMat = new THREE.MeshStandardMaterial({ color: '#a2655a', roughness: 0.85 })
const padMat = new THREE.MeshStandardMaterial({ color: '#1b2431', roughness: 0.85 })
const sockMat = new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.9 })

const skinToneVariants = ['#d9a17a', '#c98d62', '#a9794f', '#e5b78d', '#8c5a3b', '#bf8a63']

// -------------------- shared geometry cache --------------------
const geoCache = new Map()
function cyl(rt, rb, h, seg = 14) {
  const key = `c_${rt}_${rb}_${h}_${seg}`
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(rt, rb, h, seg))
  return geoCache.get(key)
}
function box(w, h, d) {
  const key = `b_${w}_${h}_${d}`
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d))
  return geoCache.get(key)
}
function sph(r, ws = 14, hs = 10) {
  const key = `s_${r}_${ws}_${hs}`
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, ws, hs))
  return geoCache.get(key)
}

// Smooth lathe geometry from a [radius, height] muscle profile, heights run
// downward from 0 (joint end) to negative. Reused across all 12 players.
function lathe(profile, segs = 26) {
  const key = `l_${profile.map((p) => p.join(',')).join('|')}_${segs}`
  if (geoCache.has(key)) return geoCache.get(key)
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs)
  geoCache.set(key, g)
  return g
}

// Classic volleyball physique: full chest, taper waist, strong quads/calves.
const limbProfiles = {
  torso:    [[0.155, -0.05], [0.17, 0.06], [0.22, 0.2], [0.205, 0.3], [0.15, 0.42], [0.095, 0.5], [0.0, 0.56]],
  pelvis:   [[0.16, 0.05], [0.155, -0.02], [0.175, -0.08], [0.16, -0.16], [0.145, -0.2]],
  neck:     [[0.055, -0.02], [0.06, 0.03], [0.052, 0.08], [0.048, 0.1]],
  upperArm: [[0.058, 0], [0.068, -0.06], [0.072, -0.13], [0.06, -0.22], [0.049, -0.29], [0.04, -0.34]],
  foreArm:  [[0.038, 0], [0.045, -0.05], [0.046, -0.12], [0.04, -0.2], [0.032, -0.28], [0.026, -0.33]],
  thigh:    [[0.095, 0.02], [0.115, -0.07], [0.13, -0.15], [0.12, -0.25], [0.095, -0.35], [0.065, -0.45]],
  shin:     [[0.052, 0.02], [0.07, -0.06], [0.075, -0.13], [0.06, -0.25], [0.044, -0.39], [0.032, -0.49]],
  shorts:   [[0.115, 0.02], [0.128, -0.05], [0.133, -0.1], [0.128, -0.14], [0.12, -0.18]],
}

const poseDefaults = {
  bounce: 0, leanX: 0, leanZ: 0, turn: 0, spine: 0,
  headX: 0, headY: 0,
  hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, ankleL: 0, ankleR: 0,
  legZL: 0, legZR: 0,
  armL: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
  armR: { shX: 0, shZ: 0, elbow: 0, wrist: 0 },
}

const numCache = new Map()
function numberTexture(text) {
  if (numCache.has(text)) return numCache.get(text)
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 96
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 96, 96)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 64px ui-sans-serif, system-ui'
  ctx.lineWidth = 9
  ctx.strokeStyle = 'rgba(8,12,18,0.55)'
  ctx.strokeText(text, 48, 52)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, 48, 52)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  numCache.set(text, t)
  return t
}

function pickSkin(number) {
  const s = String(number || '0')
  const h = (s.charCodeAt(0) || 0) + (s.charCodeAt(1) || 0) * 3
  return skinToneVariants[((h % skinToneVariants.length) + skinToneVariants.length) % skinToneVariants.length]
}

export function Humanoid({ position, facing = 0, jerseyColor, pose, isLibero, scale = 1, number = '7' }) {
  const root = useRef()
  const body = useRef()
  const pelvis = useRef()
  const spine = useRef()
  const torso = useRef()
  const neck = useRef()
  const head = useRef()
  const armL = useRef()
  const elbL = useRef()
  const wristL = useRef()
  const armR = useRef()
  const elbR = useRef()
  const wristR = useRef()
  const hipL = useRef()
  const kneeL = useRef()
  const ankleL = useRef()
  const hipR = useRef()
  const kneeR = useRef()
  const ankleR = useRef()

  const skinVariant = useMemo(() => pickSkin(number), [number])
  const legSkin = useMemo(() => {
    const m = jerseyMat.clone()
    m.color.set(skinVariant)
    m.roughness = 0.7
    delete m.map
    return m
  }, [skinVariant])

  const mat = useMemo(() => {
    const m = jerseyMat.clone()
    m.color.set(jerseyColor || (isLibero ? '#0f8f76' : '#1e5aa8'))
    return m
  }, [jerseyColor, isLibero])

  const numTex = useMemo(() => numberTexture(number), [number])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = pose.current ? { ...poseDefaults, ...pose.current } : poseDefaults
    const aL = { ...poseDefaults.armL, ...p.armL }
    const aR = { ...poseDefaults.armR, ...p.armR }
    const calm = Math.abs(p.bounce) < 0.02
    if (root.current) {
      root.current.position.set(position[0], 0, position[2])
      root.current.rotation.y = facing
    }
    if (body.current) {
      body.current.position.y = p.bounce
      body.current.rotation.set(p.leanZ * 0.5, p.turn * 0.35, p.leanX * -0.3)
    }
    if (pelvis.current) pelvis.current.rotation.z = p.leanZ
    if (spine.current) spine.current.rotation.x = p.leanX + p.spine
    if (torso.current) {
      torso.current.rotation.x = p.leanX
      torso.current.rotation.z = p.leanZ
      torso.current.rotation.y = p.turn
      // breathing chest rise
      const br = Math.sin(t * 2.1) * (calm ? 0.012 : 0.02)
      torso.current.scale.set(1 + br, 1 - br * 0.7, 1)
    }
    if (neck.current) neck.current.rotation.x = p.headX
    if (head.current) {
      head.current.rotation.set(p.headX, p.headY, 0)
      // slight head bob when moving, gentle idle sway
      head.current.position.y = calm ? Math.sin(t * 1.3) * 0.006 : p.bounce * 0.25
    }

    if (armL.current) {
      armL.current.rotation.set(aL.shX, 0, aL.shZ)
      if (elbL.current) elbL.current.rotation.x = aL.elbow + (calm ? 0.07 + Math.sin(t * 1.6) * 0.015 : 0)
      if (wristL.current) wristL.current.rotation.x = aL.wrist
    }
    if (armR.current) {
      armR.current.rotation.set(aR.shX, 0, aR.shZ)
      if (elbR.current) elbR.current.rotation.x = aR.elbow + (calm ? 0.07 + Math.sin(t * 1.7 + 1.2) * 0.015 : 0)
      if (wristR.current) wristR.current.rotation.x = aR.wrist
    }
    if (hipL.current) {
      hipL.current.rotation.set(p.hipL, 0, p.legZL)
      if (kneeL.current) kneeL.current.rotation.x = p.kneeL
      if (ankleL.current) ankleL.current.rotation.x = p.ankleL
    }
    if (hipR.current) {
      hipR.current.rotation.set(p.hipR, 0, p.legZR)
      if (kneeR.current) kneeR.current.rotation.x = p.kneeR
      if (ankleR.current) ankleR.current.rotation.x = p.ankleR
    }
  })

  const scl = scale
  const L = limbProfiles

  const leg = (side) => {
    const hipRef = side === 'L' ? hipL : hipR
    const kneeRef = side === 'L' ? kneeL : kneeR
    const ankleRef = side === 'L' ? ankleL : ankleR
    const hipX = side === 'L' ? -0.1 : 0.1
    const sideSign = side === 'L' ? -1 : 1
    return (
      <group ref={hipRef} position={[hipX, 1.0, 0]}>
        {/* shorts over the upper thigh */}
        <mesh geometry={lathe(L.shorts)} material={mat} />
        {/* thigh */}
        <mesh geometry={lathe(L.thigh)} material={legSkin} />
        <group ref={kneeRef} position={[0, -0.45, 0]}>
          <mesh geometry={sph(0.05, 12, 8)} material={legSkin} position={[0, 0.01, 0]} />
          {/* kneepad */}
          <mesh geometry={sph(0.048, 12, 8)} material={padMat} scale={[1, 1, 0.5]} position={[0, 0.015, 0.05]} />
          {/* shin */}
          <mesh geometry={lathe(L.shin)} material={legSkin} />
          {/* sock */}
          <mesh geometry={cyl(0.042, 0.04, 0.18, 10)} material={sockMat} position={[0, -0.42, 0]} />
          <group ref={ankleRef} position={[0, -0.49, 0]}>
            <mesh geometry={sph(0.033, 10, 8)} material={legSkin} />
            {/* foot */}
            <mesh geometry={box(0.09, 0.07, 0.27)} material={legSkin} position={[0.01, -0.035, 0.14]} />
            {/* shoe body + heel */}
            <mesh geometry={box(0.103, 0.075, 0.3)} material={shoeMat} position={[0.01, -0.042, 0.15]} />
            <mesh geometry={box(0.08, 0.07, 0.1)} material={shoeMat} position={[0.01, -0.06, -0.02]} />
            {/* sole + lace accent */}
            <mesh geometry={box(0.105, 0.026, 0.31)} material={soleMat} position={[0.01, -0.084, 0.15]} />
            <mesh geometry={box(0.012, 0.032, 0.03)} material={sockMat} position={[sideSign * 0.01, -0.022, 0.13]} />
          </group>
        </group>
      </group>
    )
  }

  const arm = (side) => {
    const shoulder = side === 'L' ? armL : armR
    const elbRef = side === 'L' ? elbL : elbR
    const wristRef = side === 'L' ? wristL : wristR
    const shX = side === 'L' ? -0.21 : 0.21
    const sideSign = side === 'L' ? -1 : 1
    return (
      <group ref={shoulder} position={[shX, 0.28, 0]}>
        {/* deltoid cap */}
        <mesh geometry={sph(0.056, 12, 8)} material={mat} position={[0, 0.01, 0]} />
        {/* upper arm (sleeve) */}
        <mesh geometry={lathe(L.upperArm)} material={mat} />
        <group ref={elbRef} position={[0, -0.34, 0]}>
          <mesh geometry={sph(0.033, 10, 8)} material={legSkin} />
          {/* forearm */}
          <mesh geometry={lathe(L.foreArm)} material={legSkin} />
          <group ref={wristRef} position={[0, -0.33, 0]}>
            <mesh geometry={sph(0.025, 8, 6)} material={legSkin} />
            {/* hand: palm + thumb + fingers */}
            <mesh geometry={box(0.033, 0.042, 0.15)} material={legSkin} position={[0, -0.048, 0.075]} />
            <mesh geometry={sph(0.018, 6, 5)} material={legSkin} position={[sideSign * 0.027, -0.052, 0.02]} />
            {[0.05, 0.078, 0.106].map((d, i) => (
              <mesh key={i} geometry={cyl(0.012, 0.009, 0.05, 6)} material={legSkin} position={[sideSign * (i - 1) * 0.009, -0.048, 0.11 + d]} />
            ))}
          </group>
        </group>
      </group>
    )
  }

  return (
    <group ref={root}>
      <group ref={body} scale={[scl, scl, scl]}>
        {leg('L')}
        {leg('R')}

        {/* pelvis / hips */}
        <group ref={pelvis} position={[0, 1.02, 0]}>
          <mesh geometry={lathe(L.pelvis)} material={mat} />
          <group ref={spine} position={[0, 0.02, 0]}>
            <group ref={torso} position={[0, 0.02, 0]}>
              {/* chest / back */}
              <mesh geometry={lathe(L.torso)} material={mat} />
              {/* jersey number on the back */}
              <mesh position={[0, 0.2, -0.19]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.3, 0.3]} />
                <meshBasicMaterial map={numTex} transparent depthWrite={false} />
              </mesh>
              {/* neck */}
              <group ref={neck} position={[0, 0.47, 0]}>
                <mesh geometry={lathe(L.neck)} material={legSkin} />
                <group ref={head} position={[0, 0.14, 0]}>
                  {headFace(legSkin)}
                </group>
              </group>
              {/* shoulders + arms outside the neck */}
              {arm('L')}
              {arm('R')}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function headFace(skinMatLocal) {
  return (
    <>
      {/* skull */}
      <mesh geometry={sph(0.118, 20, 16)} material={skinMatLocal} scale={[0.96, 1.06, 1]} position={[0, 0.03, 0]} />
      {/* chin / jaw */}
      <mesh geometry={sph(0.09, 14, 10)} material={skinMatLocal} scale={[0.9, 0.8, 0.95]} position={[0, -0.085, 0.045]} />
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={sph(0.024, 8, 6)} material={skinMatLocal} position={[s * 0.115, -0.005, 0]} />
      ))}
      {/* hair */}
      <mesh geometry={sph(0.126, 18, 14)} material={hairMat} scale={[1.02, 0.78, 1.02]} position={[0, 0.05, 0]} />
      <mesh geometry={sph(0.05, 10, 8)} material={hairMat} position={[0, 0.095, -0.03]} />
      {/* eyes */}
      {[-1, 1].map((s) => (
        <mesh key={`e${s}`} geometry={sph(0.013, 8, 6)} material={eyeMat} position={[s * 0.046, 0.012, 0.105]} />
      ))}
      {/* brow */}
      {[-1, 1].map((s) => (
        <mesh key={`br${s}`} geometry={box(0.035, 0.009, 0.008)} material={hairMat} position={[s * 0.046, 0.04, 0.108]} />
      ))}
      {/* nose */}
      <mesh geometry={sph(0.016, 8, 6)} material={skinMatLocal} scale={[0.7, 1.1, 0.9]} position={[0, -0.018, 0.112]} />
      {/* mouth */}
      <mesh geometry={box(0.032, 0.008, 0.006)} material={mouthMat} position={[0, -0.052, 0.102]} />
    </>
  )
}