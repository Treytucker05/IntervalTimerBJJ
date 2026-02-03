export enum TimerState {
  IDLE = 'IDLE',
  WARMUP = 'WARMUP',
  WORK = 'WORK',
  REST = 'REST',
  FINISHED = 'FINISHED'
}

export type SoundType = 'beep' | 'buzzer' | 'bell' | 'horn' | 'gong' | 'boxing_bell' | 'fight' | 'rumble' | 'none';

export interface AlertSetting {
  sound: SoundType;
  vibrate: boolean;
}

export interface TimerConfig {
  id: string;
  name: string;
  rounds: number;
  workDuration: number; // in seconds
  restDuration: number; // in seconds
  warmupDuration: number; // in seconds
  
  // Audio & Haptics
  volume: number; // 0.0 to 1.0
  alerts: {
    startRound: AlertSetting;
    endRound: AlertSetting;
    startRest: AlertSetting;
    endRest: AlertSetting;
  };
}

const DEFAULT_ALERTS = {
  startRound: { sound: 'fight' as SoundType, vibrate: true },
  endRound: { sound: 'boxing_bell' as SoundType, vibrate: true },
  startRest: { sound: 'none' as SoundType, vibrate: false },
  endRest: { sound: 'rumble' as SoundType, vibrate: false },
};

export const DEFAULT_CONFIG: TimerConfig = {
  id: 'default',
  name: 'Standard BJJ',
  rounds: 5,
  workDuration: 300,
  restDuration: 60,
  warmupDuration: 10,
  volume: 0.8,
  alerts: DEFAULT_ALERTS,
};

export const ROLL_CONFIG: TimerConfig = {
  id: 'rolling',
  name: 'Open Mat Rolling',
  rounds: 10,
  workDuration: 360,
  restDuration: 60,
  warmupDuration: 10,
  volume: 0.8,
  alerts: DEFAULT_ALERTS,
};

export const HIIT_CONFIG: TimerConfig = {
  id: 'hiit',
  name: 'Tabata / HIIT',
  rounds: 8,
  workDuration: 20,
  restDuration: 10,
  warmupDuration: 10,
  volume: 0.8,
  alerts: {
    ...DEFAULT_ALERTS,
    startRound: { sound: 'beep' as SoundType, vibrate: true },
    endRound: { sound: 'beep' as SoundType, vibrate: true },
  }
};