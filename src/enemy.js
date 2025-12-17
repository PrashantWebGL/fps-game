import * as THREE from 'three';
import { Bullet } from './bullet.js';
import { createSoldierModel } from './soldierModel.js';

export class Enemy {
    constructor(scene, playerPosition, soundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.isDead = false;
        this.health = 100;
        this.speed = 3;

        // Use the same soldier model as player, but with red uniform
        this.mesh = createSoldierModel(0x8b0000); // Dark red for enemy

        // Spawn Position
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 10;
        this.mesh.position.set(
            playerPosition.x + Math.cos(angle) * radius,
            0, // On ground
            playerPosition.z + Math.sin(angle) * radius
        );

        this.scene.add(this.mesh);

        // Store parts for collision (from userData)
        const parts = this.mesh.userData.parts;
        console.log('Enemy parts:', parts); // Debug logging
        this.parts = parts;

        // Assign parts to this for animation and breakApart
        this.head = parts.head;
        this.torso = parts.body; // Map body to torso
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.gun = parts.gun;

        // Recoil
        this.baseRightArmRotX = -Math.PI / 2; // Starting aim position
        this.recoilOffset = 0;

        this.shootTimer = 0;
        this.shootInterval = 2.0;
        this.walkCycle = 0;
        this.distanceTraveled = 0;
        this.stepInterval = 2.5;

        this.velocity = new THREE.Vector3();
        this.isBroken = false;
        this.deathTimer = 0;
        this.debris = []; // For dismembered parts
    }

    update(delta, playerPosition, bullets, walls) {
        if (this.isDead) return;

        if (this.isBroken) {
            this.updateDebris(delta, walls);
            this.deathTimer += delta;
            if (this.deathTimer > 3.0) {
                this.isDead = true;
                this.cleanupDebris();
            }
            return;
        }

        // Look at player
        this.mesh.lookAt(playerPosition.x, 0, playerPosition.z);

        // Move towards player if far away
        const distance = this.mesh.position.distanceTo(playerPosition);
        let isMoving = false;

        if (distance > 10) {
            const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
            direction.y = 0; // Keep on ground

            // Candidate Position
            const moveVec = direction.multiplyScalar(this.speed * delta);
            const candidatePos = this.mesh.position.clone().add(moveVec);

            // Move (No Wall Collision as requested)
            this.mesh.position.add(moveVec);
            isMoving = true;


            // Footsteps
            this.distanceTraveled += this.speed * delta;
            if (this.distanceTraveled > this.stepInterval) {
                // Volume based on distance to player
                const vol = Math.max(0, 1 - distance / 30) * 0.5;
                if (vol > 0.01) this.soundManager.playFootstep(vol);
                this.distanceTraveled = 0;
            }
        }

        // Animation
        if (isMoving) {
            this.walkCycle += delta * 10; // Speed of animation

            // Swing Legs
            this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.5;
            this.rightLeg.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.5;

            // Swing Arms
            this.leftArm.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.5;
            this.rightArm.rotation.x = Math.sin(this.walkCycle) * 0.5;
            // Keep gun pointing somewhat forward even while swinging
            // Recoil Logic: lerp recoilOffset back to 0
            this.recoilOffset = this.recoilOffset + (0 - this.recoilOffset) * (delta * 10);

            // Apply base rotation + swing + recoil
            // When stopped (else block), we set it to baseRightArmRotX (-PI/2).
            // Here we are moving, but we want the gun to mostly point forward.
            // Let's rely on the update loop for 'isMoving' to set legs/arms, but apply recoil on top.
            // Actually, simplified: always point gun at player, but add recoil kick.

            // BUT existing logic separates Moving vs Stopped arm rotation.
            // Let's modify:
            const swing = Math.sin(this.walkCycle) * 0.5;
            this.rightArm.rotation.x = Math.max(swing, -0.2);
            // The above line in original code forces arm forward-ish while running.
            // Let's add recoil to it? 
            // If running, they might not be aiming perfectly.
            this.rightArm.rotation.x -= this.recoilOffset;

        } else {
            // Reset Pose
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = this.baseRightArmRotX - this.recoilOffset; // Point gun at player when stopped + Recoil
        }

        // Jump & Dodge Logic
        if (isMoving && !this.isBroken) {
            // Random Jump
            if (Math.random() < 0.005 && this.mesh.position.y <= 0.1) { // 0.5% chance per frame
                this.velocity.y = 8; // Jump!
            }

            // Random Dodge (Strafe)
            if (Math.random() < 0.01) { // 1% chance per frame
                const strafeDir = new THREE.Vector3().crossVectors(
                    new THREE.Vector3(0, 1, 0),
                    new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize()
                ).normalize();

                if (Math.random() < 0.5) strafeDir.negate();

                this.velocity.x += strafeDir.x * 5; // Impulse
                this.velocity.z += strafeDir.z * 5;
            }
        }

        // Apply Physics (Gravity & Velocity)
        this.velocity.y -= 9.8 * delta;
        this.mesh.position.y += this.velocity.y * delta;
        this.mesh.position.x += this.velocity.x * delta;
        this.mesh.position.z += this.velocity.z * delta;

        // Friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;

        // Floor Collision
        // The soldier model origin is at the feet (y=0), so checking < 0 is correct.
        // However, if they are sinking, maybe the origin is slightly off or physics is pushing too hard.
        // Let's ensure they stay strictly above 0.
        if (this.mesh.position.y < 0) {
            this.mesh.position.y = 0;
            this.velocity.y = 0;
        }

        // Shoot logic
        this.shootTimer += delta;

        // Simple Line of Sight check
        let hasLineOfSight = true;
        // ... (raycast logic if needed)

        // Force update matrix world for accurate collision detection in this frame
        this.mesh.updateMatrixWorld(true);

        const directionToPlayer = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
        const raycaster = new THREE.Raycaster(new THREE.Vector3(this.mesh.position.x, 1.5, this.mesh.position.z), directionToPlayer, 0, distance);

        if (walls) {
            const intersects = raycaster.intersectObjects(walls);
            if (intersects.length > 0) {
                hasLineOfSight = false;
            }
        }

        if (this.shootTimer >= this.shootInterval && distance < 20 && hasLineOfSight) {
            this.shoot(bullets, playerPosition);
            this.shootTimer = 0;
        }
    }

    shoot(bullets, targetPos) {
        const bulletPos = new THREE.Vector3();
        this.gun.getWorldPosition(bulletPos);

        const direction = new THREE.Vector3().subVectors(targetPos, bulletPos).normalize();
        // Add some inaccuracy
        direction.x += (Math.random() - 0.5) * 0.1;
        direction.y += (Math.random() - 0.5) * 0.1;
        direction.z += (Math.random() - 0.5) * 0.1;

        const bullet = new Bullet(this.scene, bulletPos, direction, 'enemy');
        bullets.push(bullet);

        // Sound
        const distance = this.mesh.position.distanceTo(targetPos);
        const vol = Math.max(0, 1 - distance / 50);
        if (vol > 0.01) this.soundManager.playGunshot(true);

        // Apply Recoil
        this.recoilOffset = 0.5; // Kick back (up)

    }

    takeDamage(amount, bulletVelocity, partName) {
        let multiplier = 1.0;
        if (partName === 'head') multiplier = 2.0; // Instant kill (2 * 50 = 100)
        else if (partName === 'torso' || partName === 'body') multiplier = 1.0; // Normal (1 * 50 = 50, 2 shots)
        else multiplier = 0.68; // Limbs (0.68 * 50 = 34, 3 shots)

        const finalDamage = amount * multiplier;
        this.health -= finalDamage;

        console.log(`Hit ${partName}! Damage: ${finalDamage}, Health: ${this.health}`);

        // Flash white
        // Flash white
        const flashPart = (object, colorHex) => {
            if (object.isMesh && object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.emissive.setHex(colorHex));
                } else {
                    object.material.emissive.setHex(colorHex);
                }
            } else if (object.isGroup || object.type === 'Group') {
                object.children.forEach(child => flashPart(child, colorHex));
            }
        };

        if (this.parts[partName]) {
            flashPart(this.parts[partName], 0xffffff);
            setTimeout(() => {
                if (!this.isDead && !this.isBroken && this.parts[partName]) {
                    flashPart(this.parts[partName], 0x000000);
                }
            }, 100);
        }

        if (this.health <= 0 && !this.isBroken) {
            this.breakApart(bulletVelocity);
        }
    }

    breakApart(impulse) {
        this.isBroken = true;
        this.deathTimer = 0;
        this.debris = [];

        // Detach all parts and add to scene
        const parts = [this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.gun];

        parts.forEach(part => {
            if (!part) return;

            // Use scene.attach to detach from parent and attach to scene
            // while maintaining world transform
            this.scene.attach(part);

            this.debris.push({
                mesh: part,
                velocity: impulse.clone().multiplyScalar(0.5).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    Math.random() * 5,
                    (Math.random() - 0.5) * 5
                )),
                rotVel: new THREE.Vector3(
                    Math.random() * 5,
                    Math.random() * 5,
                    Math.random() * 5
                )
            });
        });

        // Hide original mesh (container) - parts are already detached
        this.mesh.visible = false;
    }

    updateDebris(delta, walls) {
        this.debris.forEach(d => {
            // Gravity
            d.velocity.y -= 9.8 * delta;

            // Move
            d.mesh.position.add(d.velocity.clone().multiplyScalar(delta));

            // Rotate
            d.mesh.rotation.x += d.rotVel.x * delta;
            d.mesh.rotation.y += d.rotVel.y * delta;
            d.mesh.rotation.z += d.rotVel.z * delta;

            // Floor Collision
            if (d.mesh.position.y < 0.2) { // Approx half height of small parts
                d.mesh.position.y = 0.2;
                d.velocity.y *= -0.5; // Bounce
                d.velocity.x *= 0.8; // Friction
                d.velocity.z *= 0.8;
            }

            // Wall Collision
            if (walls) {
                const debrisBox = new THREE.Box3().setFromObject(d.mesh);
                for (const wall of walls) {
                    const wallBox = new THREE.Box3().setFromObject(wall);
                    if (debrisBox.intersectsBox(wallBox)) {
                        // Simple bounce: reverse velocity
                        d.velocity.x *= -0.8;
                        d.velocity.z *= -0.8;

                        // Push out slightly to avoid sticking (simple hack)
                        const direction = d.velocity.clone().normalize();
                        d.mesh.position.add(direction.multiplyScalar(delta * 2));
                    }
                }
            }
        });
    }

    cleanupDebris() {
        this.debris.forEach(d => {
            this.scene.remove(d.mesh);

            // Safely dispose of resources (handle both Mesh and Group)
            d.mesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        });
        this.debris = [];
    }

    remove() {
        this.scene.remove(this.mesh);
        this.cleanupDebris(); // Ensure debris is cleaned up if enemy is removed before death timer
    }
}
