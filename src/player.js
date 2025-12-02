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
        this.isDead = false;

        // Movement
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 10;
        this.jumpVelocity = 8;
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
                    if (this.canJump === true) this.velocity.y += 15; // Jump force
                    this.canJump = false;
                    break;
                case 'Digit3':
                    this.isThirdPerson = !this.isThirdPerson;
                    this.playerModel.visible = this.isThirdPerson;
                    // Hide weapon in 3rd person? Or keep it?
                    // Weapon is attached to camera, so it will float back with camera.
                    // Ideally we should attach weapon to player model in 3rd person.
                    // For now, let's just hide the FPS weapon in 3rd person.
                    this.weapon.mesh.visible = !this.isThirdPerson;
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

        // Calculate Movement Direction in World Space
        // Inverted logic to fix controls
        // Combine with touch input
        const touchMove = this.touchControls.moveVector;
        this.direction.z = Number(this.moveBackward) - Number(this.moveForward) + touchMove.y;
        this.direction.x = Number(this.moveLeft) - Number(this.moveRight) + touchMove.x;
        this.direction.normalize();

        // Apply Touch Look
        const lookDelta = this.touchControls.getLookDelta();
        if (lookDelta.x !== 0 || lookDelta.y !== 0) {
            // Apply pitch to dummyCamera so it matches PC behavior (PointerLockControls)
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
        if (this.moveForward || this.moveBackward) {
            this.velocity.add(forward.multiplyScalar(this.direction.z * 100.0 * delta));
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.add(right.multiplyScalar(this.direction.x * 100.0 * delta));
        }

        // Apply Velocity & Collision (Separate Axes)
        const oldPos = this.dummyCamera.position.clone();

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

        // Vertical Collision (Landing on walls)
        if (this.velocity.y < 0) { // Only check when falling
            const feetY = this.dummyCamera.position.y - 2.0;

            // Check if we are intersecting a wall *below* us
            // We can reuse checkWallCollision but we need to know *which* wall and its height.

            // Let's do a specific check for landing
            this.hitbox.position.copy(this.dummyCamera.position);
            this.hitbox.position.y -= 1;
            const playerBox = new THREE.Box3().setFromObject(this.hitbox);

            for (const wall of walls) {
                const wallBox = new THREE.Box3().setFromObject(wall);
                // Check if we are horizontally within the wall's bounds
                // We can check intersection of the projected boxes on XZ plane
                const playerRect = { minX: playerBox.min.x, maxX: playerBox.max.x, minZ: playerBox.min.z, maxZ: playerBox.max.z };
                const wallRect = { minX: wallBox.min.x, maxX: wallBox.max.x, minZ: wallBox.min.z, maxZ: wallBox.max.z };

                const overlapX = playerRect.minX < wallRect.maxX && playerRect.maxX > wallRect.minX;
                const overlapZ = playerRect.minZ < wallRect.maxZ && playerRect.maxZ > wallRect.minZ;

                if (overlapX && overlapZ) {
                    // We are above/inside this wall column.
                    // Check vertical relationship.
                    // If feet are close to wall top and we are falling...
                    if (feetY >= wallBox.max.y - 0.5 && feetY <= wallBox.max.y + 0.5) {
                        // Landed!
                        this.velocity.y = 0;
                        this.dummyCamera.position.y = wallBox.max.y + 2.0;
                        this.canJump = true;

                        // Footstep Audio (Land)
                        if (this.velocity.y < -5) this.soundManager.playFootstep(); // Hard landing
                    }
                }
            }
        }

        // Floor collision
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
            // Over-the-shoulder view: offset to the right and back (increased distance)
            // This allows the crosshair to align better with where bullets go
            const offset = new THREE.Vector3(2.5, 1.8, 8); // Right, Up, Back (increased right from 1.2 to 2.5)
            offset.applyQuaternion(this.dummyCamera.quaternion);
            this.camera.position.copy(this.dummyCamera.position).add(offset);

            // Look further ahead of the player for better aiming
            const lookTarget = this.dummyCamera.position.clone();
            const forward = new THREE.Vector3(0, 0, -6); // Look further ahead (increased from -3 to -6)
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

    checkWallCollision(walls) {
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
            // If our feet are above the wall top, it's not a collision, it's a floor (handled in update)
            if (feetY >= wallBox.max.y - 0.1) continue;

            if (playerBox.intersectsBox(wallBox)) {
                return true;
            }
        }
        return false;
    }

    shoot(bullets) {
        if (this.isDead) return;
        this.weapon.shoot(bullets, 'player');
        this.soundManager.playGunshot(false);
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
        this.isDead = true;
        this.controls.unlock();
        // Trigger game over event that main.js will handle
        const event = new CustomEvent('playerDied', { detail: { score: this.finalScore || 0 } });
        window.dispatchEvent(event);
    }

    setFinalScore(score) {
        this.finalScore = score;
    }

    get position() {
        return this.dummyCamera.position;
    }
}
