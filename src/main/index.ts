import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { join } from 'path';
import { IPC } from '../shared/ipc-channels';
import {
  initDB,
  endSession,
  updateSessionDevice,
  logPuffEvent,
  incrementDisposableCounter,
  getGlobalCounter,
  setAppState,
  getAppState,
  getAllData,
} from './db';

const WINDOW_WIDTH = 300;
const WINDOW_HEIGHT = 520;
const WINDOW_MARGIN = 20;

let mainWindow: BrowserWindow | null = null;
let profileWindow: BrowserWindow | null = null;
let selectWindow: BrowserWindow | null = null;

function getBottomRightPosition(): { x: number; y: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: width - WINDOW_WIDTH - WINDOW_MARGIN,
    y: height - WINDOW_HEIGHT - WINDOW_MARGIN,
  };
}


function createSelectWindow(): void {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  selectWindow = new BrowserWindow({
    width: 520,
    height: 420,
    x: Math.round((primary.width - 520) / 2),
    y: Math.round((primary.height - 420) / 2),
    frame: true,
    resizable: false,
    movable: true,
    title: 'choose your companion',
    backgroundColor: '#121212',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  selectWindow.once('ready-to-show', () => {
    selectWindow?.show();
  });
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    selectWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=select`);
  } else {
    selectWindow.loadFile(join(__dirname, '../renderer/index.html'), { search: 'window=select' });
  }
  selectWindow.on('closed', () => {
    selectWindow = null;
  });
}
function createWindow(): void {
  const { x, y } = getBottomRightPosition();
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: process.platform !== 'darwin',
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.once('ready-to-show', () => {
    mainWindow?.showInactive();
    console.log('Window shown at', mainWindow?.getPosition());
  });
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  mainWindow.on('moved', () => {});
}

function createProfileWindow(): void {
  if (profileWindow && !profileWindow.isDestroyed()) {
    profileWindow.focus();
    return;
  }
  profileWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: true,
    transparent: false,
    backgroundColor: '#121212',
    hasShadow: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    show: false,
    title: 'boro profile',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  profileWindow.once('ready-to-show', () => {
    profileWindow?.show();
  });
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    profileWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=profile`);
  } else {
    profileWindow.loadFile(join(__dirname, '../renderer/index.html'), { search: 'window=profile' });
  }
  profileWindow.on('closed', () => {
    profileWindow = null;
  });
}

app.whenReady().then(async () => {
  initDB();
  const selected = getAppState('selected_device_id');
  if (!selected) {
    createSelectWindow();
  } else {
    createWindow();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const sel = getAppState('selected_device_id');
      if (!sel) createSelectWindow();
      else createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  endSession();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  endSession();
});

ipcMain.on(IPC.DRAG_DELTA, (_event, { dx, dy }: { dx: number; dy: number }) => {
  if (!mainWindow || typeof dx !== 'number' || typeof dy !== 'number' || Number.isNaN(dx) || Number.isNaN(dy)) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
});

ipcMain.on(IPC.SET_IGNORE_MOUSE_EVENTS, (_event, ignore: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on(IPC.OPEN_PROFILE_WINDOW, () => {
  createProfileWindow();
});

ipcMain.handle(IPC.UPDATE_SESSION_DEVICE, (_event, brand: string, model: string) => {
  updateSessionDevice(brand, model);
});

ipcMain.handle(IPC.DB_LOG_PUFF, (_event, data: Parameters<typeof logPuffEvent>[0]) => {
  logPuffEvent(data);
});

ipcMain.handle(IPC.DB_INCREMENT_DISPOSABLE, () => {
  incrementDisposableCounter();
});

ipcMain.handle(IPC.DB_GET_COUNTER, (_event, key: string) => {
  return getGlobalCounter(key);
});

ipcMain.handle(IPC.DB_SET_APP_STATE, (_event, key: string, value: string) => {
  setAppState(key, value);
});

ipcMain.handle(IPC.DB_GET_APP_STATE, (_event, key: string) => {
  return getAppState(key) ?? null;
});

ipcMain.handle(IPC.GET_PROFILE_DATA, () => {
  return getAllData();
});

ipcMain.on(IPC.QUIT_APP, () => {
  app.quit();
});

ipcMain.on(IPC.SELECT_DEVICE_DONE, () => {
  if (selectWindow && !selectWindow.isDestroyed()) {
    selectWindow.close();
    selectWindow = null;
  }
  createWindow();
});
