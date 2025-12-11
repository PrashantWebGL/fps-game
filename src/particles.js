import * as THREE from 'three';

export class Particles {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createBlood(position, direction) {
        const particleCount = 10;
        // Create geometry and material once if not already created
        if (!this.particleGeometry) {
            this.particleGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            this.particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        }

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
            mesh.position.copy(position);

            // Random spread
            mesh.position.x += (Math.random() - 0.5) * 0.2;
            mesh.position.y += (Math.random() - 0.5) * 0.2;
            mesh.position.z += (Math.random() - 0.5) * 0.2;

            const velocity = direction.clone().multiplyScalar(-0.2); // Splash back
            velocity.x += (Math.random() - 0.5);
            velocity.y += (Math.random() - 0.5) + 1; // Upward arc
            velocity.z += (Math.random() - 0.5);

            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 1.0 // 1 second life
            });
            this.scene.add(mesh);
        }
    }

    createExplosion(position, color, count = 20) {
        // Reuse or create specialized materials
        if (!this.explosionGeometry) {
            this.explosionGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        }

        // Cache materials by color (simple cache)
        if (!this.materials) this.materials = {};
        if (!this.materials[color]) {
            this.materials[color] = new THREE.MeshBasicMaterial({ color: color });
        }

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.explosionGeometry, this.materials[color]);
            mesh.position.copy(position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 3,
                (Math.random() - 0.5) * 3
            );

            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.5 // 0.5 second life
            });
            this.scene.add(mesh);
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            p.velocity.y -= 9.8 * delta; // Gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.rotation.x += delta * 5;
            p.mesh.rotation.y += delta * 5;
        }
    }
}
