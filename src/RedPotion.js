import * as THREE from 'three';

export class RedPotion {
    constructor(scene, position, particlesManager) {
        this.scene = scene;
        this.particlesManager = particlesManager;
        this.isCollected = false;
        this.rotationSpeed = 2;
        this.bobSpeed = 3;
        this.bobAmount = 0.2;
        this.time = 0;

        // Create potion mesh (glowing red bottle)
        this.mesh = new THREE.Group();

        // Bottle body
        const bottleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8);
        const bottleMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        const bottle = new THREE.Mesh(bottleGeometry, bottleMaterial);
        bottle.position.y = 0.25;

        // Bottle cap
        const capGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
        const capMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            metalness: 0.3
        });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.y = 0.55;

        // Glow light
        this.glowLight = new THREE.PointLight(0xff0000, 1, 3);
        this.glowLight.position.y = 0.3;

        this.mesh.add(bottle);
        this.mesh.add(cap);
        this.mesh.add(this.glowLight);

        // Position at spawn location
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5; // Slightly above ground
        this.baseY = this.mesh.position.y;

        this.scene.add(this.mesh);
    }

    update(delta) {
        if (this.isCollected) return;

        this.time += delta;

        // Rotate
        this.mesh.rotation.y += this.rotationSpeed * delta;

        // Bob up and down
        this.mesh.position.y = this.baseY + Math.sin(this.time * this.bobSpeed) * this.bobAmount;

        // Pulse glow
        this.glowLight.intensity = 1 + Math.sin(this.time * 4) * 0.3;
    }

    checkCollision(playerPosition) {
        if (this.isCollected) return false;

        // Cylindrical collision check
        const dx = this.mesh.position.x - playerPosition.x;
        const dz = this.mesh.position.z - playerPosition.z;
        const distanceSq = dx * dx + dz * dz;
        const dy = Math.abs(this.mesh.position.y - playerPosition.y);

        // Check horizontal distance < 0.8 and vertical distance < 3
        return distanceSq < (0.8 * 0.8) && dy < 3;
    }

    collect() {
        this.isCollected = true;

        // Create collection particle effect
        // Create collection particle effect
        if (this.particlesManager) {
            this.particlesManager.createExplosion(this.mesh.position, 0xff0000, 20);
        }

        return 'burst';
    }

    remove() {
        this.scene.remove(this.mesh);
        this.mesh.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
