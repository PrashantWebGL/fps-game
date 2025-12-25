import * as THREE from 'three';
import { Bullet } from './bullet.js';

export class SoldierEnemy {
    constructor(scene, playerPosition, soundManager, model, animations) {
        this.scene = scene;
        this.soundManager = soundManager;

        // State flags
        this.isDead = false;   // Ready for removal
        this.isDying = false;  // Playing death sequence

        this.health = 150;
        this.speed = 3.5;

        // Container
        this.mesh = new THREE.Group();
        this.model = model;

        // Orientation Fix: Flip 180 degrees
        this.model.rotation.y = Math.PI;

        // Scale to 1.5 as requested
        this.model.scale.set(1.5, 1.5, 1.5);

        // Grounding: Ensure feet are at 0. 
        // If pivot is slightly off, we might need adjustments.
        // Usually, 0 is safe. If it was floating, maybe scale affected pivot relative to Y?
        // Let's assume 0 is correct for feet.
        this.model.position.y = 0;

        this.mesh.add(this.model);

        // Hitbox Setup - Resized for scale 1.2
        const hitboxGeo = new THREE.BoxGeometry(0.8, 2.0, 0.8);
        const hitboxMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            visible: false,
            wireframe: true
        });
        this.hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        this.hitbox.position.y = 1.0;
        this.mesh.add(this.hitbox);

        this.parts = {
            body: this.hitbox,
            head: this.hitbox
        };

        // HEAD Hitbox
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMat = new THREE.MeshBasicMaterial({ visible: false });
        this.headHitbox = new THREE.Mesh(headGeo, headMat);
        this.headHitbox.position.y = 1.9;
        this.mesh.add(this.headHitbox);
        this.parts.head = this.headHitbox;

        // Spawn Position
        const angle = Math.random() * Math.PI * 2;
        const radius = 25 + Math.random() * 10;
        this.mesh.position.set(
            playerPosition.x + Math.cos(angle) * radius,
            0,
            playerPosition.z + Math.sin(angle) * radius
        );

        this.scene.add(this.mesh);

        // Animation Mixer
        this.mixer = new THREE.AnimationMixer(this.model);
        this.animations = {};

        const animMap = {
            'Idle': ['Idle', 'idle', 'Stand', 'stand'],
            'Run': ['Run', 'run', 'Walk', 'walk'],
            'Shoot': ['Shoot', 'shoot', 'Fire', 'fire', 'Attack', 'attack'],
            'Death': ['Death', 'death', 'Die', 'die'],
            'Hit': ['Hit', 'hit', 'Damage', 'damage', 'React', 'react'],
            'Jump': ['Jump', 'jump', 'Leap', 'leap', 'Air']
        };

        animations.forEach(clip => {
            for (const [state, synonyms] of Object.entries(animMap)) {
                if (synonyms.some(s => clip.name.includes(s))) {
                    this.animations[state] = this.mixer.clipAction(clip);
                    break;
                }
            }
            this.animations[clip.name] = this.mixer.clipAction(clip);
        });

        this.state = 'Idle';
        if (this.animations['Idle']) this.animations['Idle'].play();
        else if (Object.values(this.animations)[0]) Object.values(this.animations)[0].play();

        this.shootTimer = 0;
        this.shootInterval = 1.0;
        this.distanceTraveled = 0;
        this.isHitReacting = false;
        this.isJumping = false;

        // Physics
        this.velocity = new THREE.Vector3();

        this.gunBone = null;
        this.model.traverse((child) => {
            if (child.isBone && (child.name.includes('Hand_R') || child.name.includes('RightHand'))) {
                this.gunBone = child;
            }
        });
        if (!this.gunBone) this.gunBone = this.mesh;

        // Death Rotation State
        this.targetRotationX = 0;
    }

    update(delta, playerPosition, bullets, walls) {
        if (this.isDead) return;

        if (this.isDying) {
            if (this.mixer) this.mixer.update(delta);
            this.deathTimer += delta;

            // Procedural "Topple" to lie flat
            // Rotate the entire MESH group (container) -90 degrees around X
            // Assuming pivot is at feet, this will make it fall backwards or forwards depending on init rotation
            // Since we adjust geometry rotation Y=PI inside the group, mesh.rotation is what we control.
            // We want it to fall backwards relative to where it was facing.
            // But 'lookAt' changes mesh.rotation.y. 
            // We can add a child 'tiltContainer' but too complex now.
            // Let's just rotate current mesh.rotation.x to -Math.PI/2 (falling back) or Math.PI/2 (face plant)
            // But since lookAt is active on Y, X rotation is local.

            // Smoothly rotate to lying down
            // 1.57 is ~90 deg
            if (this.mesh.rotation.x > -1.4) {
                this.mesh.rotation.x -= 2.0 * delta; // Fall speed
            }

            // Lower slightly into ground to look like "weight"
            if (this.mesh.position.y > 0.1) {
                // this.mesh.position.y -= 0.5 * delta;
            }

            if (this.deathTimer > 4.0) {
                this.isDead = true;
                this.remove();
            }
            return;
        }

        if (this.mixer) this.mixer.update(delta);

        if (this.isHitReacting) return;

        // Jump Logic
        if (this.isJumping) {
            this.velocity.y -= 15 * delta;
            this.mesh.position.y += this.velocity.y * delta;

            if (this.mesh.position.y <= 0) {
                this.mesh.position.y = 0;
                this.isJumping = false;
                this.velocity.y = 0;
                if (this.animations['Run']) this.playAnimation('Run');
            } else {
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                this.mesh.position.add(forward.multiplyScalar(this.speed * delta));
                return;
            }
        }

        // Ground Check (Safety)
        if (!this.isJumping) this.mesh.position.y = 0;

        this.mesh.lookAt(playerPosition.x, 0, playerPosition.z);

        const distance = this.mesh.position.distanceTo(playerPosition);
        let targetAction = 'Idle';

        // Pathfinding
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion).normalize();

        let avoidVector = new THREE.Vector3();
        let obstructed = false;

        if (walls) {
            const whiskerLength = 3.0;
            const rayStart = this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));

            const casterLeft = new THREE.Raycaster(rayStart, forward.clone().sub(right).normalize(), 0, whiskerLength);
            const casterRight = new THREE.Raycaster(rayStart, forward.clone().add(right).normalize(), 0, whiskerLength);

            if (casterLeft.intersectObjects(walls).length > 0) {
                avoidVector.add(right);
                obstructed = true;
            }
            if (casterRight.intersectObjects(walls).length > 0) {
                avoidVector.add(right.clone().negate());
                obstructed = true;
            }

            if (obstructed && !this.isJumping && Math.random() < 0.01) {
                this.jump();
            }
        }

        if (distance > 15) {
            let moveDir = directoryFromPlayer(playerPosition, this.mesh.position);

            if (obstructed) {
                moveDir.add(avoidVector.multiplyScalar(2.0)).normalize();
            }

            this.mesh.position.add(moveDir.multiplyScalar(this.speed * delta));
            targetAction = 'Run';

            this.distanceTraveled += this.speed * delta;
            if (this.distanceTraveled > 2.0) {
                const vol = Math.max(0, 1 - distance / 30) * 0.5;
                if (vol > 0.01) this.soundManager.playFootstep(vol);
                this.distanceTraveled = 0;
            }

            if (!this.isJumping && Math.random() < 0.002) {
                this.jump();
            }

        } else {
            targetAction = 'Idle';
        }

        if (this.state !== targetAction && !this.isShooting && this.animations[targetAction]) {
            this.playAnimation(targetAction);
            this.state = targetAction;
        }

        this.shootTimer += delta;
        let hasLineOfSight = true;

        if (distance < 40) {
            const dirToP = directoryFromPlayer(playerPosition, this.mesh.position);
            const rayOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            const raycaster = new THREE.Raycaster(rayOrigin, dirToP, 0, distance);
            if (walls) {
                const intersects = raycaster.intersectObjects(walls);
                if (intersects.length > 0) hasLineOfSight = false;
            }
        } else {
            hasLineOfSight = false;
        }

        if (this.shootTimer >= this.shootInterval && hasLineOfSight) {
            this.shoot(bullets, playerPosition);
            this.shootTimer = 0;
        }
    }

    jump() {
        if (this.isJumping) return;
        this.isJumping = true;
        this.velocity.y = 8; // Bit higher for 1.2 scale

        if (this.animations['Jump']) {
            this.playAnimation('Jump', 0.1);
            this.state = 'Jump';
        }
    }

    playAnimation(name, duration = 0.5) {
        const nextAction = this.animations[name];
        if (!nextAction) return;

        const currentAction = this.animations[this.state];
        if (currentAction && currentAction !== nextAction) {
            currentAction.fadeOut(duration);
        }

        nextAction.reset().fadeIn(duration).play();
    }

    shoot(bullets, targetPos) {
        if (this.animations['Shoot']) {
            const shoot = this.animations['Shoot'];
            shoot.reset().setLoop(THREE.LoopOnce).play();
        }

        const bulletPos = new THREE.Vector3();
        if (this.gunBone) {
            this.gunBone.getWorldPosition(bulletPos);
        } else {
            bulletPos.copy(this.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
        }

        const direction = new THREE.Vector3().subVectors(targetPos, bulletPos).normalize();
        direction.x += (Math.random() - 0.5) * 0.02;
        direction.y += (Math.random() - 0.5) * 0.02;
        direction.z += (Math.random() - 0.5) * 0.02;

        const bullet = new Bullet(this.scene, bulletPos, direction, 'enemy');
        bullets.push(bullet);

        const distance = this.mesh.position.distanceTo(targetPos);
        const vol = Math.max(0, 1 - distance / 50);
        if (vol > 0.01) this.soundManager.playGunshot(true);
    }

    takeDamage(amount, bulletVelocity, partName) {
        if (this.isDying || this.isDead) return;

        this.health -= amount;

        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    const oldEmissive = child.material.emissive ? child.material.emissive.getHex() : 0x000000;
                    if (child.material.emissive) child.material.emissive.setHex(0xffffff);
                    setTimeout(() => {
                        if (child.material && child.material.emissive) {
                            child.material.emissive.setHex(oldEmissive);
                        }
                    }, 50);
                }
            });
        }

        const recoilDir = bulletVelocity.clone().normalize().multiplyScalar(0.5);
        recoilDir.y = 0;
        this.mesh.position.add(recoilDir);

        if (this.animations['Hit']) {
            const hitAnim = this.animations['Hit'];
            hitAnim.reset().setLoop(THREE.LoopOnce).play();
            this.isHitReacting = true;
            setTimeout(() => {
                this.isHitReacting = false;
                if (this.animations[this.state]) this.animations[this.state].play();
            }, 300);
        }

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDying = true;
        this.deathTimer = 0;
        this.isJumping = false;

        this.mixer.stopAllAction();
        const deathAnim = this.animations['Death'];

        if (deathAnim) {
            deathAnim.setLoop(THREE.LoopOnce);
            deathAnim.clampWhenFinished = true;
            deathAnim.reset().play();
            // We also do manual rotation in update() to ensure flatness
        }

        this.hitbox.position.y = -100;
        this.headHitbox.position.y = -100;

        // Ensure grounded for rotation
        this.mesh.position.y = 0;
    }

    remove() {
        this.scene.remove(this.mesh);
    }
}

function directoryFromPlayer(playerPos, enemyPos) {
    return new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
}
