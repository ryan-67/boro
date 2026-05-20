import { app } from 'electron';
import { join } from 'path';
import * as fs from 'fs';

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

let dbPath = '';
let currentSession: Session | null = null;

try {
  dbPath = join(app.getPath('userData'), 'boro-data.json');
} catch {
  // fallback for early init before app ready
  dbPath = join(process.cwd(), 'boro-data.json');
}

function readDB(): DB {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(raw) as DB;
    }
  } catch (e) {
    console.warn('[boro-db] failed to read DB, starting fresh', e);
  }
  return { sessions: [], puffEvents: [], globalCounters: {}, appState: {}, lastId: { sessions: 0, puffEvents: 0 } };
}

function writeDB(db: DB) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('[boro-db] failed to write DB', e);
  }
}

function getDB(): DB {
  return db;
}

export function initDB() {
  dbPath = join(app.getPath('userData'), 'boro-data.json');
  const db = readDB();
  const id = ++db.lastId.sessions;
  currentSession = {
    id,
    startedAt: new Date().toISOString(),
    totalPuffs: 0,
    totalDisposablesVaped: 0,
  };
  db.sessions.push(currentSession);
  writeDB(db);
}

export function updateSessionDevice(brand: string, model: string) {
  const db = readDB();
  if (currentSession) {
    const s = db.sessions.find((x) => x.id === currentSession!.id);
    if (s) {
      s.deviceBrand = brand;
      s.deviceModel = model;
      writeDB(db);
    }
  }
}

export function logPuffEvent(data: {
  holdDurationSec: number;
  estimatedPuffsConsumed: number;
  batteryPctBefore: number;
  batteryPctAfter: number;
  puffsRemainingBefore: number;
  puffsRemainingAfter: number;
}) {
  const db = readDB();
  if (!currentSession) return;
  const id = ++db.lastId.puffEvents;
  db.puffEvents.push({
    id,
    sessionId: currentSession.id,
    timestamp: new Date().toISOString(),
    holdDurationSec: data.holdDurationSec,
    estimatedPuffsConsumed: data.estimatedPuffsConsumed,
    batteryPctBefore: data.batteryPctBefore,
    batteryPctAfter: data.batteryPctAfter,
    puffsRemainingBefore: data.puffsRemainingBefore,
    puffsRemainingAfter: data.puffsRemainingAfter,
  });
  const s = db.sessions.find((x) => x.id === currentSession.id);
  if (s) {
    s.totalPuffs += data.estimatedPuffsConsumed;
  }
  // lifetime counter
  db.globalCounters['total_puffs_lifetime'] = (db.globalCounters['total_puffs_lifetime'] || 0) + data.estimatedPuffsConsumed;
  writeDB(db);
}

export function incrementDisposableCounter() {
  const db = readDB();
  db.globalCounters['total_disposables_vaped'] = (db.globalCounters['total_disposables_vaped'] || 0) + 1;
  if (currentSession) {
    const s = db.sessions.find((x) => x.id === currentSession.id);
    if (s) {
      s.totalDisposablesVaped = (s.totalDisposablesVaped || 0) + 1;
    }
  }
  writeDB(db);
}

export function getGlobalCounter(key: string): number {
  const db = readDB();
  return db.globalCounters[key] || 0;
}

export function setAppState(key: string, value: string) {
  const db = readDB();
  db.appState[key] = value;
  writeDB(db);
}

export function getAppState(key: string): string {
  const db = readDB();
  return db.appState[key];
}

export function endSession() {
  if (!currentSession) return;
  const db = readDB();
  const s = db.sessions.find((x) => x.id === currentSession!.id);
  if (s) {
    s.endedAt = new Date().toISOString();
  }
  writeDB(db);
  currentSession = null;
}


export function getAllData(): DB {
  return readDB();
}
