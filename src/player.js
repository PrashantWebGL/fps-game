import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Weapon } from './weapon.js';
import { createSoldierModel } from './soldierModel.js';
import { TouchControls } from './touchControls.js';

export class Player {
    constructor(camera, scene, domElement, soundManager) {
        this.camera = camera;
        this.scene = scene;
        this.scene = scene;
        this.soundManager = soundManager;

        this.maxHealth = 100;
        this.health = this.maxHealth;
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
        this.speed = 10;
        this.jumpVelocity = 15; // Set base variable to 15 just in case
        this.gravity = -20;
        this.gravity = -20;
        this.isOnGround = false;

        // Dummy Camera (for 3rd Person)
        this.dummyCamera = new THREE.Object3D();
        this.dummyCamera.position.set(0, 2, 0);
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
                // case 'Digit3':
                //     this.isThirdPerson = !this.isThirdPerson;
                //     this.playerModel.visible = this.isThirdPerson;
                //     // Hide weapon in 3rd person? Or keep it?
                //     // Weapon is attached to camera, so it will float back with camera.
                //     // Ideally we should attach weapon to player model in 3rd person.
                //     // For now, let's just hide the FPS weapon in 3rd person.
                //     this.weapon.mesh.visible = !this.isThirdPerson;
                //     break;
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

        // Keyboard input
        // Inverted logic: W (Forward) should be positive Z for our calculation if we subtract it later?
        // Let's stick to standard: W = Forward.
        // User said W moves Back.
        // Previous: moveZ = Back - Forward. (W -> -1).
        // Velocity += Forward * (-moveZ) -> Forward * 1.
        // If that moved Back, then Forward vector is Back?
        // Let's just invert the final application.

        let moveZ = Number(this.moveBackward) - Number(this.moveForward);
        let moveX = Number(this.moveLeft) - Number(this.moveRight);

        // Joystick Input
        // User said Up moves Back. Up is usually -1 Y.
        // Previous: moveZ += touchMove.y (-1).
        // So Up -> -1 -> Same as W.
        // If W moves Back, Up moves Back. Consistent.

        // User said Left moves Right.
        // Left is -1 X.
        // Previous: moveX += touchMove.x (-1).
        // Velocity += Right * moveX -> Right * -1 -> Left.
        // User said it moves Right.
        // So Right vector might be Left? Or my logic is inverted.

        // FIX: Invert the inputs to match the desired outcome.

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

        // Apply Input to Velocity
        // We need to use the magnitude of input for speed control (analog stick)
        // But for now, just binary "is moving" check or use the combined vector length?

        // Let's just use the direction vector we calculated.
        // If moveZ or moveX are non-zero, we apply velocity.

        if (moveZ !== 0 || moveX !== 0) {
            // We need to project the local move direction (moveX, moveZ) into world space
            // forward * moveZ + right * moveX
            // Note: moveZ is + for backward, - for forward. 
            // forward vector points to -Z (local). 
            // So if we want to move forward (moveZ = -1), we want positive forward vector.
            // forward.multiplyScalar(-moveZ) ? 

            // Let's stick to the standard:
            // forward is the direction we are looking.
            // if we press W (moveForward), moveZ is -1. We want to move along forward.
            // So we should add forward * 1. 
            // Wait, standard logic:
            // velocity += forward * (moveForward ? 1 : 0)

            // Let's use the calculated local direction 'this.direction' which is (x, 0, z)
            // z is forward/back, x is left/right

            // Actually, let's simplify.
            // Forward movement:
            const moveSpeed = this.speed * 10.0 * delta;

            // Forward/Back
            // If moveZ is negative (forward), we add forward vector.
            // If moveZ is positive (backward), we subtract forward vector? No, forward vector points forward.
            // We want to move along the forward vector by -moveZ amount?
            // If moveZ is -1 (forward), -(-1) = +1 * forward. Correct.
            // Fix Reversed Controls:
            // If W (moveZ = -1) moves Back, we need to invert the Z application.
            // Previous: -moveZ. (W -> 1).
            // New: +moveZ. (W -> -1).
            // If Forward vector is truly Forward, then adding Forward * -1 should move Back.
            // Wait, if W moves Back, it means we are moving in +Z direction (assuming camera looks -Z).
            // So we want to move in -Z.

            // Let's just FLIP the sign.
            // Previous: -moveZ
            // New: +moveZ

            this.velocity.add(forward.clone().multiplyScalar(moveZ * moveSpeed));

            // Fix Reversed Left/Right:
            // User said Left moves Right.
            // Left (moveX = -1).
            // Previous: +moveX. (Left -> -1).
            // If Right vector is Right, adding Right * -1 should go Left.
            // If it goes Right, then Right vector is Left? Or we need to invert.

            // Let's FLIP the sign.
            // Previous: -moveX
            // New: +moveX

            this.velocity.add(right.clone().multiplyScalar(moveX * moveSpeed));
        }

        // Apply Velocity & Collision (Separate Axes)
        const oldPos = this.dummyCamera.position.clone();

        // 0. Anti-Stuck Check (Start of frame)
        // If we are already colliding (e.g. from bad spawn or glitch), push UP until free
        // This is a "safety eject" feature
        if (this.checkWallCollision(walls)) {
            // Try pushing up by 0.5 until free, max 20 times (10 units)
            for (let i = 0; i < 20; i++) {
                this.dummyCamera.position.y += 0.5;
                if (!this.checkWallCollision(walls)) break;
            }
        }

        // 1. Move X
        this.dummyCamera.position.x += this.velocity.x * delta;
        if (this.checkWallCollision(walls)) {
            this.dummyCamera.position.x = oldPos.x;
            this.velocity.x = 0;
        }

        // 2. Move Z
        this.dummyCamera.position.z += this.velocity.z * delta;
        if (this.checkWallCollision(walls)) {
            this.dummyCamera.position.z = oldPos.z;
            this.velocity.z = 0;
        }

        // 3. Move Y
        this.dummyCamera.position.y += this.velocity.y * delta;

        // Vertical Collision
        // We reuse checkWallCollision but we need to know what we hit to snap to it
        // The current checkWallCollision just returns boolean.
        // Let's modify checkWallCollision to return the wall (or null)

        const hitWall = this.checkWallCollision(walls, true, true); // returnObject=true, isVertical=true
        if (hitWall) {
            // Revert Y
            // But we want to snap to top if falling
            if (this.velocity.y < 0) {
                // Falling -> Land
                // Snap to wall top
                const wallBox = new THREE.Box3().setFromObject(hitWall);
                this.dummyCamera.position.y = wallBox.max.y + 2.0;
                this.velocity.y = 0;
                this.canJump = true;

                // Audio
                if (this.velocity.y < -5) this.soundManager.playFootstep();
            } else {
                // Jumping -> Hit Head
                this.dummyCamera.position.y = oldPos.y;
                this.velocity.y = 0;
            }
        }

        // Floor collision (Global floor)
        if (this.dummyCamera.position.y < 2) {
            this.velocity.y = 0;
            this.dummyCamera.position.y = 2;
            this.canJump = true;

            // Footstep Audio
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
            // Over-the-shoulder view
            const offset = new THREE.Vector3(2.5, 1.8, 8);
            offset.applyQuaternion(this.dummyCamera.quaternion);
            this.camera.position.copy(this.dummyCamera.position).add(offset);

            // Look further ahead
            const lookTarget = this.dummyCamera.position.clone();
            const forward = new THREE.Vector3(0, 0, -6);
            forward.applyQuaternion(this.dummyCamera.quaternion);
            lookTarget.add(forward);
            this.camera.lookAt(lookTarget);
        } else {
            // 1st Person
            this.camera.position.copy(this.dummyCamera.position);
            this.camera.quaternion.copy(this.dummyCamera.quaternion);
        }

        // Update Weapon
        this.weapon.update(delta);
    }

    checkWallCollision(walls, returnObject = false, isVertical = false) {
        // Update hitbox to current camera position for check
        this.hitbox.position.copy(this.dummyCamera.position);
        this.hitbox.position.y -= 1;

        const playerBox = new THREE.Box3().setFromObject(this.hitbox);
        // Shrink box slightly to allow sliding/not getting stuck easily
        playerBox.expandByScalar(-0.1);

        // Feet Y position for filtering walls below us
        const feetY = this.dummyCamera.position.y - 2.0;

        for (const wall of walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);

            // Ignore walls that are short enough to step on (if we are above them)
            // But if we are falling into them (Y check), we want to detect them
            // So we only ignore if feet are CLEARLY above (+ buffer) AND we are not falling into it?
            // Ignore walls that are short enough to step on (if we are above them)
            // If our feet are above the wall top, it's not a collision, it's a floor (handled in update)
            // ONLY if this is NOT a vertical check. If checking vertical, we want to hit the floor!
            if (!isVertical && feetY >= wallBox.max.y - 0.2) continue; // Increased tolerance to prevents shake when standing on walln we are on top.

            // NOTE: During Y-check, we want to catch this.
            // During X/Z check, we want to ignore this.

            // Re-introducing logic: 
            // Collision is valid if:
            // 1. Boxes intersect
            // 2. We are not "safely above" it (walking on it)

            // If we are strictly above, IntersectBox should be false?
            // Box3.intersectsBox checks all dimensions. If Y doesn't overlap, it returns false.
            // So if we are standing ON a wall, playerBox.min.y >= wallBox.max.y. No intersection.
            // So IntersectsBox handles it?

            // However, floating point errors.
            // Also, player moves Y separately.

            if (playerBox.intersectsBox(wallBox)) {
                if (returnObject) return wall;
                return true;
            }
        }
        if (returnObject) return null;
        return false;
    }

    shoot(bullets) {
        if (this.isDead) return;

        if (this.isBurstMode) {
            // Fire 3 shots rapidly
            if (this.isBursting) return; // Prevent overlapping bursts
            this.isBursting = true;

            let shotCount = 0;
            const burstInterval = setInterval(() => {
                this.weapon.shoot(bullets, 'player');
                this.soundManager.playGunshot(false);
                shotCount++;

                if (shotCount >= 3) {
                    clearInterval(burstInterval);
                    this.isBursting = false;
                }
            }, 100); // 100ms between shots

        } else {
            this.weapon.shoot(bullets, 'player');
            this.soundManager.playGunshot(false);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        const healthFill = document.getElementById('health-fill');
        const healthValue = document.getElementById('health-value');
        healthFill.style.width = `${(this.health / this.maxHealth) * 100}%`;
        healthValue.innerText = Math.max(0, Math.round(this.health));

        if (this.health <= 0) {
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
}
