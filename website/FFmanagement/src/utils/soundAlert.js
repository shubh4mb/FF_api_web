// src/utils/soundAlert.js

class SoundAlertManager {
  constructor() {
    this.audioCtx = null;
    this.storageKey = 'flashfits_admin_order_sound_enabled';
    this.enabled = this.loadPreference();
  }

  loadPreference() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  }

  setSoundEnabled(enabled) {
    this.enabled = !!enabled;
    try {
      localStorage.setItem(this.storageKey, String(this.enabled));
    } catch {}
  }

  isSoundEnabled() {
    return this.enabled;
  }

  toggleSound() {
    this.setSoundEnabled(!this.enabled);
    return this.enabled;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Plays a pleasant, modern multi-tone chime for incoming orders.
   * Completely generated via Web Audio API oscillators — zero external network assets required.
   */
  playNewOrderSound(force = false) {
    if (!this.enabled && !force) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note sequence: D5 (587.33 Hz) -> G5 (783.99 Hz) -> D6 (1174.66 Hz)
      const notes = [
        { freq: 587.33, start: 0, dur: 0.16 },
        { freq: 783.99, start: 0.14, dur: 0.18 },
        { freq: 1174.66, start: 0.30, dur: 0.45 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        // Soft attack and smooth exponential decay
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch (err) {
      console.warn('Audio alert playback failed:', err);
    }
  }
}

export const soundAlert = new SoundAlertManager();
export default soundAlert;
