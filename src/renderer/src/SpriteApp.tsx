import { useEffect, useRef, useCallback, useState } from 'react';
import { useVapeStore } from '../../shared/store';
import { DEVICES } from '../../shared/devices';
import { IPC } from '../../shared/ipc-channels';

const DRAG_THRESHOLD_PX = 5;
const HIT_THRESHOLD_MS = 150;
const DOUBLE_CLICK_MS = 300;
const AUTO_RESET_MS = 3000;

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  driftPhase: number;
  driftSpeed: number;
  baseAlpha: number;
  swirlOffset: number;
}

export default function SpriteApp() {
  const {
    activeDeviceIndex,
    puffsRemaining,
    batteryPct,
    eLiquidPct,
    isHitting,
    isOn,
    isEmpty,
    totalDisposablesVaped,
    totalPuffsLifetime,
    startHit,
    endHit,
    charge,
    toggleOnOff,
    resetCurrentDevice,
  } = useVapeStore();

  useEffect(() => {
    useVapeStore.getState().init();
  }, []);

  const dev = DEVICES[activeDeviceIndex];
  const spriteUrl = `file://` + window.boro.assetsDir.replace(/\\/g, '/') + `/${dev.spriteFile}`;

  const imgRef = useRef<HTMLImageElement>(null);
  const leftDownRef = useRef(false);
  const rightDownRef = useRef(false);
  const draggingRef = useRef(false);
  const hittingRef = useRef(false);
  const totalMovementRef = useRef(0);
  const startTimeRef = useRef(0);
  const hitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLeftClickRef = useRef(0);
  const lastRightClickRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const startHitStable = useCallback(startHit, [startHit]);
  const endHitStable = useCallback(endHit, [endHit]);

  // Canvas smoke system — rebuilt for realistic vape cloud
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<SmokeParticle[]>([]);
  const rafRef = useRef<number>(0);
  const prevHitRef = useRef(false);

  const spawnSmoke = useCallback((elapsedMs: number, burst = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const centerX = w / 2;
    const emitY = h * 0.34;

    const count = burst
      ? Math.min(140, Math.max(40, Math.floor(elapsedMs / 25)))
      : Math.min(70, Math.max(8, Math.floor(elapsedMs / 45)));

    for (let i = 0; i < count; i++) {
      const life = 1.8 + Math.random() * 2.2 + (burst ? 0.5 : 0);
      const startSize = 14 + Math.random() * 18 + (elapsedMs / 100) * 2;
      const grow = 18 + Math.random() * 28;
      const alpha = 0.025 + Math.random() * 0.035;

      particlesRef.current.push({
        x: centerX + (Math.random() - 0.5) * 24,
        y: emitY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.6 - Math.random() * 1.4,
        life: life,
        maxLife: life,
        size: startSize,
        grow: grow,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.8 + Math.random() * 1.6,
        baseAlpha: alpha,
        swirlOffset: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let last = performance.now();
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, rect.width, rect.height);

      const parts = particlesRef.current;
      // Sort by size so larger (haze) draw behind smaller (dense core)
      parts.sort((a, b) => a.size - b.size);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        const t = 1 - p.life / p.maxLife; // 0 = birth, 1 = death

        // Buoyancy: upward velocity tapers as it mixes with air
        p.vy *= (1 - 0.1 * dt);
        // Add slight upward acceleration at first
        if (t < 0.2) p.vy -= 0.2 * dt;

        // Turbulence / swirl
        const swirl = Math.sin(t * Math.PI * 3 + p.swirlOffset) * (0.3 + t * 0.8);
        p.vx += (swirl - p.vx) * 0.5 * dt;
        p.vx += Math.sin(p.driftPhase + now * 0.0015 * p.driftSpeed) * 0.15 * dt;

        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.size += p.grow * dt;

        // Fade curve: hold opacity early, fade faster later
        const fade = (1 - Math.pow(t, 2.5));
        const alpha = p.baseAlpha * fade;
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        // Very soft radial gradient for wispy cloud look
        const r = p.size;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.15, 'rgba(250,250,250,0.25)');
        g.addColorStop(0.4, 'rgba(245,245,245,0.08)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Continuous emission while hitting
      if (isHitting && !prevHitRef.current) {
        // just started
      }
      if (isHitting) {
        spawnSmoke(16.67, false);
      } else if (prevHitRef.current && !isHitting) {
        // release burst
        spawnSmoke(600, true);
      }
      prevHitRef.current = isHitting;

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dev.width, dev.height, isHitting, spawnSmoke]);

  useEffect(() => {
    if (!isEmpty) return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetCurrentDevice();
    }, AUTO_RESET_MS);
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [isEmpty, resetCurrentDevice]);

  const handleLeftDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      leftDownRef.current = true;
      draggingRef.current = false;
      totalMovementRef.current = 0;
      startTimeRef.current = Date.now();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const startX = clientX;
      const startY = clientY;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
        const dx = cx - startX;
        const dy = cy - startY;
        totalMovementRef.current += Math.hypot(dx, dy);
        if (totalMovementRef.current > DRAG_THRESHOLD_PX) {
          draggingRef.current = true;
        }
      };

      const onUp = (ev: MouseEvent | TouchEvent) => {
        leftDownRef.current = false;
        const duration = Date.now() - startTimeRef.current;
        if (!draggingRef.current && duration < HIT_THRESHOLD_MS && isOn && !isEmpty) {
          const now = Date.now();
          if (now - lastLeftClickRef.current < DOUBLE_CLICK_MS) {
            // double click ignored
          } else {
            if (!hittingRef.current) {
              hittingRef.current = true;
              startHitStable();
              hitTimerRef.current = setTimeout(() => {
                if (hittingRef.current) {
                  hittingRef.current = false;
                  endHitStable();
                }
              }, 600);
            }
          }
          lastLeftClickRef.current = now;
        }
        window.removeEventListener('mousemove', onMove as EventListener);
        window.removeEventListener('mouseup', onUp as EventListener);
        window.removeEventListener('touchmove', onMove as EventListener);
        window.removeEventListener('touchend', onUp as EventListener);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove);
      window.addEventListener('touchend', onUp);
    },
    [startHitStable, endHitStable, isOn, isEmpty]
  );

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }, []);

  const handleContextAction = useCallback(
    (action: string) => {
      setMenuOpen(false);
      if (action === 'next') {
        window.electron?.ipcRenderer?.send(IPC.SWITCH_DEVICE, { direction: 'next' });
        setSpinning(true);
        setTimeout(() => setSpinning(false), 400);
      } else if (action === 'prev') {
        window.electron?.ipcRenderer?.send(IPC.SWITCH_DEVICE, { direction: 'prev' });
        setSpinning(true);
        setTimeout(() => setSpinning(false), 400);
      } else if (action === 'toggle') {
        toggleOnOff();
      } else if (action === 'charge') {
        charge();
      } else if (action === 'reset') {
        resetCurrentDevice();
      }
    },
    [toggleOnOff, charge, resetCurrentDevice]
  );

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    if (menuOpen) {
      window.addEventListener('click', closeMenu, { once: true });
    }
    return () => window.removeEventListener('click', closeMenu);
  }, [menuOpen]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#1a1a1a',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseDown={handleLeftDown}
      onTouchStart={handleLeftDown}
      onContextMenu={handleRightClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <img
        ref={imgRef}
        src={spriteUrl}
        draggable={false}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) ${spinning ? 'rotate(360deg)' : 'rotate(0deg)'}`,
          transition: spinning ? 'transform 0.4s ease' : 'none',
          maxWidth: '80vw',
          maxHeight: '60vh',
          zIndex: 1,
          filter: isOn ? 'none' : 'brightness(0.6)',
          opacity: isHitting && isOn ? 0.9 : 1,
        }}
      />
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            left: menuPos.x,
            top: menuPos.y,
            background: 'rgba(20,20,20,0.95)',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '6px 0',
            zIndex: 10,
            minWidth: 140,
            color: '#eee',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div style={menuItemStyle} onClick={() => handleContextAction('next')}>
            Next Device
          </div>
          <div style={menuItemStyle} onClick={() => handleContextAction('prev')}>
            Prev Device
          </div>
          <div style={menuDividerStyle} />
          <div style={menuItemStyle} onClick={() => handleContextAction('toggle')}>
            {isOn ? 'Turn Off' : 'Turn On'}
          </div>
          <div style={menuItemStyle} onClick={() => handleContextAction('charge')}>
            Charge Battery
          </div>
          <div style={menuItemStyle} onClick={() => handleContextAction('reset')}>
            Reset Device
          </div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          color: '#888',
          fontSize: 11,
          fontFamily: 'monospace',
          zIndex: 3,
          lineHeight: 1.5,
        }}
      >
        <div>puffs: {puffsRemaining}</div>
        <div>battery: {batteryPct}%</div>
        <div>juice: {eLiquidPct}%</div>
        <div>total: {totalPuffsLifetime}</div>
        <div>disposables: {totalDisposablesVaped}</div>
      </div>
      {isHitting && isOn && (
        <div
          style={{
            position: 'absolute',
            top: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.15)',
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          ...
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  color: '#eee',
  fontSize: 13,
  cursor: 'pointer',
};

const menuDividerStyle: React.CSSProperties = {
  height: 1,
  background: '#333',
  margin: '4px 0',
};

