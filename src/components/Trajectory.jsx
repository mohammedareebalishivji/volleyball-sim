import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { solve, BALL_R } from '../logic/physics'

const passMat = new THREE.LineBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.5 })
const setMat = new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.65 })
const spikeMat = new THREE.LineBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.65 })
const serveMat = new THREE.LineBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.65 })

const zeros = () => Array.from({ length: 18 }, () => new THREE.Vector3(0, 0, 0))

function fillLine(geo, p0, v, flight) {
  const pts = zeros()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = solve({ x: p0.x, y: p0.y, z: p0.z }, v, (flight * i) / (n - 1))
    pts[i].set(p.x, Math.max(p.y, BALL_R), p.z)
  }
  geo.setFromPoints(pts)
}

export function Trajectory() {
  const passLine = useRef()
  const setLine = useRef()
  const spikeLine = useRef()
  const serveLine = useRef()
  const passGeo = useRef(new THREE.BufferGeometry().setFromPoints(zeros()))
  const setGeo = useRef(new THREE.BufferGeometry().setFromPoints(zeros()))
  const spikeGeo = useRef(new THREE.BufferGeometry().setFromPoints(zeros()))
  const serveGeo = useRef(new THREE.BufferGeometry().setFromPoints(zeros()))

  useFrame(() => {
    const s = useStore.getState()
    const pLine = passLine.current
    const sLine = setLine.current
    const kLine = spikeLine.current
    const vLine = serveLine.current
    const hide = () => {
      if (pLine) pLine.visible = false
      if (sLine) sLine.visible = false
      if (kLine) kLine.visible = false
      if (vLine) vLine.visible = false
    }
    if (!s.showTrajectory || s.phase === 'idle') return hide()
    hide()

    // Serve + full receive sequence
    if ((s.mode === 'serve' || s.mode === 'receive') && s.servePlan) {
      if (vLine) vLine.visible = true
      const { p0, v, flightTime } = s.servePlan
      fillLine(serveGeo.current, p0, v, flightTime)
    }
    // Receive continues with pass -> set -> spike
    if (s.mode === 'receive' && s.receivePlan) {
      const rp = s.receivePlan
      if (pLine) pLine.visible = true
      fillLine(passGeo.current, rp.pass.p0, rp.pass.v, rp.pass.flightTime)
      if (sLine) sLine.visible = true
      fillLine(setGeo.current, rp.setHands, rp.set.v, rp.set.flightTime)
      if (kLine) kLine.visible = true
      fillLine(spikeGeo.current, rp.ballTarget, rp.spike.v, rp.spike.flightTime)
      return
    }

    const plan = s.plan
    if (!plan) return
    // pass (first touch into the setter)
    if (pLine) pLine.visible = true
    fillLine(passGeo.current, plan.passP0, plan.feedV, plan.passEnd)
    // set trajectory: setter release -> hitter target
    if (sLine) sLine.visible = true
    fillLine(setGeo.current, plan.setHands, plan.vSet, plan.setFlight)
    // spike trajectory: contact -> floor
    if (kLine) kLine.visible = true
    fillLine(spikeGeo.current, plan.ballTarget, plan.vSpike, 0.42)
  })

  return (
    <group>
      <line ref={passLine} geometry={passGeo.current} material={passMat} />
      <line ref={setLine} geometry={setGeo.current} material={setMat} />
      <line ref={spikeLine} geometry={spikeGeo.current} material={spikeMat} />
      <line ref={serveLine} geometry={serveGeo.current} material={serveMat} />
    </group>
  )
}
