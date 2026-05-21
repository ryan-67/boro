import { useState } from 'react';
import { IPC } from '../../shared/ipc-channels';
import { DEVICES } from '../../shared/devices';

export default function SelectDeviceApp() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const handleSelect = (deviceId: string) => {
    if (selected) return;
    setSelected(deviceId);
    window.boro.ipc.invoke(IPC.DB_SET_APP_STATE, 'selected_device_id', deviceId).catch(() => {});
    window.boro.ipc.send('select-device-done');
  };

  const assetsDir = window.boro.assetsDir.replace(/\\\\/g, '/');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <h1
        style={{
          color: '#e8e8e8',
          fontSize: 22,
          fontWeight: 500,
          marginBottom: 32,
          letterSpacing: '0.02em',
        }}
      >
        choose your companion
      </h1>

      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        {DEVICES.map((dev) => {
          const isActive = selected === dev.id || hovered === dev.id;
          const isDimmed = selected && selected !== dev.id;
          const imgUrl = `file://${assetsDir}/${dev.spriteFile}`;

          return (
            <button
              key={dev.id}
              onClick={() => handleSelect(dev.id)}
              onMouseEnter={() => setHovered(dev.id)}
              onMouseLeave={() => setHovered(null)}
              disabled={!!selected}
              style={{
                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: isActive ? '1.5px solid rgba(200,220,255,0.35)' : '1.5px solid rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: 24,
                width: 180,
                cursor: selected ? 'default' : 'pointer',
                transition: 'all 0.25s ease',
                opacity: isDimmed ? 0.35 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <img
                src={imgUrl}
                alt={dev.model}
                style={{
                  width: dev.width * 0.85,
                  height: dev.height * 0.85,
                  objectFit: 'contain',
                  filter: isActive ? 'drop-shadow(0 0 12px rgba(180,200,255,0.25))' : 'none',
                  transition: 'filter 0.25s ease',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#c8c8d0', fontSize: 14, fontWeight: 500 }}>{dev.brand}</div>
                <div style={{ color: '#8a8a96', fontSize: 11, marginTop: 4 }}>{dev.model}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          style={{
            marginTop: 28,
            color: '#8a96b8',
            fontSize: 13,
            animation: 'fadeIn 0.4s ease',
          }}
        >
          starting up...
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
