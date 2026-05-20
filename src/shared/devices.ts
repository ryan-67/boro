export interface DeviceSpec {
  id: string;
  brand: string;
  model: string;
  maxPuffs: number;
  batteryMah: number;
  eLiquidMl: number;
  chargeTimeMin: number;
  spriteFile: string;
  width: number;
  height: number;
}

export const DEVICES: DeviceSpec[] = [
  {
    id: 'geek-pulse-x-25000',
    brand: 'Geek Bar',
    model: 'Pulse X',
    maxPuffs: 25000,
    batteryMah: 800,
    eLiquidMl: 18,
    chargeTimeMin: 45,
    spriteFile: 'geek_pulse_x.png',
    width: 140,
    height: 280,
  },
  {
    id: 'foger-switch-pro-30000',
    brand: 'Foger',
    model: 'Switch Pro',
    maxPuffs: 30000,
    batteryMah: 1050,
    eLiquidMl: 19,
    chargeTimeMin: 45,
    spriteFile: 'foger.png',
    width: 160,
    height: 240,
  },
];
