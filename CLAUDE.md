# boro â€” Desktop Pet Virtual Disposable Vape

## Project Status
Phase 1 MVP build in progress (Electron / Windows / TypeScript).

## What We're Building
A tiny, always-on-top, transparent desktop pet that looks and behaves like a real disposable vape.
Users click-and-hold to puff; e-liquid and battery deplete in real time based on actual device specs.
When a device runs empty it auto-resets with the same brand / model / flavor so the pet never truly dies.
The target audience is people trying to taper or quit vaping who want a harmless fidget replacement.

## Architecture
- Electron main process (transparent, frameless, always-on-top window)
- Renderer: HTML5 Canvas (device + particles) + React (menus / settings)
- State: Zustand
- Local DB: better-sqlite3 (stats, puff logs, global counters)
- Audio: Web Audio API (inhale loop, exhale burst)
- Packaging: electron-builder (NSIS)

## Decisions Log
- Right-click context menu on the device contains:
   + Charge â€” instantly refills battery to 100 %
   + On / Off toggle â€” disables / enables puff interaction and dims the LED
   + New Device â€” only enabled when current device is fully depleted (puffs == 0 or battery == 0)
- Charging dock pet (USB-C animation, real charge delay) deferred to Phase 2.
- Taper mode (daily puff cap / lockout) deferred to Phase 2.
- Auto-reset on empty happens automatically after a 3 s empty-state animation.
- No focus timer, no pomodoro, no productivity layer. Pure fidget / replacement tool.
- All device art must be stylized illustrations, not photos, to reduce trademark risk.

## Phase 1 Step 2: Sprite + Click-Hold + Glow
- Remove -webkit-app-region:drag, implement custom window drag via IPC
- Render geek_pulse_x.png as the device sprite
- Pointerdown timer (150ms) to distinguish drag vs hit
- Hit mode shows LED glow overlay while held
- On release: stub puff math (log duration to console)

## Current Next Steps (updated)
1. Puff math + battery / liquid depletion
2. Auto-reset on empty + global counter persistence
3. SQLite schema + stats window
4. NSIS build script

## Directory
D:\Projects\boro (source) â€” scope doc lives at boro-scope.txt
