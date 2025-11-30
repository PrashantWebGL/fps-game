import * as THREE from 'three';

export function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background (Mortar)
    ctx.fillStyle = '#777';
    ctx.fillRect(0, 0, 512, 512);

    // Add noise to mortar
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Bricks
    const brickWidth = 60;
    const brickHeight = 30;
    const gap = 4;

    for (let y = 0; y < 512; y += brickHeight + gap) {
        const offset = (Math.floor(y / (brickHeight + gap)) % 2) * (brickWidth / 2);
        for (let x = -brickWidth; x < 512; x += brickWidth + gap) {
            // Color variation (Desaturated Red/Brown)
            const r = 140 + Math.random() * 40;
            const g = 60 + Math.random() * 20;
            const b = 50 + Math.random() * 20;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

            ctx.fillRect(x + offset, y, brickWidth, brickHeight);

            // Grunge/Noise on bricks
            for (let k = 0; k < 10; k++) {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.fillRect(x + offset + Math.random() * brickWidth, y + Math.random() * brickHeight, Math.random() * 10, Math.random() * 5);
            }

            // Highlight/Shadow
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(x + offset, y, brickWidth, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x + offset, y + brickHeight - 2, brickWidth, 2);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base Ground (Dirt/Grass mix)
    ctx.fillStyle = '#3a5a40'; // Dark green base
    ctx.fillRect(0, 0, 512, 512);

    // Noise layers for organic look
    for (let i = 0; i < 50000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 3 + 1;

        // Randomly choose between dirt brown, lighter green, and dark green
        const rand = Math.random();
        if (rand < 0.3) {
            ctx.fillStyle = '#588157'; // Lighter green
        } else if (rand < 0.6) {
            ctx.fillStyle = '#344e41'; // Darker green
        } else {
            ctx.fillStyle = '#6f4e37'; // Dirt brown
        }

        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1.0;

    // Patches of dirt
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 50 + 20;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(111, 78, 55, 0.8)'); // Brown center
        gradient.addColorStop(1, 'rgba(111, 78, 55, 0)');   // Fade out

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
