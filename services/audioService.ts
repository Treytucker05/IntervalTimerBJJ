import { SoundType } from '../types';

class AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

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

  public playSound(type: SoundType, volume: number = 0.8) {
    if (type === 'none') return;
    try {
      this.init();
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
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }
}

export const audioService = new AudioService();