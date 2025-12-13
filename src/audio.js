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

        // Load Headshot Sound
        this.headshotBuffer = null;
        fetch('/assets/sounds/headshot.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.headshotBuffer = audioBuffer;
                console.log('Headshot sound loaded');
            })
            .catch(e => console.error('Error loading headshot sound:', e));

        // Load Heavy Breathing Sound
        this.breathingBuffer = null;
        this.breathingSource = null;
        fetch('/assets/sounds/heavybreathing.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.breathingBuffer = audioBuffer;
                console.log('Breathing sound loaded');
            })
            .catch(e => console.error('Error loading breathing sound:', e));
    }

    playHeadshot() {
        if (!this.enabled || !this.headshotBuffer || this.ctx.state !== 'running') return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.headshotBuffer;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.8;

        source.connect(gain);
        gain.connect(this.ctx.destination);

        source.start(0);
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

    playBossSpawn() {
        if (!this.enabled || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;

        // Ominous low rumble
        const rumble = this.ctx.createOscillator();
        rumble.type = 'sawtooth';
        rumble.frequency.setValueAtTime(40, t);
        rumble.frequency.exponentialRampToValueAtTime(30, t + 1.5);

        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.6, t);
        rumbleGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

        rumble.connect(rumbleGain);
        rumbleGain.connect(this.ctx.destination);
        rumble.start(t);
        rumble.stop(t + 1.5);

        // Warning siren sweep
        const siren = this.ctx.createOscillator();
        siren.type = 'sine';
        siren.frequency.setValueAtTime(200, t + 0.2);
        siren.frequency.exponentialRampToValueAtTime(800, t + 0.8);
        siren.frequency.exponentialRampToValueAtTime(200, t + 1.4);

        const sirenGain = this.ctx.createGain();
        sirenGain.gain.setValueAtTime(0, t + 0.2);
        sirenGain.gain.linearRampToValueAtTime(0.4, t + 0.4);
        sirenGain.gain.linearRampToValueAtTime(0.4, t + 1.2);
        sirenGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

        siren.connect(sirenGain);
        sirenGain.connect(this.ctx.destination);
        siren.start(t + 0.2);
        siren.stop(t + 1.5);
    }

    playBossDown() {
        if (!this.enabled || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;

        // Deep explosion bass
        const explosion = this.ctx.createOscillator();
        explosion.type = 'sawtooth';
        explosion.frequency.setValueAtTime(80, t);
        explosion.frequency.exponentialRampToValueAtTime(20, t + 0.8);

        const explosionGain = this.ctx.createGain();
        explosionGain.gain.setValueAtTime(0.8, t);
        explosionGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

        explosion.connect(explosionGain);
        explosionGain.connect(this.ctx.destination);
        explosion.start(t);
        explosion.stop(t + 0.8);

        // Roar/scream effect (distorted noise)
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const roar = this.ctx.createBufferSource();
        roar.buffer = buffer;

        const roarFilter = this.ctx.createBiquadFilter();
        roarFilter.type = 'bandpass';
        roarFilter.frequency.setValueAtTime(400, t);
        roarFilter.frequency.exponentialRampToValueAtTime(100, t + 0.6);
        roarFilter.Q.value = 5;

        const roarGain = this.ctx.createGain();
        roarGain.gain.setValueAtTime(0.6, t);
        roarGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        roar.connect(roarFilter);
        roarFilter.connect(roarGain);
        roarGain.connect(this.ctx.destination);
        roar.start(t);

        // Victory chime (ascending notes)
        const playChime = (freq, delay) => {
            const chime = this.ctx.createOscillator();
            chime.type = 'sine';
            chime.frequency.value = freq;

            const chimeGain = this.ctx.createGain();
            chimeGain.gain.setValueAtTime(0.3, t + delay);
            chimeGain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.5);

            chime.connect(chimeGain);
            chimeGain.connect(this.ctx.destination);
            chime.start(t + delay);
            chime.stop(t + delay + 0.5);
        };

        playChime(523, 0.3); // C5
        playChime(659, 0.45); // E5
        playChime(784, 0.6); // G5
        playChime(1047, 0.75); // C6
    }

    playPotionCollect() {
        if (!this.enabled || this.ctx.state !== 'running') return;

        const t = this.ctx.currentTime;

        // Magical chime (ascending arpeggio)
        const playNote = (freq, time, duration) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + duration);
        };

        // play E5, G5, B5, E6
        playNote(659.25, t, 0.5);
        playNote(783.99, t + 0.1, 0.5);
        playNote(987.77, t + 0.2, 0.5);
        playNote(1318.51, t + 0.3, 0.5);
    }

    playPowerupCollect() {
        if (!this.enabled || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime;

        // More intense powerup sound (Major chord, Sawtooth, rapid)
        const playNote = (freq, time) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

            // Lowpass filter for "wah" effect
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, time);
            filter.frequency.linearRampToValueAtTime(3000, time + 0.1);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.5);
        };

        playNote(440, t);       // A4
        playNote(554.37, t);    // C#5
        playNote(659.25, t);    // E5
        playNote(880, t + 0.1); // A5
    }

    playBossAmbient() {
        if (!this.enabled || this.ctx.state !== 'running') return;

        // Stop existing ambient if any
        this.stopBossAmbient();

        const t = this.ctx.currentTime;

        // Create a continuous deep drone
        this.bossAmbientOsc = this.ctx.createOscillator();
        this.bossAmbientOsc.type = 'sawtooth';
        this.bossAmbientOsc.frequency.setValueAtTime(30, t); // Low rumble

        // LFO for modulation
        this.bossAmbientLFO = this.ctx.createOscillator();
        this.bossAmbientLFO.type = 'sine';
        this.bossAmbientLFO.frequency.setValueAtTime(0.5, t); // Slow pulse

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 10; // Modulate frequency by +/- 10Hz

        this.bossAmbientLFO.connect(lfoGain);
        lfoGain.connect(this.bossAmbientOsc.frequency);

        // Main gain for the ambient sound
        this.bossAmbientGain = this.ctx.createGain();
        this.bossAmbientGain.gain.setValueAtTime(0, t);
        this.bossAmbientGain.gain.linearRampToValueAtTime(0.3, t + 2); // Fade in

        this.bossAmbientOsc.connect(this.bossAmbientGain);
        this.bossAmbientGain.connect(this.ctx.destination);

        this.bossAmbientOsc.start(t);
        this.bossAmbientLFO.start(t);
    }

    stopBossAmbient() {
        if (this.bossAmbientOsc) {
            const t = this.ctx.currentTime;
            // Fade out
            try {
                this.bossAmbientGain.gain.cancelScheduledValues(t);
                this.bossAmbientGain.gain.setValueAtTime(this.bossAmbientGain.gain.value, t);
                this.bossAmbientGain.gain.linearRampToValueAtTime(0, t + 1);

                const osc = this.bossAmbientOsc;
                const lfo = this.bossAmbientLFO;

                setTimeout(() => {
                    osc.stop();
                    lfo.stop();
                    osc.disconnect();
                    lfo.disconnect();
                }, 1000);
            } catch (e) {
                // Ignore errors if already stopped/invalid
            }

            this.bossAmbientOsc = null;
            this.bossAmbientLFO = null;
        }
    }



    playBreathing() {
        if (!this.enabled || !this.breathingBuffer || this.ctx.state !== 'running') return;

        // If already playing, do nothing
        if (this.breathingSource) return;

        this.breathingSource = this.ctx.createBufferSource();
        this.breathingSource.buffer = this.breathingBuffer;
        this.breathingSource.loop = true; // Loop continuously

        const gain = this.ctx.createGain();
        gain.gain.value = 0.6;

        this.breathingSource.connect(gain);
        gain.connect(this.ctx.destination);

        this.breathingSource.start(0);
    }

    stopBreathing() {
        if (this.breathingSource) {
            try {
                this.breathingSource.stop();
            } catch (e) { }
            this.breathingSource.disconnect();
            this.breathingSource = null;
        }
    }
}
