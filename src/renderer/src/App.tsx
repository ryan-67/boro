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

const isProfile = new URLSearchParams(window.location.search).get('window') === 'profile';

export default function App() {
  return isProfile ? <ProfileApp /> : <SpriteApp />;
}
