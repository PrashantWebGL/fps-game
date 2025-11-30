export class TouchControls {
    constructor() {
        this.moveVector = { x: 0, y: 0 };
        this.lookVector = { x: 0, y: 0 };
        this.shouldShoot = false;
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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

        // Center of joystick (calculated on touch start to handle resizing/scrolling)
        this.joystickCenter = { x: 0, y: 0 };
        this.maxRadius = 60; // Half of 120px width

        this.lastTouchX = 0;
        this.lastTouchY = 0;
    }

    initListeners() {
        // Joystick
        this.joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.joystickZone.getBoundingClientRect();
            this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            this.handleJoystick(e.targetTouches[0]);
        }, { passive: false });

        this.joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleJoystick(e.targetTouches[0]);
        }, { passive: false });

        this.joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.resetJoystick();
        }, { passive: false });

        // Look
        this.lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.lastTouchX = e.targetTouches[0].clientX;
            this.lastTouchY = e.targetTouches[0].clientY;
        }, { passive: false });

        this.lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleLook(e.targetTouches[0]);
        }, { passive: false });

        this.lookZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.lookVector = { x: 0, y: 0 };
        }, { passive: false });

        // Shoot
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
        const deltaX = touch.clientX - this.lastTouchX;
        const deltaY = touch.clientY - this.lastTouchY;

        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;

        // Sensitivity factor
        const sensitivity = 0.005;
        this.lookVector.x = deltaX * sensitivity;
        this.lookVector.y = deltaY * sensitivity;
    }

    getLookDelta() {
        const delta = { ...this.lookVector };
        this.lookVector = { x: 0, y: 0 }; // Reset after reading (for delta movement)
        return delta;
    }
}
