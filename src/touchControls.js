export class TouchControls {
    constructor() {
        this.moveVector = { x: 0, y: 0 };
        this.lookVector = { x: 0, y: 0 };
        this.shouldShoot = false;
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Track specific touch IDs to avoid conflicts
        this.moveTouchId = null;
        this.lookTouchId = null;

        if (this.isTouchDevice) {
            this.initUI();
            this.initListeners();
        }
    }

    initUI() {
        const container = document.getElementById('touch-controls');
        if (container) container.style.display = 'block';

        this.joystickKnob = document.getElementById('joystick-knob-left');
        this.joystickZone = document.getElementById('joystick-zone-left');
        this.lookZone = document.getElementById('look-zone-right');
        this.shootBtn = document.getElementById('btn-shoot');

        // Center of joystick
        this.joystickCenter = { x: 0, y: 0 };
        this.maxRadius = 60;

        this.lastLookX = 0;
        this.lastLookY = 0;
    }

    initListeners() {
        // --- JOYSTICK (Left Side) ---
        this.joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Only accept if we aren't already tracking a move finger
            if (this.moveTouchId === null) {
                const touch = e.changedTouches[0];
                this.moveTouchId = touch.identifier;

                // Recalculate center based on zone position
                const rect = this.joystickZone.getBoundingClientRect();
                this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

                this.handleJoystick(touch);
            }
        }, { passive: false });

        this.joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.moveTouchId) {
                    this.handleJoystick(e.changedTouches[i]);
                    break;
                }
            }
        }, { passive: false });

        this.joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.moveTouchId) {
                    this.resetJoystick();
                    this.moveTouchId = null;
                    break;
                }
            }
        }, { passive: false });

        // --- LOOK (Right Side) ---
        this.lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.lookTouchId === null) {
                const touch = e.changedTouches[0];
                this.lookTouchId = touch.identifier;
                this.lastLookX = touch.clientX;
                this.lastLookY = touch.clientY;
            }
        }, { passive: false });

        this.lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.lookTouchId) {
                    this.handleLook(e.changedTouches[i]);
                    break;
                }
            }
        }, { passive: false });

        this.lookZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.lookTouchId) {
                    this.lookTouchId = null;
                    this.lookVector = { x: 0, y: 0 };
                    break;
                }
            }
        }, { passive: false });

        // --- SHOOT BUTTON ---
        this.shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.shouldShoot = true;
            this.shootBtn.style.transform = 'scale(0.9)';
        }, { passive: false });

        this.shootBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.shouldShoot = false;
            this.shootBtn.style.transform = 'scale(1)';
        }, { passive: false });
    }

    handleJoystick(touch) {
        const deltaX = touch.clientX - this.joystickCenter.x;
        const deltaY = touch.clientY - this.joystickCenter.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const clampedDistance = Math.min(distance, this.maxRadius);
        const angle = Math.atan2(deltaY, deltaX);

        const knobX = Math.cos(angle) * clampedDistance;
        const knobY = Math.sin(angle) * clampedDistance;

        this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

        // Normalize output -1 to 1
        this.moveVector.x = knobX / this.maxRadius;
        this.moveVector.y = knobY / this.maxRadius;
    }

    resetJoystick() {
        this.joystickKnob.style.transform = `translate(-50%, -50%)`;
        this.moveVector = { x: 0, y: 0 };
    }

    handleLook(touch) {
        const deltaX = touch.clientX - this.lastLookX;
        const deltaY = touch.clientY - this.lastLookY;

        this.lastLookX = touch.clientX;
        this.lastLookY = touch.clientY;

        // Increased sensitivity for better feel
        const sensitivity = 0.008;
        this.lookVector.x = deltaX * sensitivity;
        this.lookVector.y = deltaY * sensitivity;
    }

    getLookDelta() {
        const delta = { ...this.lookVector };
        this.lookVector = { x: 0, y: 0 }; // Reset after reading
        return delta;
    }
}
