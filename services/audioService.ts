import { SoundType } from '../types';

// Audio file URLs - using free boxing/fighting sounds from CDN
const SOUND_FILES: Partial<Record<SoundType, string>> = {
  boxing_bell: 'https://cdn.freesound.org/previews/66/66951_634166-lq.mp3', // Boxing ring bell
  fight: 'https://cdn.freesound.org/previews/320/320181_5260872-lq.mp3', // Fight announcer style
  rumble: 'https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3', // Rumble/crowd roar
};

class AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioCache: Map<string, AudioBuffer> = new Map();

  private init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    // Always resume on interaction
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  }

  private createOscillator(freq: number, type: OscillatorType, startTime: number, duration: number, gainVal: number) {
    if (!this.context || !this.masterGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private async loadAudioFile(url: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;

    // Check cache first
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!;
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.audioCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.error('Failed to load audio file:', url, e);
      return null;
    }
  }

  private async playAudioFile(url: string, volume: number) {
    if (!this.context || !this.masterGain) return;

    const buffer = await this.loadAudioFile(url);
    if (!buffer) {
      // Fallback to oscillator if file fails
      this.playOscillatorSound('bell', volume);
      return;
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(volume, this.context.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();
  }

  private playOscillatorSound(type: SoundType, volume: number) {
    if (!this.context || !this.masterGain) return;

    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
    const now = this.context.currentTime;

    switch (type) {
      case 'beep':
        this.createOscillator(880, 'sine', now, 0.1, 0.5);
        break;
      case 'buzzer':
        this.createOscillator(150, 'sawtooth', now, 0.8, 0.5);
        this.createOscillator(145, 'sawtooth', now, 0.8, 0.5); // Detuned
        break;
      case 'bell':
        this.createOscillator(880, 'sine', now, 1.5, 0.6);
        this.createOscillator(1760, 'sine', now, 1.5, 0.1); // Harmonic
        break;
      case 'horn':
        this.createOscillator(200, 'sawtooth', now, 0.6, 0.4);
        this.createOscillator(205, 'sawtooth', now, 0.6, 0.4);
        this.createOscillator(400, 'square', now, 0.6, 0.1);
        break;
      case 'gong':
        this.createOscillator(100, 'sine', now, 2.5, 0.8);
        this.createOscillator(150, 'square', now, 2.0, 0.1); // Attack
        break;
    }
  }

  public playSound(type: SoundType, volume: number = 0.8) {
    if (type === 'none') return;
    try {
      this.init();
      if (!this.context || !this.masterGain) return;

      // Check if this is a file-based sound
      const soundUrl = SOUND_FILES[type];
      if (soundUrl) {
        this.playAudioFile(soundUrl, volume);
      } else {
        this.playOscillatorSound(type, volume);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }

  // Preload audio files for faster playback
  public async preloadSounds() {
    this.init();
    for (const url of Object.values(SOUND_FILES)) {
      if (url) {
        await this.loadAudioFile(url);
      }
    }
  }
}

export const audioService = new AudioService();
