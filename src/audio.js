export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = false;

        // Resume context on user interaction
        document.addEventListener('click', () => {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.enabled = true;
        }, { once: true });
    }

    playFootstep(volume = 0.5) {
        if (!this.enabled || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;

        // Create Noise Buffer
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.1);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(volume, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noise.start(t);
    }

    playGunshot(isEnemy = false) {
        if (!this.enabled || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;

        // 1. The "Thump" (Low frequency body)
        const osc = this.ctx.createOscillator();
        osc.type = isEnemy ? 'triangle' : 'sine';
        // Pitch drop: 150Hz -> 50Hz
        osc.frequency.setValueAtTime(isEnemy ? 120 : 150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);

        // 2. The "Crack" (High frequency noise impact)
        const bufferSize = this.ctx.sampleRate * 0.3; // Longer tail (0.3s)
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass'; // Remove mud
        noiseFilter.frequency.setValueAtTime(1000, t);

        const noiseGain = this.ctx.createGain();
        // Sharp attack, longer decay
        noiseGain.gain.setValueAtTime(0.8, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(t);
    }
}
