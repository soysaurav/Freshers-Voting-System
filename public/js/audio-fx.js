/**
 * Synthesized Web Audio FX Engine for Voting & Dramatic Reveal
 * Zero external audio assets required; 100% offline and reliable.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playVoteBeep() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Warm chime: 523Hz (C5) -> 659Hz (E5) -> 784Hz (G5)
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  }

  playCountdownTick(secondsLeft) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    // Pitch gets higher as countdown approaches 1
    const pitch = 440 + (4 - secondsLeft) * 120;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playTensionRiser(durationSeconds = 3) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep rising oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + durationSeconds);

    // Lowpass filter sweeping up
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + durationSeconds);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.15, now + durationSeconds);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds + 0.15);
  }

  playGrandRevealFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Euphoric brass fanfare chords (Eb Major / Bb Major triumph)
    const notes = [
      { f: 311.13, t: 0.0, d: 0.8 },  // Eb4
      { f: 392.00, t: 0.1, d: 0.8 },  // G4
      { f: 466.16, t: 0.2, d: 0.8 },  // Bb4
      { f: 622.25, t: 0.35, d: 1.8 }, // Eb5 (accent)
      { f: 783.99, t: 0.35, d: 1.8 }, // G5 (accent)
      { f: 932.33, t: 0.35, d: 2.0 }  // Bb5 (lead high)
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.001, now + n.t);
      gain.gain.linearRampToValueAtTime(0.22, now + n.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.05);
    });
  }

  playCashChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Celebratory cha-ching bell arpeggio (B5 -> E6 -> G#6 -> B6)
    const notes = [
      { f: 987.77, t: 0.0, d: 0.35, vol: 0.18 }, // B5
      { f: 1318.51, t: 0.07, d: 0.4, vol: 0.22 }, // E6
      { f: 1661.22, t: 0.14, d: 0.45, vol: 0.2 }, // G#6
      { f: 1975.53, t: 0.21, d: 0.75, vol: 0.25 } // B6 (ring out)
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.001, now + n.t);
      gain.gain.linearRampToValueAtTime(n.vol, now + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.05);
    });
  }
}

window.soundFx = new SoundEngine();
// Unlock audio on first user gesture
['click', 'touchstart', 'keydown'].forEach(evt => {
  window.addEventListener(evt, () => window.soundFx.init(), { once: true });
});
