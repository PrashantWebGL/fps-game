import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction, owner) {
        this.scene = scene;
        this.velocity = direction.normalize().multiplyScalar(50); // Speed
        this.owner = owner; // 'player' or 'enemy'
        this.isDead = false;
        this.life = 2.0; // 2 seconds life

        // Create realistic bullet shape (cylinder + cone)
        const bulletGroup = new THREE.Group();

        // Bullet casing (cylinder) - brass/brown color
        const casingGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8);
        const casingMaterial = new THREE.MeshStandardMaterial({
            color: owner === 'player' ? 0xB87333 : (owner === 'remote' ? 0x008888 : 0x8B4513), // Cyan for remote
            metalness: 0.7,
            roughness: 0.3,
            emissive: owner === 'player' ? 0x3d2817 : (owner === 'remote' ? 0x004444 : 0x2d1810),
            emissiveIntensity: 0.2
        });
        const casing = new THREE.Mesh(casingGeometry, casingMaterial);
        casing.rotation.x = Math.PI / 2; // Rotate to point forward
        bulletGroup.add(casing);

        // Bullet tip (cone) - darker metallic
        const tipGeometry = new THREE.ConeGeometry(0.05, 0.1, 8);
        const tipMaterial = new THREE.MeshStandardMaterial({
            color: owner === 'player' ? 0x6B4423 : (owner === 'remote' ? 0x00AAAA : 0x4A2F1A),
            metalness: 0.8,
            roughness: 0.2,
            emissive: owner === 'player' ? 0x2d1810 : (owner === 'remote' ? 0x005555 : 0x1d0f08),
            emissiveIntensity: 0.15
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.rotation.x = Math.PI / 2; // Point forward
        tip.position.z = 0.125; // Position at front of casing
        bulletGroup.add(tip);

        // Add subtle glow trail for visibility
        const glowGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: owner === 'player' ? 0xFFAA33 : (owner === 'remote' ? 0x00FFFF : 0xFF4444),
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bulletGroup.add(glow);

        this.mesh = bulletGroup;
        this.mesh.position.copy(position);

        // Orient bullet in direction of travel
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
        this.mesh.quaternion.copy(quaternion);

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
