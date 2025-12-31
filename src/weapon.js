import * as THREE from 'three';
import { Bullet } from './bullet.js';

export class Weapon {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        // Container (this.mesh will be rotated to look at target)
        this.mesh = new THREE.Group();

        // Inner group to orient the model correctly (Backwards Z -> Forward Z)
        const modelGroup = new THREE.Group();
        modelGroup.rotation.y = Math.PI * 2; // Flip 180 so -Z (Model Front) becomes +Z (LookAt Front)
        this.mesh.add(modelGroup);

        const barrelGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.position.set(0, 0, 0);
        modelGroup.add(barrel);

        const handleGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const handle = new THREE.Mesh(handleGeometry, barrelMaterial);
        handle.position.set(0, -0.1, 0.1);
        handle.rotation.x = Math.PI / 4;
        modelGroup.add(handle);

        // Attach to camera
        this.camera.add(this.mesh);
        // Positioned for height 2.2 visibility
        this.mesh.position.set(0.35, -0.25, -0.4);

        // Muzzle Flash Light (Placed in parent mesh, +Z is forward now)
        this.flashLight = new THREE.PointLight(0xff0000, 0, 5);
        this.flashLight.position.set(0, 0, 0.6); // Forward is +Z
        this.mesh.add(this.flashLight);

        this.flashTimer = 0;
        this.recoilTimer = 0;
    }

    shoot(bullets, owner, onBulletCreated = null) {
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

        // Sync with multiplayer if callback provided
        if (onBulletCreated) {
            onBulletCreated(bulletPos, direction);
        }

        // Effects
        this.flashTimer = 0.05;
        this.recoilTimer = 0.1;
        this.mesh.position.z += 0.1; // Recoil back
    }

    update(delta) {
        // Dynamic Aiming: Rotate gun towards the target
        // 1. Get the current target point (similar to shoot logic but for every frame)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        // Intersect with scene for visual feedback (ignoring player/gun ideally)
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        let targetPoint = null;
        for (let i = 0; i < intersects.length; i++) {
            // Avoid hitting player capsule/gun AND avoid aiming too close (ground at feet)
            if (intersects[i].distance > 5) {
                targetPoint = intersects[i].point;
                break;
            }
        }

        if (!targetPoint) {
            // Default point far away
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            targetPoint = this.camera.position.clone().add(forward.multiplyScalar(100));
        }

        // 2. Calculate local rotation for the gun to point at target
        // The gun is a child of the camera.
        // We need the target point in the camera's local space? Or just LookAt in world space?
        // Since the gun is attached to the camera, using a simple world LookAt might fight the camera's rotation.
        // Easier: Calculate the vector from Gun World Pos to Target World Pos.

        const gunWorldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(gunWorldPos);

        // We want the gun to look at 'targetPoint'. 
        this.mesh.lookAt(targetPoint);

        // Adjustment: The gun model might be built along Z or X, so we might need to offset the rotation.
        // Our gun is built: barrel on ... well, let's revert to the simple lookAt first.
        // However, 'lookAt' works in world space. Since mesh is child of camera, loopAt will update local rotation to satisfy world constraint.
        // EXCEPT: This might result in the gun jittering if the camera moves fast.
        // A smoother approach: Slerp the rotation.

        // Muzzle Flash
        if (this.flashTimer > 0) {
            this.flashLight.intensity = 2;
            this.flashTimer -= delta;
        } else {
            this.flashLight.intensity = 0;
        }

        // Recoil Recovery
        const originalZ = -0.4; // Updated from constructor
        if (this.recoilTimer > 0) {
            this.recoilTimer -= delta;
            this.mesh.position.z = THREE.MathUtils.lerp(this.mesh.position.z, originalZ, delta * 10);
        } else {
            this.mesh.position.z = originalZ;
        }
    }
}
