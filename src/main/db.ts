import { app } from 'electron';
import { join } from 'path';
import Database from 'better-sqlite3';

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

let db: Database | null = null;
let currentSession: Session | null = null;
let dbPath = '';

function getDB(): Database {
  if (!db) {
    try {
      dbPath = join(app.getPath('userData'), 'boro.db');
    } catch {
      dbPath = join(process.cwd(), 'boro.db');
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        deviceBrand TEXT,
        deviceModel TEXT,
        totalPuffs INTEGER DEFAULT 0,
        totalDisposablesVaped INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS puff_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        holdDurationSec REAL NOT NULL,
        estimatedPuffsConsumed INTEGER NOT NULL,
        batteryPctBefore REAL NOT NULL,
        batteryPctAfter REAL NOT NULL,
        puffsRemainingBefore INTEGER NOT NULL,
        puffsRemainingAfter INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS global_counters (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }
  return db;
}

export function initDB() {
  try {
    const d = getDB();
    const today = new Date().toISOString();
    const result = d
      .prepare('INSERT INTO sessions (startedAt, totalPuffs, totalDisposablesVaped) VALUES (?, 0, 0)')
      .run(today);
    currentSession = {
      id: Number(result.lastInsertRowid),
      startedAt: today,
      totalPuffs: 0,
      totalDisposablesVaped: 0,
    };
  } catch (e) {
    console.error('[boro-db] initDB failed', e);
  }
}

export function endSession() {
  if (!currentSession) return;
  try {
    const d = getDB();
    const today = new Date().toISOString();
    d.prepare('UPDATE sessions SET endedAt = ? WHERE id = ?').run(today, currentSession.id);
    currentSession = null;
  } catch (e) {
    console.error('[boro-db] endSession failed', e);
  }
}

export function updateSessionDevice(brand: string, model: string) {
  if (!currentSession) return;
  try {
    const d = getDB();
    d.prepare('UPDATE sessions SET deviceBrand = ?, deviceModel = ? WHERE id = ?').run(brand, model, currentSession.id);
    currentSession.deviceBrand = brand;
    currentSession.deviceModel = model;
  } catch (e) {
    console.error('[boro-db] updateSessionDevice failed', e);
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
  if (!currentSession) return;
  try {
    const d = getDB();
    d.prepare(`
      INSERT INTO puff_events
      (sessionId, holdDurationSec, estimatedPuffsConsumed, batteryPctBefore, batteryPctAfter, puffsRemainingBefore, puffsRemainingAfter)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      currentSession.id,
      data.holdDurationSec,
      data.estimatedPuffsConsumed,
      data.batteryPctBefore,
      data.batteryPctAfter,
      data.puffsRemainingBefore,
      data.puffsRemainingAfter
    );

    d.prepare('UPDATE sessions SET totalPuffs = totalPuffs + ? WHERE id = ?').run(data.estimatedPuffsConsumed, currentSession.id);
    currentSession.totalPuffs += data.estimatedPuffsConsumed;

    const counterKey = 'total_puffs_lifetime';
    d.prepare(`
      INSERT INTO global_counters (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = value + excluded.value
    `).run(counterKey, data.estimatedPuffsConsumed);
  } catch (e) {
    console.error('[boro-db] logPuffEvent failed', e);
  }
}

export function incrementDisposableCounter() {
  try {
    const d = getDB();
    const counterKey = 'total_disposables_vaped';
    d.prepare(`
      INSERT INTO global_counters (key, value) VALUES (?, 1)
      ON CONFLICT(key) DO UPDATE SET value = value + 1
    `).run(counterKey);

    if (currentSession) {
      d.prepare('UPDATE sessions SET totalDisposablesVaped = totalDisposablesVaped + 1 WHERE id = ?').run(currentSession.id);
      currentSession.totalDisposablesVaped = (currentSession.totalDisposablesVaped || 0) + 1;
    }
  } catch (e) {
    console.error('[boro-db] incrementDisposableCounter failed', e);
  }
}

export function getGlobalCounter(key: string): number {
  try {
    const d = getDB();
    const row = d.prepare('SELECT value FROM global_counters WHERE key = ?').get(key);
    return row ? (row as { value: number }).value : 0;
  } catch (e) {
    console.error('[boro-db] getGlobalCounter failed', e);
    return 0;
  }
}

export function setAppState(key: string, value: string) {
  try {
    const d = getDB();
    d.prepare(`
      INSERT INTO app_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  } catch (e) {
    console.error('[boro-db] setAppState failed', e);
  }
}

export function getAppState(key: string): string {
  try {
    const d = getDB();
    const row = d.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
    return row ? (row as { value: string }).value : '';
  } catch (e) {
    console.error('[boro-db] getAppState failed', e);
    return '';
  }
}

export function getAllData(): DB {
  try {
    const d = getDB();
    const sessions = d.prepare('SELECT * FROM sessions ORDER BY id ASC').all() as Session[];
    const puffEvents = d.prepare('SELECT * FROM puff_events ORDER BY id ASC').all() as PuffEvent[];
    const counters = d.prepare('SELECT * FROM global_counters').all() as { key: string; value: number }[];
    const states = d.prepare('SELECT * FROM app_state').all() as { key: string; value: string }[];

    const globalCounters: Record<string, number> = {};
    for (const c of counters) globalCounters[c.key] = c.value;

    const appState: Record<string, string> = {};
    for (const s of states) appState[s.key] = s.value;

    const maxSessionId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.id)) : 0;
    const maxPuffId = puffEvents.length > 0 ? Math.max(...puffEvents.map((p) => p.id)) : 0;

    return {
      sessions,
      puffEvents,
      globalCounters,
      appState,
      lastId: { sessions: maxSessionId, puffEvents: maxPuffId },
    };
  } catch (e) {
    console.error('[boro-db] getAllData failed', e);
    return { sessions: [], puffEvents: [], globalCounters: {}, appState: {}, lastId: { sessions: 0, puffEvents: 0 } };
  }
}
