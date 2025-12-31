import * as THREE from 'three';
import { Enemy } from './enemy.js';
import { createSoldierModel } from './soldierModel.js';

export class BossEnemy extends Enemy {
    constructor(scene, playerPosition, soundManager) {
        super(scene, playerPosition, soundManager);

        // Boss-specific properties
        this.isBoss = true;
        this.health = 400; // 4x normal health
        this.maxHealth = 400;
        this.speed = 7.5; // 1.5x faster
        this.shootInterval = 1.5; // Shoots more frequently

        // Remove the normal enemy mesh
        this.scene.remove(this.mesh);

        // Create bigger, scarier boss model
        this.mesh = createSoldierModel(0x8B00BB); // Dark purple/maroon

        // Make boss thinner and taller (scary/disturbed look)
        this.mesh.scale.set(1, 1.2, 1);
        this.speed = 2; // Faster

        // Position boss
        const angle = Math.random() * Math.PI * 2;
        const radius = 25 + Math.random() * 10;
        this.mesh.position.set(
            playerPosition.x + Math.cos(angle) * radius,
            0,
            playerPosition.z + Math.sin(angle) * radius
        );

        this.scene.add(this.mesh);

        // Make head specifically smaller
        if (this.mesh.userData.parts && this.mesh.userData.parts.head) {
            this.mesh.userData.parts.head.scale.set(0.5, 0.5, 0.5);
        }

        // Update parts references for the new mesh
        const parts = this.mesh.userData.parts;
        this.parts = parts;
        this.head = parts.head;
        this.torso = parts.body;
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.gun = parts.gun;

        // Add scary glowing red eyes
        this.addGlowingEyes();

        // Add red aura effect
        this.addAuraEffect();

        // Bullet dodging system
        this.dodgeCooldown = 0;
        this.dodgeDuration = 0;
        this.dodgeDirection = new THREE.Vector3();
    }

    addGlowingEyes() {
        // Create glowing red eyes on the head
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            emissive: 0xFF0000,
            emissiveIntensity: 2
        });

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.15, 0.15, 0.35);
        this.head.add(leftEye);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.15, 0.15, 0.35);
        this.head.add(rightEye);

        this.eyes = [leftEye, rightEye];
    }

    addAuraEffect() {
        // Create red particle aura around boss
        const auraGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });

        this.aura = new THREE.Mesh(auraGeometry, auraMaterial);
        this.mesh.add(this.aura);

        // Pulsing animation will be in update
        this.auraPulse = 0;
    }

    update(delta, playerPosition, bullets, walls) {
        if (this.isDead) return;

        // Update aura pulsing effect
        if (this.aura && !this.isBroken) {
            this.auraPulse += delta * 3;
            const scale = 1 + Math.sin(this.auraPulse) * 0.1;
            this.aura.scale.set(scale, scale, scale);
            this.aura.material.opacity = 0.1 + Math.sin(this.auraPulse) * 0.05;

            // Erratic/Scary movement: more intense jitter
            if (this.torso) {
                this.torso.rotation.x = Math.sin(this.auraPulse * 15) * 0.1;
                this.torso.rotation.z = Math.cos(this.auraPulse * 12) * 0.1;
            }
        }

        // Pulsing eyes
        if (this.eyes && !this.isBroken) {
            const intensity = 1.5 + Math.sin(this.auraPulse * 2) * 0.5;
            this.eyes.forEach(eye => {
                eye.material.emissiveIntensity = intensity;
            });
        }

        // Bullet dodging AI
        this.updateDodging(delta, bullets, playerPosition);

        // Call parent update
        super.update(delta, playerPosition, bullets, walls);
    }

    updateDodging(delta, bullets, playerPosition) {
        // Update dodge cooldown
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= delta;
        }

        // If currently dodging, apply dodge movement
        if (this.dodgeDuration > 0) {
            this.dodgeDuration -= delta;
            this.mesh.position.add(this.dodgeDirection.clone().multiplyScalar(delta * 10));
            return;
        }

        // Check for incoming bullets
        if (this.dodgeCooldown <= 0 && bullets && bullets.length > 0) {
            for (const bullet of bullets) {
                if (bullet.owner === 'player' && !bullet.isDead) {
                    const distanceToBullet = bullet.position.distanceTo(this.mesh.position);

                    // If bullet is close and coming towards us
                    if (distanceToBullet < 8) {
                        const bulletDirection = bullet.velocity.clone().normalize();
                        const toBoss = new THREE.Vector3()
                            .subVectors(this.mesh.position, bullet.position)
                            .normalize();

                        // Check if bullet is heading towards boss
                        const dotProduct = bulletDirection.dot(toBoss);

                        if (dotProduct > 0.7) { // Bullet is coming at us
                            // 30% chance to dodge
                            if (Math.random() < 0.3) {
                                this.dodge(bulletDirection);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    dodge(bulletDirection) {
        // Calculate perpendicular dodge direction
        const perpendicular = new THREE.Vector3()
            .crossVectors(bulletDirection, new THREE.Vector3(0, 1, 0))
            .normalize();

        // Randomly choose left or right
        if (Math.random() < 0.5) {
            perpendicular.negate();
        }

        this.dodgeDirection.copy(perpendicular);
        this.dodgeDuration = 0.3; // Dodge for 0.3 seconds
        this.dodgeCooldown = 2.0; // 2 second cooldown

        // Visual feedback - quick strafe animation
        if (this.torso) {
            this.torso.rotation.z = perpendicular.x > 0 ? 0.3 : -0.3;
            setTimeout(() => {
                if (this.torso && !this.isBroken) {
                    this.torso.rotation.z = 0;
                }
            }, 300);
        }
    }

    takeDamage(amount, bulletVelocity, partName) {
        // Boss takes normal damage calculations
        let multiplier = 1.0;
        if (partName === 'head') multiplier = 2.0;
        else if (partName === 'torso' || partName === 'body') multiplier = 1.0;
        else multiplier = 0.68;

        const finalDamage = amount * multiplier;
        this.health -= finalDamage;

        console.log(`BOSS Hit ${partName}! Damage: ${finalDamage}, Health: ${this.health}/${this.maxHealth}`);

        // Flash effect
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

        // Make eyes flash brighter when hit
        if (this.eyes && !this.isBroken) {
            this.eyes.forEach(eye => {
                eye.material.emissiveIntensity = 3;
            });
            setTimeout(() => {
                if (this.eyes && !this.isBroken) {
                    this.eyes.forEach(eye => {
                        eye.material.emissiveIntensity = 2;
                    });
                }
            }, 150);
        }

        if (this.health <= 0 && !this.isBroken) {
            this.breakApart(bulletVelocity);
        }
    }

    breakApart(impulse) {
        // Remove and dispose aura before breaking apart
        if (this.aura) {
            this.mesh.remove(this.aura);
            if (this.aura.geometry) this.aura.geometry.dispose();
            if (this.aura.material) this.aura.material.dispose();
            this.aura = null;
        }

        // Remove and dispose eyes
        if (this.eyes) {
            this.eyes.forEach(eye => {
                if (eye.parent) eye.parent.remove(eye);
                if (eye.geometry) eye.geometry.dispose();
                if (eye.material) eye.material.dispose();
            });
            this.eyes = null;
        }

        // Call parent breakApart
        super.breakApart(impulse);
    }
}
