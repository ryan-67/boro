declare global {
  interface Window {
    boro: {
      ipc: {
        send: (channel: string, ...args: unknown[]) => void;
        on: (channel: string, listener: (...args: unknown[]) => void) => (() => void);
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      };
      channels: Record<string, string>;
      assetsDir: string;
    };
  }
}

import SpriteApp from './SpriteApp';
import ProfileApp from './ProfileApp';
import SelectDeviceApp from './SelectDeviceApp';

const isProfile = new URLSearchParams(window.location.search).get('window') === 'profile';
const isSelect = new URLSearchParams(window.location.search).get('window') === 'select';

export default function App() {
  if (isSelect) return <SelectDeviceApp />;
  return isProfile ? <ProfileApp /> : <SpriteApp />;
}
