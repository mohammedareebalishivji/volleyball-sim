import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { CAMERA_PRESETS } from '../constants'

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function CameraRig() {
  const preset = useStore((s) => s.cameraPreset)
  const camera = useThree((s) => s.camera)
  const controlsRef = useRef()
  const tween = useRef(null)

  const targetPreset = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS[preset].target), [preset])

  useEffect(() => {
    if (!camera) return
    const p = CAMERA_PRESETS[preset]
    tween.current = {
      start: performance.now(),
      dur: 1400,
      fromPos: camera.position.clone(),
      fromTarget: controlsRef.current ? controlsRef.current.target.clone() : targetPreset.clone(),
      toPos: new THREE.Vector3(...p.pos),
      toTarget: new THREE.Vector3(...p.target),
    }
  }, [preset, camera, targetPreset])

  useFrame(() => {
    const tw = tween.current
    const ctrl = controlsRef.current
    if (tw && ctrl) {
      const t = (performance.now() - tw.start) / tw.dur
      if (t < 1) {
        const k = easeInOut(t)
        camera.position.lerpVectors(tw.fromPos, tw.toPos, k)
        ctrl.target.lerpVectors(tw.fromTarget, tw.toTarget, k)
      } else {
        camera.position.copy(tw.toPos)
        ctrl.target.copy(tw.toTarget)
        tween.current = null
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 - 0.04}
      target={[0, 1.2, 0]}
    />
  )
}
