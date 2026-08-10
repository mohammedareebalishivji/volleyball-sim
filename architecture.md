# Architecture

This document describes how the volleyball simulator is organized and how a rally moves through the system.

## Overview

The app is a single-page React application. A full-screen `<Canvas>` from React Three Fiber renders the 3D scene; a DOM overlay renders the HUD and control panel. There is no backend — everything runs client-side, driven by a global [Zustand](https://github.com/pmndrs/zustand) store.

The central design idea is **plan-based playback**: instead of physics simulating live, every rally is pre-computed into a *plan* (a set of ball parameters and timestamps). Each frame, the scene reads the play clock from the store and samples the plan deterministically. This keeps simulation cheap, repeatable, and easy to scrub, while player animation is layered on top via parametric poses.

```
User input ──► store (zustand) ──► plan builders (logic/) ──► per-frame sampling ──► 3D scene + HUD
     (UI / keyboard)      state                 physics.js            Ball / PlayerActor /
                                                                    Trajectory / CameraRig
```

## Directory Layout

```
src/
├── main.jsx                 ReactDOM entry point
├── App.jsx                  Canvas + UI layer composition, keyboard shortcuts
├── store.js                 zustand store: all game state + actions
├── constants.js             court dimensions, zone map, signals, serve/spike targets, presets
├── style.css                DOM UI styling
├── components/              React components
│   ├── Scene.jsx            root of the 3D scene; per-frame `step()` driver
│   ├── Court.jsx            Court() + Arena() (floor, lines, net, banners)
│   ├── CameraRig.jsx        OrbitControls + eased tween between camera presets
│   ├── Player.jsx           Humanoid() — low-poly rig built from primitives
│   ├── PlayerActor.jsx      binds an animator entry to a Humanoid via pose lookup
│   ├── Ball.jsx             ball mesh + trail; samples the active plan each frame
│   ├── Trajectory.jsx       preview arc for the current plan
│   ├── ZoneOverlay.jsx      spiking zones / placement markers
│   ├── Confetti.jsx         point celebration particles
│   ├── ControlPanel.jsx     722-line DOM control panel (3 tabs)
│   ├── HUD.jsx              Banner, Scoreboard, callouts, chips, legend, hints
│   └── Rules.jsx            RulesOverlay() — FIVB rules reference
└── logic/                   pure, framework-free logic
    ├── physics.js           parabolic ball solver + velocity solvers
    ├── rotation.js          lineup building, zone assignment, libero sub, active setter
    ├── animator.js          plan management + per-frame player targeting (step())
    └── animations.js        parametric pose functions (idle, run, approach, jump, ...)
```

## State: `store.js`

A single zustand store holds everything:

- **Systems / lineup**: `system` (`5-1` | `6-2`), `rotation` (0–5), `netHeight`
- **Play**: `phase` (`idle` → `set` → `approach` → `spike` → `land`), `play.clock`, `speed`, `autoReplay`, `realisticTiming`
- **Plans**: `plan`, `servePlan`, `receivePlan` — the cached rally plans
- **Mode config**: `mode` (`attack` | `receive` | `serve`), `signalId`, `customCombo`, `drill`, manual click targets, `receiveRole`
- **Opponent**: `blockPattern`, `receiveFormation`
- **Score / UI**: `scoreA`, `scoreB`, `pointEvent`, visibility flags, `cameraPreset`, `fps`

Key actions: `startPlay` / `resetPlay`, `rotate`, `setSignal`, `setCustomCombo`, `setDrill`, `addScore`, `setCameraPreset`, and a set of `set*` setters. Everything the scene needs is reachable through `useStore.getState()` inside the render loop, so the store is read without triggering React re-renders.

### Coordinate system

The court is FIVB-sized: **18 m × 9 m**. The net runs along the x-axis at `z = 0`. Team A defends `z < 0` (their attack line is 3 m behind the net), Team B defends `z > 0`. `y` is up. Court constants live in `src/constants.js` (`COURT_HALF`, `COURT_DEPTH`, `ATTACK_LINE`, `ZONE_POS`, ...).

## The Rally Pipeline

### 1. Plan building (`logic/`)

When `phase` is active, the per-frame `step()` (in `src/components/Scene.jsx`, called from `useFrame`) ensures a plan exists for the current mode. Plans are cached on a `key` that encodes every parameter that affects the ball, so they are rebuilt only when something changes.

- **Attack** (`planPlay` in `physics.js`): feed pass → setter contact hold → set release → flight → hitter contact → spike. Handles the `customHeight` arc override and `realisticTiming` vs presentation timing (where the set flight is stretched to match the approach).
- **Serve** (in `animator.js`): a serve plan holds launch point `p0`, velocity `v`, `flightTime`, and `landPoint`, computed with `velocityToReach`.
- **Serve-receive** (`planServeReceive` in `physics.js`): the full chain — Team B server serves, `pickReceiver` picks the passer (with a professional bias: deep serves to back-row passers, short serves to front row), the pass feeds the setter, the set feeds the hitter, the spike lands on target.

Ball physics is a single gravity-only solver (`solve`), with velocity computed backwards from the desired target and flight time (`velocityToReach`, `velocityToArc`).

### 2. Per-frame sampling

Each frame:

1. `Scene` advances `play.clock` by `dt * speed` and checks for the end of the plan (scoring Team A, then auto-replaying or returning to `idle`).
2. `step()` (`animator.js`) is called with the store state and a mutable `st` ref holding `playersA` / `playersB` maps plus the active plans.
3. `Ball` (`Ball.jsx`) picks a compute function per mode (`computeAttackBall` / `computeReceiveBall` / `computeServeBall`) and solves the relevant segment based on `play.clock`.
4. `PlayerActor` poses each humanoid using the animation state written by `step()` and the pose functions in `animations.js`.
5. `CameraRig` eases the camera toward the active preset; `Trajectory` draws the set/spike arc.

### 3. Player animation (`animator.js` → `Player.jsx`)

`step()` computes a **target position, facing, animation name, and progress** for every player:

- Team A follows zone positions, with the setter pulled to `setterSpot()` and the hitter moved through `approachStart → jumpSpot` synchronized to the set.
- Team B blockers are chosen deterministically (front-row non-setters closest to the ball target x) and slide to their net spots before jumping.
- Roster members not in the current lineup sit on the bench.

`PlayerActor` then resolves `{anim, prog, t, facing}` into a pose (e.g. `poseRun`, `poseApproach`, `poseJump`, `poseSpike`, `poseSet`, `poseServe`, `poseBlock`) with `lerpPose` blending, and feeds it to the `Humanoid` rig in `Player.jsx`.

### 4. Timing model (`physics.js`)

Tempo (1 = quick … 3 = high) drives the whole sequence via two interpolated tables:

- `TEMPO_APPROACH` — duration of the hitter's approach
- `TEMPO_SETFLIGHT` — the set's flight time for realistic timing

`tempoTable` interpolates between the key frames (`TEMPO_KEYS`), so a custom tempo of 1.5, 2.7, etc. works. In presentation mode the set flight is stretched so the approach, jump, and contact land exactly on the set arrival.

## Modes

| Mode | Flow | Key modules |
| --- | --- | --- |
| `attack` | feed pass → set → approach → spike → land | `planPlay`, `step()` attack branch |
| `serve` | server toss → serve flight → land | serve plan in `animator.js`, `computeServeBall` |
| `receive` | opponent serve → pass → set → spike | `planServeReceive`, `pickReceiver`, `receivePositions` |

Switching modes rebuilds plans and clears the others, so the HUD and ball always reflect the active mode.

## UI Layer

The DOM overlay (`App.jsx` → `.ui-layer`) sits on top of the Canvas:

- `ControlPanel` — three tabs (Rally / Serve·Receive / Settings) exposing systems, rotations, signals, quick plays, custom combo sliders, serve types & targets, receive formation, block pattern, net height, camera presets, and toggles.
- `HUD` — `Banner`, `PlayCallout`, `SignalCallout`, `ServeMeta`, `HUDChips`, `Scoreboard`, `Legend`, `FpsChip`, `KeyHints`.
- `Rules` — `RulesOverlay` with FIVB rules.

All UI reads from and writes to the same store, so the 3D scene and the panel stay in sync without prop drilling.

## Development Notes

- In dev mode the app exposes `window.__store`, `window.__scene`, `window.__gl`, `window.__anim`, and `window.__ballPos` for debugging.
- Mutations inside `useFrame` (like `s.play.clock`) are intentional — they avoid store churn while the render loop reads state directly.
- No test suite or linter is configured; `npm run build` is the main verification step.
