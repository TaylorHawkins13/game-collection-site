/** Fallback (web): no Bluetooth. Native: heartRate.native.ts. */
export interface FoundDevice {
  id: string;
  name: string;
  rssi: number | null;
}

export const hrStrap = {
  supported: false,
  scan: async (_onDevice: (d: FoundDevice) => void, _onError: (msg: string) => void): Promise<() => void> => () => {},
  connect: async (_id: string, _onBpm: (bpm: number) => void, _onDrop: () => void): Promise<void> => {
    throw new Error('Bluetooth isn’t available here.');
  },
  disconnect: async () => {},
};
