import { contextBridge, ipcRenderer } from 'electron'
import { IPC, IpcChannel } from '../shared/ipc-channels'

const ASSETS_DIR = 'D:\\Projects\\boro\\assets'

contextBridge.exposeInMainWorld('boro', {
  ipc: {
    send: (channel: IpcChannel, ...args: unknown[]): void => {
      ipcRenderer.send(channel, ...args)
    },
    on: (channel: IpcChannel, listener: (...args: unknown[]) => void): (() => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
        listener(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    },
    invoke: (channel: IpcChannel, ...args: unknown[]): Promise<unknown> =>
      ipcRenderer.invoke(channel, ...args),
  },
  channels: IPC,
  assetsDir: ASSETS_DIR,
})
