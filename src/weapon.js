import * as THREE from 'three';
import { Bullet } from './bullet.js';

export class Weapon {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        // Simple Gun Model
        this.mesh = new THREE.Group();

        const barrelGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.position.set(0, 0, 0);

        const handleGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const handle = new THREE.Mesh(handleGeometry, barrelMaterial);
        handle.position.set(0, -0.1, 0.1);
        handle.rotation.x = Math.PI / 4;

        this.mesh.add(barrel);
        this.mesh.add(handle);

        // Attach to camera
        this.camera.add(this.mesh);
        this.mesh.position.set(0.3, -0.3, -0.5);

        // Muzzle Flash Light
        this.flashLight = new THREE.PointLight(0xffaa00, 0, 5);
        this.flashLight.position.set(0, 0, -0.6);
        this.mesh.add(this.flashLight);

        this.flashTimer = 0;
        this.recoilTimer = 0;
    }

    shoot(bullets, owner) {
        if (this.recoilTimer > 0) return;

        // 1. Find the target point (where the player is looking)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera); // Center of screen

        // Raycast against everything in the scene (except the player/gun itself ideally, but for now scene is fine)
        // We need to be careful not to hit the gun or player hitbox if they are in the scene.
        // Assuming scene.children contains level geometry and enemies.
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        let targetPoint = new THREE.Vector3();

        // Filter out the gun itself and player hitbox if possible, or just assume the ray starts outside them
        // The ray starts at camera position, which is inside the player capsule but above the gun.
        // Let's find the first hit that is somewhat far away or not part of the player.

        let hit = null;
        for (let i = 0; i < intersects.length; i++) {
            // Simple filter: ignore things very close (like player's own hitbox if it was visible/hittable)
            if (intersects[i].distance > 1) {
                hit = intersects[i];
                break;
            }
        }

        if (hit) {
            targetPoint.copy(hit.point);
        } else {
            // If nothing hit (sky), aim at a point far away along the camera forward vector
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            targetPoint.copy(this.camera.position).add(forward.multiplyScalar(100));
        }

        // 2. Calculate direction from Gun Muzzle to Target Point
        const bulletPos = new THREE.Vector3();
        this.mesh.getWorldPosition(bulletPos);
        bulletPos.y += 0.1; // Adjust to barrel height

        const direction = new THREE.Vector3().subVectors(targetPoint, bulletPos).normalize();

        // Create Bullet
        const bullet = new Bullet(this.scene, bulletPos, direction, owner);
        bullets.push(bullet);

        // Effects
        this.flashTimer = 0.05;
        this.recoilTimer = 0.1;
        this.mesh.position.z += 0.1; // Recoil back
    }

    update(delta) {
        // Muzzle Flash
        if (this.flashTimer > 0) {
            this.flashLight.intensity = 2;
            this.flashTimer -= delta;
        } else {
            this.flashLight.intensity = 0;
        }

        // Recoil Recovery
        if (this.recoilTimer > 0) {
            this.recoilTimer -= delta;
            // Return to original position smoothly
            this.mesh.position.z = THREE.MathUtils.lerp(this.mesh.position.z, -0.5, delta * 10);
        } else {
            this.mesh.position.z = -0.5;
        }
    }
}
