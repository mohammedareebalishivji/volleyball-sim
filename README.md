# Volleyball Rotation & Tempo Simulator

An interactive 3D volleyball simulator built with **React Three Fiber** and **Vite**. It visualizes offensive systems (5-1 / 6-2), setter hand signals, serve-receive formations, blocking patterns, and full rally sequences — from serve to pass, set, and spike — using realistic humanoid players and deterministic ball physics.

## Features

- **Systems & rotations** — switch between 5-1 and 6-2 offenses and rotate through all 6 positions (arrow keys or the control panel). Libero substitution is applied automatically for back-row middles.
- **Setter hand signals** — 7 real signals (quick, shoot, medium, high outside, back set, back quick, slide) each with its zone, arc height, tempo, and cue.
- **Custom combos** — stamp one-tap offensive plays (high outside, quick middle, back-1 shoot, pipe, high back-set, slide) or dial in your own hitter, zone, arc height, tempo, net distance, and spike target.
- **Serve-receive drill** — the full professional sequence: opponent serve → pass → set → spike, with W / 2 / line receive formations and an automatic receiver picker.
- **Serve practice** — 4 serve types (float, topspin, jump, jump float) aimed at 5 named targets, or click anywhere on the court.
- **Blocking** — none / single / double / triple block patterns against the attack.
- **Free drill mode** — click to place the first ball and the spike landing anywhere on the court.
- **Realistic timing** — toggle presentation timing (set stretched to match the approach) or elite quick timing.
- **Camera presets** — tactical overhead, sideline broadcast, behind-setter POV, hitter approach, serve target POV.
- **HUD & overlays** — scoreboard, signal callouts, serve metadata, trajectory preview, attack zones, FPS meter, keyboard hints, rules overlay.

## Tech Stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Drei](https://github.com/pmndrs/drei)
- [Three.js](https://threejs.org)
- [Zustand](https://github.com/pmndrs/zustand) for state management

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on port 3000.

## Build & Preview

```bash
npm run build   # outputs to dist/
npm run preview
```

## Controls

| Action | Key |
| --- | --- |
| Start / reset play | `Space` |
| Rotate lineup | `←` / `→` |
| Toggle control panel | `H` |
| Toggle rules overlay | `R` |
| Orbit / zoom camera | Mouse drag + scroll (or use camera presets) |

## Project Structure

```
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx              # entry point
│   ├── App.jsx               # Canvas + UI layer + keyboard
│   ├── store.js              # zustand store (state + actions)
│   ├── constants.js          # court, zones, signals, presets
│   ├── style.css
│   ├── components/           # 3D + DOM UI components
│   └── logic/                # physics, rotation, animation
```

See [architecture.md](architecture.md) for a detailed walkthrough.

## License

Private project.
