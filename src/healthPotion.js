import * as THREE from 'three';

export class HealthPotion {
    constructor(scene, position) {
        this.scene = scene;
        this.healAmount = 15;
        this.isCollected = false;
        this.rotationSpeed = 2;
        this.bobSpeed = 3;
        this.bobAmount = 0.2;
        this.time = 0;

        // Create potion mesh (glowing green bottle)
        this.mesh = new THREE.Group();

        // Bottle body
        const bottleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8);
        const bottleMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
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
        this.glowLight = new THREE.PointLight(0x00ff00, 1, 3);
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

        const distance = this.mesh.position.distanceTo(playerPosition);
        return distance < 0.8; // Collection radius
    }

    collect() {
        this.isCollected = true;

        // Create collection particle effect
        const particleCount = 20;
        const particles = new THREE.Group();

        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            particle.position.copy(this.mesh.position);
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 3,
                (Math.random() - 0.5) * 3
            );

            particles.add(particle);
        }

        this.scene.add(particles);

        // Animate particles
        let particleTime = 0;
        const animateParticles = () => {
            particleTime += 0.016;

            particles.children.forEach(particle => {
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016));
                particle.userData.velocity.y -= 9.8 * 0.016;
                particle.material.opacity = Math.max(0, 1 - particleTime * 2);
            });

            if (particleTime < 0.5) {
                requestAnimationFrame(animateParticles);
            } else {
                this.scene.remove(particles);
                particles.children.forEach(p => {
                    p.geometry.dispose();
                    p.material.dispose();
                });
            }
        };
        animateParticles();

        return this.healAmount;
    }

    remove() {
        this.scene.remove(this.mesh);
        this.mesh.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
