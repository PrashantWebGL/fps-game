import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Weapon } from './weapon.js';
import { createSoldierModel } from './soldierModel.js';
import { TouchControls } from './touchControls.js';

export class Player {
    constructor(camera, scene, domElement, soundManager, isSafari = false) {
        this.camera = camera;
        this.scene = scene;
        this.soundManager = soundManager;
        this.isSafari = isSafari;

        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isDead = false;

        // Powerups
        this.isBurstMode = false;
        this.isBursting = false;

        // Movement
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 10;
        this.jumpVelocity = 15; // Set base variable to 15 just in case
        this.gravity = -20;
        this.isOnGround = false;

        // Dummy Camera (for 3rd Person)
        this.dummyCamera = new THREE.Object3D();
        this.dummyCamera.position.set(0, 2.1, 0); // Raised for "between eyebrows" feel
        this.dummyCamera.rotation.order = 'YXZ'; // Important for FPS controls
        this.scene.add(this.dummyCamera);

        // 3rd Person Toggle
        this.isThirdPerson = false;

        // Hitbox (approximate)
        this.hitbox = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.5, 1.8, 4, 8),
            new THREE.MeshBasicMaterial({ visible: false }) // Invisible hitbox
        );
        this.scene.add(this.hitbox);

        // Visible Player Model for 3rd Person - Army Soldier
        this.playerModel = createSoldierModel(0x4a5a3a); // Olive green for player
        this.playerModel.visible = false;
        this.scene.add(this.playerModel);

        // Weapon
        this.weapon = new Weapon(this.camera, scene); // Weapon attaches to real camera

        // Audio
        this.distanceTraveled = 0;
        this.stepInterval = 2.5; // Every 2.5 units

        this.touchControls = new TouchControls();
        this.initControls(domElement);
    }

    initControls(domElement) {
        this.controls = new PointerLockControls(this.dummyCamera, domElement);

        // POINTER LOCK & TRACKPAD FIX: Use unadjustedMovement if available to bypass palm rejection
        this.controls.lock = () => {
            const options = { unadjustedMovement: true };
            domElement.requestPointerLock(options).catch(e => {
                if (e.name === 'NotSupportedError') {
                    // Fallback for older browsers
                    domElement.requestPointerLock();
                }
            });
        };

        // Manual Rotation Handling (More responsive for trackpads)
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === domElement && !this.isDead) {
                // If not Safari (where we already have a specialized boost),
                // we still want to ensure smooth movement.
                // PointerLockControls usually handles this, but we can augment it
                // if we find trackpads are being filtered.

                if (this.isSafari) {
                    const movementX = event.movementX || 0;
                    const movementY = event.movementY || 0;
                    const sensitivity = 0.01;

                    this.dummyCamera.rotation.y -= movementX * 0.002 * 5.0;
                    this.dummyCamera.rotation.x -= movementY * 0.002 * 5.0;
                    this.dummyCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.dummyCamera.rotation.x));
                }
            }
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'Space':
                    event.preventDefault(); // Prevent scrolling or button actuation
                    if (this.canJump === true) this.velocity.y += 15; // Jump force
                    this.canJump = false;
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = false;
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    update(delta, walls) {
        if (this.isDead) return;

        // Friction
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 3.0 * delta; // Gravity

        // Jump
        if (this.touchControls.shouldJump && this.canJump) {
            this.velocity.y = 15; // Increased to 15 to match desktop jump power
            this.canJump = false;
            this.touchControls.shouldJump = false; // Reset jump flag
        }

        // Calculate Movement Direction in World Space
        const touchMove = this.touchControls.moveVector;

        let moveZ = Number(this.moveBackward) - Number(this.moveForward);
        let moveX = Number(this.moveLeft) - Number(this.moveRight);

        if (touchMove.x !== 0 || touchMove.y !== 0) {
            moveZ += touchMove.y;
            moveX += touchMove.x;
        }

        // Normalize direction vector if moving
        this.direction.set(moveX, 0, moveZ);
        if (this.direction.lengthSq() > 0) {
            this.direction.normalize();
        }

        // Apply Touch Look
        const lookDelta = this.touchControls.getLookDelta();
        if (lookDelta.x !== 0 || lookDelta.y !== 0) {
            // Apply pitch to dummyCamera so it matches PC behavior (PointerLockControls)
            this.dummyCamera.rotation.y -= lookDelta.x;
            this.dummyCamera.rotation.x -= lookDelta.y;
            this.dummyCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.dummyCamera.rotation.x));
        }

        // Get Camera Direction (XZ plane only)
        const forward = new THREE.Vector3();
        this.dummyCamera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        if (moveZ !== 0 || moveX !== 0) {
            const moveSpeed = this.speed * 10.0 * delta;
            this.velocity.add(forward.clone().multiplyScalar(moveZ * moveSpeed));
            this.velocity.add(right.clone().multiplyScalar(moveX * moveSpeed));
        }

        // Apply Velocity & Collision (Separate Axes)
        const oldPos = this.dummyCamera.position.clone();

        // 0. Anti-Stuck Check (Start of frame)
        if (this.checkWallCollision(walls)) {
            for (let i = 0; i < 20; i++) {
                this.dummyCamera.position.y += 0.5;
                if (!this.checkWallCollision(walls)) break;
            }
        }

        // 1. Move X
        this.dummyCamera.position.x += this.velocity.x * delta;
        if (this.checkWallCollision(walls)) {
            // Tighten: push back a bit more to ensure we're out
            this.dummyCamera.position.x = oldPos.x - (this.velocity.x * 0.1 * delta);
            this.velocity.x = 0;
        }

        // 2. Move Z
        this.dummyCamera.position.z += this.velocity.z * delta;
        if (this.checkWallCollision(walls)) {
            // Tighten: push back a bit more to ensure we're out
            this.dummyCamera.position.z = oldPos.z - (this.velocity.z * 0.1 * delta);
            this.velocity.z = 0;
        }

        // 3. Move Y
        this.dummyCamera.position.y += this.velocity.y * delta;

        // Vertical Collision
        const hitWall = this.checkWallCollision(walls, true, true); // returnObject=true, isVertical=true
        if (hitWall) {
            if (this.velocity.y < 0) {
                const wallBox = new THREE.Box3().setFromObject(hitWall);
                this.dummyCamera.position.y = wallBox.max.y + 2.0;
                this.velocity.y = 0;
                this.canJump = true;
                if (this.velocity.y < -5) this.soundManager.playFootstep();
            } else {
                this.dummyCamera.position.y = oldPos.y;
                this.velocity.y = 0;
            }
        }

        // Floor collision (Global floor) - Adjusted for new camera height
        if (this.dummyCamera.position.y < 2.1) {
            this.velocity.y = 0;
            this.dummyCamera.position.y = 2.1;
            this.canJump = true;
            if (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) {
                const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
                if (speed > 1) { // Only if moving fast enough
                    this.distanceTraveled += speed * delta;
                    if (this.distanceTraveled > this.stepInterval) {
                        this.soundManager.playFootstep();
                        this.distanceTraveled = 0;
                    }
                }
            }
        }

        // Update Hitbox position
        this.hitbox.position.copy(this.dummyCamera.position);
        this.hitbox.position.y -= 1; // Center capsule

        // Update Player Model position
        this.playerModel.position.copy(this.hitbox.position);

        // Update Real Camera Position
        if (this.isThirdPerson) {
            const offset = new THREE.Vector3(2.5, 1.8, 8);
            offset.applyQuaternion(this.dummyCamera.quaternion);
            this.camera.position.copy(this.dummyCamera.position).add(offset);
            const lookTarget = this.dummyCamera.position.clone();
            const forward = new THREE.Vector3(0, 0, -6);
            forward.applyQuaternion(this.dummyCamera.quaternion);
            lookTarget.add(forward);
            this.camera.lookAt(lookTarget);
        } else {
            this.camera.position.copy(this.dummyCamera.position);
            this.camera.quaternion.copy(this.dummyCamera.quaternion);
        }

        // Update Weapon
        this.weapon.update(delta);
    }

    checkWallCollision(walls, returnObject = false, isVertical = false) {
        this.hitbox.position.copy(this.dummyCamera.position);
        this.hitbox.position.y -= 1;

        const playerBox = new THREE.Box3().setFromObject(this.hitbox);
        // Do NOT expand by scalar negative, keep it strict to prevent clipping
        // playerBox.expandByScalar(-0.1); 

        const feetY = this.dummyCamera.position.y - 2.1;

        for (const wall of walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            if (!isVertical && feetY >= wallBox.max.y - 0.2) continue;

            if (playerBox.intersectsBox(wallBox)) {
                if (returnObject) return wall;
                return true;
            }
        }
        if (returnObject) return null;
        return false;
    }

    shoot(bullets, onBulletCreated = null) {
        if (this.isDead) return;

        if (this.isBurstMode) {
            if (this.isBursting) return;
            this.isBursting = true;

            let shotCount = 0;
            const burstInterval = setInterval(() => {
                this.weapon.shoot(bullets, 'player', onBulletCreated);
                this.soundManager.playGunshot(false);
                shotCount++;

                if (shotCount >= 3) {
                    clearInterval(burstInterval);
                    this.isBursting = false;
                }
            }, 100);

        } else {
            this.weapon.shoot(bullets, 'player', onBulletCreated);
            this.soundManager.playGunshot(false);
        }
    }

    takeDamage(amount, isHeadshot = false, shooterName = null) {
        this.health -= amount;

        // Show damage feedback
        if (shooterName) {
            console.log(`Took ${amount} damage from ${shooterName}`);
        }

        const healthFill = document.getElementById('health-fill');
        const healthValue = document.getElementById('health-value');
        if (healthFill) healthFill.style.width = `${(this.health / this.maxHealth) * 100}%`;
        if (healthValue) healthValue.innerText = Math.max(0, Math.round(this.health));

        if (this.health <= 0) {
            if (isHeadshot) {
                this.soundManager.playHeadshot();
            }
            this.die();
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        const healthFill = document.getElementById('health-fill');
        const healthValue = document.getElementById('health-value');
        healthFill.style.width = `${(this.health / this.maxHealth) * 100}%`;
        healthValue.innerText = Math.round(this.health);
    }

    die() {
        console.log('Player die() called');
        this.isDead = true;

        // iOS/Safari detection
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        // Safely unlock pointer - Safari/iOS may not support or may fail
        if (!isIOS) {
            try {
                this.controls.unlock();
                console.log('Pointer unlocked successfully');
            } catch (e) {
                console.warn('Failed to unlock pointer (non-critical):', e);
            }
        } else {
            console.log('Skipping pointer unlock on iOS');
        }

        // CRITICAL: Always dispatch event, even if unlock fails
        try {
            const event = new CustomEvent('playerDied', { detail: { score: this.finalScore || 0 } });
            window.dispatchEvent(event);
            console.log('playerDied event dispatched');
        } catch (e) {
            console.error('CRITICAL: Failed to dispatch playerDied event:', e);
            // Force fallback - directly show game over
            alert('Game Over! Score: ' + (this.finalScore || 0));
        }
    }

    setFinalScore(score) {
        this.finalScore = score;
    }

    get position() {
        return this.dummyCamera.position;
    }

    get rotation() {
        return this.dummyCamera.rotation;
    }

    getState() {
        return {
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z },
            health: this.health
        };
    }
}
