import * as THREE from 'three';

export function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Professional mortar with texture
    const mortarGradient = ctx.createLinearGradient(0, 0, 512, 512);
    mortarGradient.addColorStop(0, '#6a6a6a');
    mortarGradient.addColorStop(0.5, '#777777');
    mortarGradient.addColorStop(1, '#6a6a6a');
    ctx.fillStyle = mortarGradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add detailed mortar texture
    for (let i = 0; i < 8000; i++) {
        const alpha = Math.random() * 0.15;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 3, Math.random() * 3);
    }

    // Bricks with professional details
    const brickWidth = 60;
    const brickHeight = 30;
    const gap = 4;

    for (let y = 0; y < 512; y += brickHeight + gap) {
        const offset = (Math.floor(y / (brickHeight + gap)) % 2) * (brickWidth / 2);
        for (let x = -brickWidth; x < 512; x += brickWidth + gap) {
            // Varied brick colors (realistic terracotta/clay)
            const baseR = 135 + Math.random() * 50;
            const baseG = 55 + Math.random() * 25;
            const baseB = 45 + Math.random() * 20;

            // Create gradient for each brick (depth)
            const brickGradient = ctx.createLinearGradient(x + offset, y, x + offset, y + brickHeight);
            brickGradient.addColorStop(0, `rgb(${baseR + 15}, ${baseG + 10}, ${baseB + 5})`);
            brickGradient.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
            brickGradient.addColorStop(1, `rgb(${baseR - 20}, ${baseG - 10}, ${baseB - 5})`);

            ctx.fillStyle = brickGradient;
            ctx.fillRect(x + offset, y, brickWidth, brickHeight);

            // Detailed weathering and texture
            for (let k = 0; k < 30; k++) {
                const wx = x + offset + Math.random() * brickWidth;
                const wy = y + Math.random() * brickHeight;
                const wSize = Math.random() * 8 + 2;
                ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
                ctx.fillRect(wx, wy, wSize, Math.random() * 4);
            }

            // Cracks in bricks
            if (Math.random() > 0.7) {
                ctx.strokeStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.3})`;
                ctx.lineWidth = 0.5 + Math.random();
                ctx.beginPath();
                const crackStartX = x + offset + Math.random() * brickWidth;
                const crackStartY = y + Math.random() * brickHeight;
                ctx.moveTo(crackStartX, crackStartY);
                ctx.lineTo(crackStartX + (Math.random() - 0.5) * 20, crackStartY + (Math.random() - 0.5) * 15);
                ctx.stroke();
            }

            // Moss/weathering spots (green tint)
            if (Math.random() > 0.6) {
                const mossX = x + offset + Math.random() * brickWidth;
                const mossY = y + Math.random() * brickHeight;
                const mossSize = Math.random() * 12 + 5;
                const mossGradient = ctx.createRadialGradient(mossX, mossY, 0, mossX, mossY, mossSize);
                mossGradient.addColorStop(0, 'rgba(60, 90, 50, 0.3)');
                mossGradient.addColorStop(1, 'rgba(60, 90, 50, 0)');
                ctx.fillStyle = mossGradient;
                ctx.beginPath();
                ctx.arc(mossX, mossY, mossSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Enhanced 3D effect - highlights and shadows
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(x + offset, y, brickWidth, 3);

            // Left highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + offset, y, 2, brickHeight);

            // Bottom shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x + offset, y + brickHeight - 3, brickWidth, 3);

            // Right shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + offset + brickWidth - 2, y, 2, brickHeight);

            // Subtle inner shadow for depth
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(x + offset + 3, y + 3, brickWidth - 6, brickHeight - 6);
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

    // Rich jungle grass base with multiple green tones
    const baseColors = ['#2d5016', '#3a5a1f', '#4a6b2a', '#2a4a15'];
    ctx.fillStyle = baseColors[0];
    ctx.fillRect(0, 0, 512, 512);

    // Create organic grass texture with multiple layers
    // Layer 1: Dark undergrowth
    for (let i = 0; i < 30000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 2 + 0.5;
        ctx.fillStyle = baseColors[Math.floor(Math.random() * baseColors.length)];
        ctx.globalAlpha = 0.4 + Math.random() * 0.3;
        ctx.fillRect(x, y, size, size);
    }

    // Layer 2: Individual grass blades (short strokes)
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const length = Math.random() * 4 + 2;
        const angle = Math.random() * Math.PI * 2;

        // Grass blade colors - vibrant jungle greens
        const grassColors = ['#4CAF50', '#66BB6A', '#81C784', '#558B2F', '#689F38'];
        ctx.strokeStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
        ctx.lineWidth = 0.5 + Math.random() * 0.5;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
    }

    // Layer 3: Clumps of grass (denser areas)
    for (let i = 0; i < 200; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const clumpSize = Math.random() * 15 + 10;

        for (let j = 0; j < 30; j++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * clumpSize;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            const length = Math.random() * 5 + 3;

            ctx.strokeStyle = `rgba(${100 + Math.random() * 50}, ${150 + Math.random() * 50}, ${60 + Math.random() * 30}, 0.7)`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
        }
    }

    // Layer 4: Dirt patches and jungle floor variation
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 40 + 15;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(90, 65, 40, 0.6)'); // Brown dirt
        gradient.addColorStop(0.5, 'rgba(70, 50, 30, 0.4)');
        gradient.addColorStop(1, 'rgba(70, 50, 30, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Layer 5: Highlights and depth (lighter grass tips)
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = '#A5D6A7'; // Light green highlights
        ctx.fillRect(x, y, 1, 1);
    }

    // Layer 6: Small stones and debris
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 3 + 1;
        ctx.fillStyle = `rgba(${120 + Math.random() * 40}, ${110 + Math.random() * 30}, ${100 + Math.random() * 20}, 0.8)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
