/** Bluetooth heart-rate straps (any standard HR monitor: Polar, Garmin HRM, Wahoo, Coros…). */
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Subscription } from 'react-native-ble-plx';
import { base64ToBytes, HR_MEASUREMENT, HR_SERVICE, parseHeartRate } from '../domain/hr';
import type { FoundDevice } from './heartRate';

export type { FoundDevice } from './heartRate';

let manager: BleManager | null = null;
const ble = () => (manager ??= new BleManager());
let monitor: Subscription | null = null;
let connectedId: string | null = null;

async function androidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const r = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

async function poweredOn(): Promise<boolean> {
  const state = await ble().state();
  if (state === State.PoweredOn) return true;
  return new Promise((resolve) => {
    const sub = ble().onStateChange((s) => {
      if (s === State.PoweredOn) {
        sub.remove();
        resolve(true);
      }
    }, true);
    setTimeout(() => {
      sub.remove();
      resolve(false);
    }, 4000);
  });
}

export const hrStrap = {
  supported: true,
  /** Scan for 15 s; returns a stop function. */
  async scan(onDevice: (d: FoundDevice) => void, onError: (msg: string) => void): Promise<() => void> {
    if (!(await androidPermissions())) {
      onError('Bluetooth permission is needed to find your strap.');
      return () => {};
    }
    if (!(await poweredOn())) {
      onError('Turn Bluetooth on, then try again.');
      return () => {};
    }
    const seen = new Set<string>();
    await ble().startDeviceScan([HR_SERVICE], null, (err, d) => {
      if (err) return onError(err.message);
      if (!d || seen.has(d.id)) return;
      seen.add(d.id);
      onDevice({ id: d.id, name: d.name ?? d.localName ?? 'Heart-rate monitor', rssi: d.rssi });
    });
    const t = setTimeout(() => void ble().stopDeviceScan(), 15_000);
    return () => {
      clearTimeout(t);
      void ble().stopDeviceScan();
    };
  },
  async connect(id: string, onBpm: (bpm: number) => void, onDrop: () => void): Promise<void> {
    if (!(await androidPermissions()) || !(await poweredOn())) throw new Error('Bluetooth is off or not allowed.');
    await hrStrap.disconnect();
    const d = await ble().connectToDevice(id, { timeout: 10_000, autoConnect: Platform.OS === 'android' });
    await d.discoverAllServicesAndCharacteristics();
    connectedId = id;
    monitor = d.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (err, ch) => {
      if (err) {
        connectedId = null;
        onDrop();
        return;
      }
      const bpm = ch?.value ? parseHeartRate(base64ToBytes(ch.value)) : null;
      if (bpm) onBpm(bpm);
    });
    ble().onDeviceDisconnected(id, () => {
      connectedId = null;
      onDrop();
    });
  },
  async disconnect(): Promise<void> {
    monitor?.remove();
    monitor = null;
    if (connectedId) await ble().cancelDeviceConnection(connectedId).catch(() => undefined);
    connectedId = null;
  },
};
