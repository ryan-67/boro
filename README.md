# boro

A tiny desktop pet companion built with Electron + React + TypeScript. boro sits in the corner of your screen as a frameless, always-on-top sprite you can drag, interact with, and vibe alongside while you work.

Website: https://v0-boro.vercel.app/

## Features

- **Desktop sprite pet** - A frameless, transparent window that lives in the bottom-right corner of your screen.
- **Drag to move** - Left-click and drag to reposition the sprite anywhere.
- **Double-click to spin** - Left double-click spins the device for a satisfying animation.
- **Hold to "hit"** - Right-click and hold to take a hit. The sprite glows while inhaling, and a puff of smoke releases from the mouthpiece when you let go.
- **Smoke animation** - Particle-based smoke that scales with the duration of your hit, drifting upward and dissipating naturally.
- **Device management** - Choose between different disposable vape companions, each with unique specs (puff count, battery, e-liquid capacity).
- **Stats tracking** - Tracks puffs remaining, battery %, e-liquid %, lifetime puffs, and total disposables vaped via a local SQLite database.
- **Context menu** - Right-click (or right double-click) opens a menu to toggle on/off, charge battery, refill, view stats, open profile, or switch devices.
- **Profile window** - A separate window to view your usage history and stats.

## Tech Stack

- **Frontend:** React 18, TypeScript, Zustand (state management)
- **Desktop:** Electron 31, electron-vite, electron-builder
- **Database:** better-sqlite3 (local SQLite)
- **Build:** Vite, TypeScript

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build and create installer
npm run dist
```

## Project Structure

```
boro/
├── assets/              # Sprite images (PNG)
├── src/
│   ├── main/            # Electron main process (windows, IPC, DB)
│   ├── preload/         # Preload script for secure IPC
│   ├── renderer/        # React renderer (sprite, profile, selector apps)
│   └── shared/          # Shared types, store, devices, IPC channels
├── electron-builder.yml # Build config for macOS & Windows
├── package.json
└── tsconfig.*.json
```

## Supported Devices

| Brand | Model | Max Puffs | Battery | E-Liquid |
|-------|-------|-----------|---------|----------|
| Geek Bar | Pulse X | 25,000 | 800mAh | 18ml |
| Foger | Switch Pro | 30,000 | 1050mAh | 19ml |

## License

Free to use. If you find boro helpful, consider supporting via Buy Me a Coffee.
