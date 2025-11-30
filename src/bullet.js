import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction, owner) {
        this.scene = scene;
        this.velocity = direction.normalize().multiplyScalar(50); // Speed
        this.owner = owner; // 'player' or 'enemy'
        this.isDead = false;
        this.life = 2.0; // 2 seconds life

        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: owner === 'player' ? 0xffff00 : 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);

        // Store previous position for raycasting
        this.previousPosition = position.clone();

        this.scene.add(this.mesh);
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isDead = true;
            return;
        }

        // Update previous position before moving
        this.previousPosition.copy(this.mesh.position);

        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.mesh.updateMatrixWorld(true);
    }

    checkCollision(targetMesh) {
        // Use Raycasting for accurate high-speed collision
        const direction = new THREE.Vector3().subVectors(this.mesh.position, this.previousPosition);
        const distance = direction.length();

        if (distance === 0) return false;

        direction.normalize();

        const raycaster = new THREE.Raycaster(this.previousPosition, direction, 0.01, distance);

        // Check intersection with the target mesh
        // Note: targetMesh might be a Group (like the gun), so we need recursive check if possible,
        // but intersectObject with recursive=true handles that.
        // However, main.js passes specific parts (Meshes) usually.
        // If targetMesh is a Group, we should use recursive=true.
        const intersects = raycaster.intersectObject(targetMesh, true);

        if (intersects.length > 0) {
            return intersects[0]; // Return the closest intersection
        }
        return null;
    }

    remove() {
        this.scene.remove(this.mesh);
    }

    get position() {
        return this.mesh.position;
    }
}
