import { useEffect, useRef, useState } from 'react';
import { useVapeStore } from '../../shared/store';
import { DEVICES } from '../../shared/devices';
import { IPC } from '../../shared/ipc-channels';

const DRAG_THRESHOLD_PX = 5;
const HIT_THRESHOLD_MS = 150;
const DOUBLE_CLICK_MS = 300;
const AUTO_RESET_MS = 3000;
const STATS_DISMISS_MS = 10000;

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

declare global {
  interface Window {
    boro: {
      ipc: {
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (...args: any[]) => void) => (() => void);
      };
      channels: typeof IPC;
      assetsDir: string;
    };
  }
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
    refill,
    toggleOnOff,
    resetCurrentDevice,
    nextDevice,
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
  const isRightHittingRef = useRef(false);
  const totalMovementRef = useRef(0);
  const leftStartRef = useRef({ x: 0, y: 0, time: 0 });
  const rightStartRef = useRef({ time: 0 });
  const rightHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLeftClickRef = useRef(0);
  const lastRightClickRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [statsVisible, setStatsVisible] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<SmokeParticle[]>([]);
  const rafRef = useRef<number>(0);
  const isHittingRef = useRef(isHitting);
  useEffect(() => { isHittingRef.current = isHitting; }, [isHitting]);
  const prevHitRef = useRef(false);
  const lastHitDurationRef = useRef(0);

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

  const showStats = () => {
    setStatsVisible(true);
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    statsTimerRef.current = setTimeout(() => setStatsVisible(false), STATS_DISMISS_MS);
  };

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
      parts.sort((a, b) => a.size - b.size);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        const t = 1 - p.life / p.maxLife;

        p.vy *= (1 - 0.1 * dt);
        if (t < 0.2) p.vy -= 0.2 * dt;

        const swirl = Math.sin(t * Math.PI * 3 + p.swirlOffset) * (0.3 + t * 0.8);
        p.vx += (swirl - p.vx) * 0.5 * dt;
        p.vx += Math.sin(p.driftPhase + now * 0.0015 * p.driftSpeed) * 0.15 * dt;

        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.size += p.grow * dt;

        const fade = (1 - Math.pow(t, 2.5));
        const alpha = p.baseAlpha * fade;
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
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

      if (prevHitRef.current && !isHittingRef.current) {
        spawnSmoke(lastHitDurationRef.current, true);
        lastHitDurationRef.current = 0;
      }
      prevHitRef.current = isHittingRef.current;

      rafRef.current = requestAnimationFrame(animate);
    };

    function spawnSmoke(elapsedMs: number, burst = false) {
      const img = imgRef.current;
      if (!img) return;
      const imgRect = img.getBoundingClientRect();
      const emitX = imgRect.left + imgRect.width * 0.25;
      const emitY = imgRect.top - 12;

      const durationFactor = Math.min(elapsedMs / 2000, 1);
      const count = Math.max(6, Math.floor(12 + durationFactor * 100));
      const baseLife = 1.0 + durationFactor * 2.5;

      for (let i = 0; i < count; i++) {
        const life = baseLife + Math.random() * 1.2;
        const startSize = 6 + Math.random() * 10 + durationFactor * 28;
        const grow = 10 + Math.random() * 16 + durationFactor * 24;
        const alpha = 0.02 + Math.random() * 0.03;

        particlesRef.current.push({
          x: emitX + (Math.random() - 0.5) * 12,
          y: emitY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.8 - Math.random() * 1.2,
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
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      leftDownRef.current = true;
      draggingRef.current = false;
      totalMovementRef.current = 0;
      leftStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      const onMove = (ev: MouseEvent) => {
        const dxTotal = ev.clientX - leftStartRef.current.x;
        const dyTotal = ev.clientY - leftStartRef.current.y;
        totalMovementRef.current = Math.hypot(dxTotal, dyTotal);
        if (totalMovementRef.current > DRAG_THRESHOLD_PX && !draggingRef.current) {
          draggingRef.current = true;
        }
        if (draggingRef.current) {
          window.boro.ipc.send(IPC.DRAG_DELTA, { dx: ev.movementX, dy: ev.movementY });
        }
      };

      const onUp = (ev: MouseEvent) => {
        leftDownRef.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);

        const duration = Date.now() - leftStartRef.current.time;
        if (draggingRef.current) return;

        if (duration < HIT_THRESHOLD_MS) {
          const now = Date.now();
          if (now - lastLeftClickRef.current < DOUBLE_CLICK_MS) {
            setSpinning(true);
            setTimeout(() => setSpinning(false), 400);
          }
          lastLeftClickRef.current = now;
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    } else if (e.button === 2) {
      e.preventDefault();
      rightDownRef.current = true;
      rightStartRef.current = { time: Date.now() };
      isRightHittingRef.current = false;

      rightHitTimerRef.current = setTimeout(() => {
        if (rightDownRef.current) {
          startHit();
          isRightHittingRef.current = true;
        }
      }, HIT_THRESHOLD_MS);

      const onUp = (ev: MouseEvent) => {
        if (!rightDownRef.current) return;
        rightDownRef.current = false;
        window.removeEventListener('mouseup', onUp);

        if (rightHitTimerRef.current) {
          clearTimeout(rightHitTimerRef.current);
          rightHitTimerRef.current = null;
        }

        if (isRightHittingRef.current) {
          const duration = Date.now() - rightStartRef.current.time;
          lastHitDurationRef.current = duration;
          endHit(duration);
          isRightHittingRef.current = false;
        } else {
          const now = Date.now();
          if (now - lastRightClickRef.current < DOUBLE_CLICK_MS) {
            setMenuPos({ x: ev.clientX, y: ev.clientY });
            setMenuOpen(true);
          }
          lastRightClickRef.current = now;
        }
      };

      window.addEventListener('mouseup', onUp);
    }
  };

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
        background: 'transparent',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
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
          top: 140,
          transform: `perspective(400px) translateX(-50%) ${spinning ? 'rotateY(360deg)' : 'rotateY(0deg)'}`,
          transition: spinning ? 'transform 0.4s ease' : 'none',
          maxHeight: 150,
          maxWidth: '90vw',
          zIndex: 1,
          filter: isOn ? (isHitting ? 'drop-shadow(0 0 1px rgba(220,240,255,1)) drop-shadow(0 0 3px rgba(200,230,255,0.8)) drop-shadow(0 0 8px rgba(180,215,255,0.5)) brightness(1.1)' : 'none') : 'brightness(0.6)',
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
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); toggleOnOff(); }}>
            {isOn ? 'Turn Off' : 'Turn On'}
          </div>
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); charge(); }}>
            Charge Battery
          </div>
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); refill(); }}>
            Refill
          </div>
          <div style={isEmpty ? menuItemStyle : menuItemDisabledStyle} onClick={isEmpty ? () => { setMenuOpen(false); nextDevice(); } : undefined}>
            Next Device
          </div>

          <div style={menuDividerStyle} />
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); showStats(); }}>
            Stats
          </div>
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); window.boro.ipc.send(IPC.OPEN_PROFILE_WINDOW); }}>
            Open Profile
          </div>
          <div style={menuDividerStyle} />
          <div style={menuItemStyle} onClick={() => { setMenuOpen(false); window.boro.ipc.send(IPC.QUIT_APP); }}>
            Quit
          </div>
        </div>
      )}
      {statsVisible && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#ddd',
            fontSize: 12,
            fontFamily: 'monospace',
            zIndex: 5,
            lineHeight: 1.5,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div>puffs: {puffsRemaining}</div>
          <div>battery: {batteryPct}%</div>
          <div>juice: {Math.round(eLiquidPct)}%</div>
          <div>total: {totalPuffsLifetime}</div>
          <div>disposables: {totalDisposablesVaped}</div>
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

const menuItemDisabledStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  color: '#666',
  fontSize: 13,
  cursor: 'default',
  pointerEvents: 'none',
};

const menuDividerStyle: React.CSSProperties = {
  height: 1,
  background: '#333',
  margin: '4px 0',
};
