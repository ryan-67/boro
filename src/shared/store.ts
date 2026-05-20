import { create } from 'zustand';
import { DEVICES } from './devices';
import { IPC } from './ipc-channels';

interface VapeState {
  activeDeviceIndex: number;
  puffsRemaining: number;
  batteryPct: number;
  eLiquidPct: number;
  isHitting: boolean;
  hitStartTime: number;
  isOn: boolean;
  isEmpty: boolean;
  totalDisposablesVaped: number;
  totalPuffsLifetime: number;
  userName: string;

  init: () => Promise<void>;
  setUserName: (name: string) => void;
  setDevice: (index: number) => void;
  startHit: () => void;
  endHit: (durationMs: number) => void;
  charge: () => void;
  toggleOnOff: () => void;
  nextDevice: () => void;
  resetDevice: () => void;
  resetCurrentDevice: () => void;
  setCounters: (disposables: number, puffs: number) => void;
}

const AVG_PUFF_DURATION_SEC = 2.5;

function saveState(state: Partial<VapeState>) {
  const payload = JSON.stringify({
    activeDeviceIndex: state.activeDeviceIndex,
    puffsRemaining: state.puffsRemaining,
    batteryPct: state.batteryPct,
    eLiquidPct: state.eLiquidPct,
    isEmpty: state.isEmpty,
    isOn: state.isOn,
  });
  window.boro.ipc.invoke(IPC.DB_SET_APP_STATE, 'device_state', payload).catch(() => {});
}

export const useVapeStore = create<VapeState>((set, get) => ({
  activeDeviceIndex: 0,
  userName: '',
  puffsRemaining: DEVICES[0].maxPuffs,
  batteryPct: 100,
  eLiquidPct: 100,
  isHitting: false,
  hitStartTime: 0,
  isOn: true,
  isEmpty: false,
  totalDisposablesVaped: 0,
  totalPuffsLifetime: 0,

  init: async () => {
    try {
      const disposables = ((await window.boro.ipc.invoke(IPC.DB_GET_COUNTER, 'total_disposables_vaped')) as number) || 0;
      const puffs = ((await window.boro.ipc.invoke(IPC.DB_GET_COUNTER, 'total_puffs_lifetime')) as number) || 0;
      const saved = (await window.boro.ipc.invoke(IPC.DB_GET_APP_STATE, 'device_state')) as string | null;
      if (saved) {
        const parsed = JSON.parse(saved);
        set({ totalDisposablesVaped: disposables, totalPuffsLifetime: puffs, ...parsed });
      } else {
        set({ totalDisposablesVaped: disposables, totalPuffsLifetime: puffs });
      }
    } catch (e) {
      console.warn('[store] init failed', e);
    }
  },

  setUserName: (name: string) => set({ userName: name }),

  setDevice: (index: number) => {
    const dev = DEVICES[index];
    const next = {
      activeDeviceIndex: index,
      puffsRemaining: dev.maxPuffs,
      batteryPct: 100,
      eLiquidPct: 100,
      isHitting: false,
      hitStartTime: 0,
      isEmpty: false,
    };
    set(next);
    saveState(next);
  },

  startHit: () => {
    const state = get();
    if (!state.isOn || state.isHitting || state.isEmpty) return;
    set({ isHitting: true, hitStartTime: Date.now() });
  },

  endHit: (durationMs: number) => {
    const state = get();
    if (!state.isHitting || state.isEmpty) return;

    const dev = DEVICES[state.activeDeviceIndex];
    const durationSec = Math.max(durationMs / 1000, 0.1);
    const estimatedPuffs = Math.max(1, Math.round(durationSec / AVG_PUFF_DURATION_SEC));
    const clamped = Math.min(estimatedPuffs, state.puffsRemaining);

    const drainPerPuff = 100 / dev.maxPuffs;
    const newPuffs = Math.max(0, state.puffsRemaining - clamped);
    const newBattery = Math.max(0, state.batteryPct - clamped * drainPerPuff);
    const newELiquid = (newPuffs / dev.maxPuffs) * 100;
    const nowEmpty = newPuffs <= 0 || newBattery <= 0;

    window.boro.ipc
      .invoke(IPC.DB_LOG_PUFF, {
        holdDurationSec: durationMs / 1000,
        estimatedPuffsConsumed: clamped,
        batteryPctBefore: state.batteryPct,
        batteryPctAfter: newBattery,
        puffsRemainingBefore: state.puffsRemaining,
        puffsRemainingAfter: newPuffs,
      })
      .catch(() => {});

    const next = {
      isHitting: false,
      hitStartTime: 0,
      puffsRemaining: newPuffs,
      batteryPct: newBattery,
      eLiquidPct: newELiquid,
      isEmpty: nowEmpty,
      totalPuffsLifetime: state.totalPuffsLifetime + clamped,
    };
    set(next);
    saveState(next);
  },

  charge: () => {
    const state = get();
    const next = { batteryPct: 100, isEmpty: state.puffsRemaining <= 0 };
    set(next);
    saveState({ ...state, ...next });
  },

  toggleOnOff: () => {
    const state = get();
    const next = { isOn: !state.isOn, isHitting: false, hitStartTime: 0 };
    set(next);
    saveState({ ...state, ...next });
  },

  nextDevice: () => {
    const state = get();
    const nextIdx = (state.activeDeviceIndex + 1) % DEVICES.length;
    const dev = DEVICES[nextIdx];
    const next = {
      activeDeviceIndex: nextIdx,
      puffsRemaining: dev.maxPuffs,
      batteryPct: 100,
      eLiquidPct: 100,
      isHitting: false,
      hitStartTime: 0,
      isEmpty: false,
    };
    set(next);
    saveState(next);
  },

  resetDevice: () => {
    const state = get();
    const dev = DEVICES[state.activeDeviceIndex];
    const next = {
      puffsRemaining: dev.maxPuffs,
      batteryPct: 100,
      eLiquidPct: 100,
      isHitting: false,
      hitStartTime: 0,
      isEmpty: false,
    };
    set(next);
    saveState(next);
  },

  resetCurrentDevice: () => {
    const state = get();
    const dev = DEVICES[state.activeDeviceIndex];
    const next = {
      puffsRemaining: dev.maxPuffs,
      batteryPct: 100,
      eLiquidPct: 100,
      isHitting: false,
      hitStartTime: 0,
      isEmpty: false,
      totalDisposablesVaped: state.totalDisposablesVaped + 1,
    };
    set(next);
    window.boro.ipc.invoke(IPC.DB_INCREMENT_DISPOSABLE).catch(() => {});
    saveState(next);
  },

  setCounters: (disposables: number, puffs: number) =>
    set({ totalDisposablesVaped: disposables, totalPuffsLifetime: puffs }),
}));
