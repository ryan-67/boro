import { useEffect, useState } from 'react';
import { IPC } from '../../shared/ipc-channels';
import { DEVICES } from '../../shared/devices';

interface Session {
  id: number;
  startedAt: string;
  endedAt?: string;
  deviceBrand?: string;
  deviceModel?: string;
  totalPuffs: number;
  totalDisposablesVaped: number;
}

interface PuffEvent {
  id: number;
  sessionId: number;
  timestamp: string;
  holdDurationSec: number;
  estimatedPuffsConsumed: number;
  batteryPctBefore: number;
  batteryPctAfter: number;
  puffsRemainingBefore: number;
  puffsRemainingAfter: number;
}

interface DB {
  sessions: Session[];
  puffEvents: PuffEvent[];
  globalCounters: Record<string, number>;
  appState: Record<string, string>;
  lastId: { sessions: number; puffEvents: number };
}

export default function ProfileApp() {
  const [data, setData] = useState<DB | null>(null);
  const [tab, setTab] = useState<'stats' | 'history' | 'settings'>('stats');

  useEffect(() => {
    window.boro.ipc.invoke(IPC.GET_PROFILE_DATA).then((d) => setData(d as DB));
  }, []);

  if (!data) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#fff', fontFamily: 'sans-serif' }}>loading...</div>
      </div>
    );
  }

  const totalDisposables = data.globalCounters['total_disposables_vaped'] || 0;
  const totalPuffs = data.globalCounters['total_puffs_lifetime'] || 0;
  const currentDeviceState = data.appState['device_state'] ? JSON.parse(data.appState['device_state']) : null;
  const currentDev = currentDeviceState ? DEVICES[currentDeviceState.activeDeviceIndex || 0] : DEVICES[0];

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>boro profile</div>
      <div style={tabBarStyle}>
        <button style={tabBtnStyle(tab === 'stats')} onClick={() => setTab('stats')}>Stats</button>
        <button style={tabBtnStyle(tab === 'history')} onClick={() => setTab('history')}>History</button>
        <button style={tabBtnStyle(tab === 'settings')} onClick={() => setTab('settings')}>Settings</button>
      </div>

      <div style={contentStyle}>
        {tab === 'stats' && (
          <div>
            <div style={gridStyle}>
              <StatCard label="disposables vaped" value={totalDisposables.toLocaleString()} />
              <StatCard label="lifetime puffs" value={totalPuffs.toLocaleString()} />
              <StatCard label="total sessions" value={data.sessions.length.toLocaleString()} />
              <StatCard label="current device" value={`${currentDev.brand} ${currentDev.model}`} />
            </div>

            {currentDeviceState && (
              <div style={{ marginTop: 24 }}>
                <div style={sectionHeader}>current device status</div>
                <div style={detailRow}>puffs remaining: {currentDeviceState.puffsRemaining?.toLocaleString()}</div>
                <div style={detailRow}>battery: {Math.round(currentDeviceState.batteryPct || 0)}%</div>
                <div style={detailRow}>e-liquid: {Math.round(currentDeviceState.eLiquidPct || 0)}%</div>
                <div style={detailRow}>power: {currentDeviceState.isOn ? 'on' : 'off'}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div style={sectionHeader}>sessions</div>
            <div style={tableWrap}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th>id</th>
                    <th>started</th>
                    <th>device</th>
                    <th>puffs</th>
                    <th>disposables</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.slice().reverse().map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{new Date(s.startedAt).toLocaleString()}</td>
                      <td>{s.deviceBrand || '-'} {s.deviceModel || ''}</td>
                      <td>{s.totalPuffs}</td>
                      <td>{s.totalDisposablesVaped || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={sectionHeader}>recent puff events</div>
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th>time</th>
                      <th>duration</th>
                      <th>puffs</th>
                      <th>bat before</th>
                      <th>bat after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.puffEvents.slice().reverse().slice(0, 50).map((p) => (
                      <tr key={p.id}>
                        <td>{new Date(p.timestamp).toLocaleTimeString()}</td>
                        <td>{p.holdDurationSec.toFixed(1)}s</td>
                        <td>{p.estimatedPuffsConsumed}</td>
                        <td>{Math.round(p.batteryPctBefore)}%</td>
                        <td>{Math.round(p.batteryPctAfter)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <div style={sectionHeader}>settings</div>
            <div style={detailRow}>coming soon: window opacity, auto-start, reset stats</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: '#121212',
  color: '#eee',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  padding: 24,
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  marginBottom: 16,
  color: '#fff',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 20,
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: active ? '#333' : '#222',
  color: active ? '#fff' : '#888',
  fontWeight: active ? 600 : 400,
});

const contentStyle: React.CSSProperties = {};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: '#1e1e1e',
  borderRadius: 8,
  padding: 16,
  border: '1px solid #2a2a2a',
};

const sectionHeader: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#aaa',
  marginBottom: 8,
  textTransform: 'uppercase',
};

const detailRow: React.CSSProperties = {
  fontSize: 14,
  color: '#ccc',
  marginBottom: 4,
};

const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  color: '#ccc',
};
