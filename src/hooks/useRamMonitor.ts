import { useState, useEffect, useCallback } from 'react';
import { NativeModules } from 'react-native';

const { DeviceInfoModule } = NativeModules;

// iPhone model identifier → total RAM in GB
// Source: https://www.theiphonewiki.com/wiki/Models
const IPHONE_RAM_MAP: Record<string, number> = {
  // iPhone 16 series
  'iPhone17,1': 8,  // iPhone 16 Pro Max
  'iPhone17,2': 8,  // iPhone 16 Pro
  'iPhone17,3': 8,  // iPhone 16 Plus
  'iPhone17,4': 8,  // iPhone 16
  // iPhone 15 series
  'iPhone16,1': 6,  // iPhone 15 Pro
  'iPhone16,2': 8,  // iPhone 15 Pro Max
  'iPhone15,4': 6,  // iPhone 15
  'iPhone15,5': 6,  // iPhone 15 Plus
  // iPhone 14 series
  'iPhone15,2': 6,  // iPhone 14 Pro
  'iPhone15,3': 6,  // iPhone 14 Pro Max
  'iPhone14,7': 6,  // iPhone 14
  'iPhone14,8': 6,  // iPhone 14 Plus
  // iPhone 13 series
  'iPhone14,2': 6,  // iPhone 13 Pro
  'iPhone14,3': 6,  // iPhone 13 Pro Max
  'iPhone14,4': 4,  // iPhone 13 mini
  'iPhone14,5': 4,  // iPhone 13
  // iPhone 12 series
  'iPhone13,1': 4,  // iPhone 12 mini
  'iPhone13,2': 4,  // iPhone 12
  'iPhone13,3': 6,  // iPhone 12 Pro
  'iPhone13,4': 6,  // iPhone 12 Pro Max
  // iPhone 11 series
  'iPhone12,1': 4,  // iPhone 11
  'iPhone12,3': 4,  // iPhone 11 Pro
  'iPhone12,5': 4,  // iPhone 11 Pro Max
  // iPhone XS/XR
  'iPhone11,2': 4,  // iPhone XS
  'iPhone11,4': 4,  // iPhone XS Max
  'iPhone11,6': 4,  // iPhone XS Max (China)
  'iPhone11,8': 3,  // iPhone XR
  // iPhone X/8
  'iPhone10,1': 2,  // iPhone 8
  'iPhone10,4': 2,  // iPhone 8
  'iPhone10,2': 3,  // iPhone 8 Plus
  'iPhone10,5': 3,  // iPhone 8 Plus
  'iPhone10,3': 3,  // iPhone X
  'iPhone10,6': 3,  // iPhone X
};

export type RamPressure = 'low' | 'moderate' | 'high' | 'critical';

export interface RamInfo {
  deviceId: string;
  deviceRamGB: number;        // total physical RAM
  usedRamGB: number;          // current used RAM
  usagePercent: number;       // 0–100
  pressure: RamPressure;
  isAvailable: boolean;
}

const DEFAULT_RAM: RamInfo = {
  deviceId: '',
  deviceRamGB: 0,
  usedRamGB: 0,
  usagePercent: 0,
  pressure: 'low',
  isAvailable: false,
};

function getPressure(usagePercent: number): RamPressure {
  if (usagePercent >= 85) return 'critical';
  if (usagePercent >= 70) return 'high';
  if (usagePercent >= 50) return 'moderate';
  return 'low';
}

export function useRamMonitor(intervalMs = 4000): RamInfo {
  const [info, setInfo] = useState<RamInfo>(DEFAULT_RAM);

  const refresh = useCallback(async () => {
    if (!DeviceInfoModule) return;
    try {
      const [deviceId, totalBytes, usedBytes] = await Promise.all([
        DeviceInfoModule.getDeviceIdentifier() as Promise<string>,
        DeviceInfoModule.getTotalRam() as Promise<number>,
        DeviceInfoModule.getUsedRam() as Promise<number>,
      ]);

      const lookupKey = Object.keys(IPHONE_RAM_MAP).find((k) => deviceId.startsWith(k));
      const deviceRamGB = lookupKey
        ? IPHONE_RAM_MAP[lookupKey]
        : totalBytes / 1_073_741_824;

      const usedRamGB = usedBytes / 1_073_741_824;
      // Use physical total for percentage so it reflects true pressure
      const totalRamGB = totalBytes / 1_073_741_824;
      const usagePercent = Math.min(100, Math.round((usedRamGB / totalRamGB) * 100));

      setInfo({
        deviceId,
        deviceRamGB: Math.round(deviceRamGB * 10) / 10,
        usedRamGB: Math.round(usedRamGB * 100) / 100,
        usagePercent,
        pressure: getPressure(usagePercent),
        isAvailable: true,
      });
    } catch {
      // Native module not available (e.g. simulator without bridging header set)
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return info;
}
