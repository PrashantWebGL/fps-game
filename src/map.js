import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBrickTexture, createFloorTexture } from './textures.js';
import { HouseMap } from './HouseMap.js';
import { CityMap } from './CityMap.js';

export class GameMap {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.floor = null;
        this.mapObjects = []; // Track objects to remove on clear
        this.treePositions = []; // Track tree positions for spawns
        this.cars = []; // Track cars
        this.civilians = []; // Track civilians
        this.adGames = []; // Cache for dynamic ads
        this.adScreens = []; // Track screen meshes for dynamic updates
        this.fetchGameMonetizeAds();
        this.startAdCycle();
    }

    async fetchGameMonetizeAds() {
        try {
            const response = await fetch('https://gamemonetize.com/feed.php?format=0');
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                this.adGames = data;
                console.log('GameMonetize ads loaded:', this.adGames.length);

                // Immediately show ads on all registered screens once feed is loaded
                this.updateAllAdBanners();
            }
        } catch (e) {
            console.warn('Could not fetch dynamic GameMonetize ads:', e);
            // Retry after 5 seconds if failed
            setTimeout(() => this.fetchGameMonetizeAds(), 5000);
        }
    }

    updateAllAdBanners() {
        if (this.adGames.length === 0) return;

        console.log(`Updating ${this.adScreens.length} ad banners with fresh content...`);
        this.adScreens.forEach((screenPair, index) => {
            // Stagger the loading slightly to avoid hitting the network all at once
            setTimeout(() => {
                this.loadRealTimeAd(screenPair.front, screenPair.back);
            }, index * 200);
        });
    }

    startAdCycle() {
        // Refresh one random billboard every 60 seconds (more frequent)
        setInterval(() => {
            if (this.adGames.length > 0 && this.adScreens.length > 0) {
                const screenPair = this.adScreens[Math.floor(Math.random() * this.adScreens.length)];
                this.loadRealTimeAd(screenPair.front, screenPair.back);
            }
        }, 60000); // 1 minute
    }

    clear() {
        // Remove tracked objects
        this.mapObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        this.mapObjects = [];
        this.walls = [];
        this.treePositions = []; // Clear tree positions
        this.cars = [];
        this.civilians = [];
        this.floor = null;
    }

    // Original procedural map
    createHouseLevel() {
        HouseMap.create(this);
    }

    createCityLevel() {
        CityMap.create(this);
    }

    create() {
        // Default entry point
        this.createHouseLevel();
    }

    // --- SHARED HELPERS ---

    createSky() {
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        this.mapObjects.push(sky);
    }

    createFloor(color) {
        let floorMaterial;
        if (color) {
            floorMaterial = new THREE.MeshStandardMaterial({ color: color });
        } else {
            const floorTexture = createFloorTexture();
            floorTexture.repeat.set(20, 20);
            floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
        }

        const floorGeometry = new THREE.PlaneGeometry(250, 250);
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        this.mapObjects.push(this.floor);
    }

    createTree(x, z) {
        const tree = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        tree.add(trunk);
        this.walls.push(trunk);

        // Leaves
        const leavesGeo = new THREE.ConeGeometry(3, 6, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 5;
        leaves.castShadow = true;
        tree.add(leaves);
        this.walls.push(leaves);

        tree.position.set(x, 0, z);
        this.scene.add(tree);
        this.mapObjects.push(tree);
        this.treePositions.push(new THREE.Vector3(x, 0, z)); // Track position
    }

    createAdBanner(x, y, z, ry = 0, useAd = true) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = ry;

        // Frame (TV/Projector style)
        const frameGeo = new THREE.BoxGeometry(8, 4.5, 0.5);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.castShadow = true;
        group.add(frame);

        // Load texture - try ad first, fallback to logo
        const textureLoader = new THREE.TextureLoader();
        let bannerTexture;
        let isAdTexture = false;

        if (useAd) {
            try {
                bannerTexture = this.createGameMonetizeTexture();
                isAdTexture = true;

                // Try to load a real dynamic ad if available
                this.loadRealTimeAd(screen, backScreen);
            } catch (e) {
                console.warn('Failed to create game texture:', e);
                useAd = false;
            }
        }

        // Fallback to logo if ad not used or failed
        if (!useAd || !bannerTexture) {
            bannerTexture = textureLoader.load('/assets/logo/1536*1024.png');
            isAdTexture = false;
        }

        const screenGeo = new THREE.PlaneGeometry(7.6, 4.1);
        const screenMat = new THREE.MeshBasicMaterial({
            map: bannerTexture,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.z = 0.26; // Slightly in front of frame
        screen.userData = {
            type: 'ad-banner',
            originalMap: bannerTexture,
            isAdBanner: isAdTexture,
            logoTexture: textureLoader.load('/assets/logo/1536*1024.png') // Pre-load logo for fallback
        };
        group.add(screen);

        // Back Screen (share the same material for consistency)
        const backScreen = new THREE.Mesh(screenGeo, screenMat);
        backScreen.position.z = -0.26;
        backScreen.rotation.y = Math.PI;
        backScreen.userData = {
            type: 'ad-banner',
            originalMap: bannerTexture,
            isAdBanner: isAdTexture,
            logoTexture: screen.userData.logoTexture
        };
        group.add(backScreen);

        this.scene.add(group);
        this.mapObjects.push(group);

        // Track for dynamic updates
        this.adScreens.push({ front: screen, back: backScreen });

        // Add screens as walls/collidables
        this.walls.push(screen);
        this.walls.push(backScreen); // Enable hit detection on both sides
        this.walls.push(frame);
    }

    createGameMonetizeTexture() {
        // Create canvas for GameMonetize-style promo
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Background (GameMonetize dark blue)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pattern
        ctx.strokeStyle = '#22c55e'; // Green
        ctx.lineWidth = 10;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PLAY MORE', canvas.width / 2, canvas.height / 2 - 60);

        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 120px Arial';
        ctx.fillText('GAMES', canvas.width / 2, canvas.height / 2 + 60);

        // GameMonetize reference
        ctx.fillStyle = '#94a3b8';
        ctx.font = '40px Arial';
        ctx.fillText('gamemonetize.com', canvas.width / 2, canvas.height - 80);

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    async loadRealTimeAd(screen, backScreen) {
        // Don't overwrite if the billboard is currently showing the leaderboard
        if (screen && screen.userData.isShowingLeaderboard) return;
        if (backScreen && backScreen.userData.isShowingLeaderboard) return;

        // Wait a bit to ensure ads have time to fetch
        if (this.adGames.length === 0) {
            let attempts = 0;
            while (this.adGames.length === 0 && attempts < 10) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
        }

        if (this.adGames.length > 0) {
            const randomGame = this.adGames[Math.floor(Math.random() * this.adGames.length)];

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // Draw thumbnail
                ctx.drawImage(img, 0, 0, 1024, 512);

                // Add dark overlay at bottom for text readability
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(0, 400, 1024, 112);

                // Add Game Title
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(randomGame.title.toUpperCase(), 512, 445);

                // Add "PLAY NOW" label
                ctx.fillStyle = '#22c55e'; // GameMonetize Green
                ctx.font = 'bold 32px Arial';
                ctx.fillText('🎮 PLAY NOW', 512, 485);

                // Create and apply texture
                const texture = new THREE.CanvasTexture(canvas);
                screen.material.map = texture;
                screen.material.needsUpdate = true;

                // Store URL for click redirection
                screen.userData.adUrl = randomGame.url;

                if (backScreen) {
                    backScreen.material.map = texture;
                    backScreen.material.needsUpdate = true;
                    // Store URL for back screen too
                    backScreen.userData.adUrl = randomGame.url;
                }
                console.log('Real-time ad applied:', randomGame.title);
            };
            img.onerror = () => {
                console.warn('Failed to load ad image:', randomGame.thumb);
            };
            img.src = randomGame.thumb;
        }
    }

    createCityBoundary(gridSize, height = 50, textureUrl = null) {
        // Create large invisible-ish walls at the edges
        const limit = gridSize + 10; // e.g. 110
        // const height = 50; // Removed, using param
        const thickness = 5;

        let boundaryMat;
        if (textureUrl) {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(textureUrl);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;

            // Adjust repeat based on wall size (approximate)
            // Width is limit * 2.2, Height is height
            texture.repeat.set((limit * 2.2) / 10, height / 10);

            boundaryMat = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.DoubleSide
            });
        } else {
            boundaryMat = new THREE.MeshStandardMaterial({
                color: 0x111111,
                transparent: false,
            });
        }

        const walls = [
            { pos: [0, height / 2, -limit], dim: [limit * 2.2, height, thickness] }, // North
            { pos: [0, height / 2, limit], dim: [limit * 2.2, height, thickness] },  // South
            { pos: [-limit, height / 2, 0], dim: [thickness, height, limit * 2.2] }, // West
            { pos: [limit, height / 2, 0], dim: [thickness, height, limit * 2.2] }   // East
        ];

        walls.forEach((w, index) => {
            // Rotate texture for side walls to match orientation if needed
            // With BoxGeometry UVs, standard mapping usually works, but check aspect ratio

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.dim), boundaryMat);
            mesh.position.set(...w.pos);
            this.scene.add(mesh);
            this.walls.push(mesh);
            this.mapObjects.push(mesh);
        });
    }

    update(delta, player, enemies) {
        // --- Move Cars ---
        const limit = 100;
        this.cars.forEach(car => {
            // Check for braking (Player or Enemies in front)
            const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.mesh.rotation.y);
            const carPos = car.mesh.position;
            let shouldStop = false;

            // Check Player
            if (player) {
                const vecToPlayer = new THREE.Vector3().subVectors(player.dummyCamera.position, carPos);
                const dist = vecToPlayer.length();
                if (dist < 15) {
                    vecToPlayer.normalize();
                    const dot = front.dot(vecToPlayer);
                    if (dot > 0.8) shouldStop = true;
                }
            }

            // Check Enemies
            if (enemies && !shouldStop) {
                for (let enemy of enemies) {
                    if (enemy.isDead) continue;
                    const vecToEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, carPos);
                    const dist = vecToEnemy.length();
                    if (dist < 15) {
                        vecToEnemy.normalize();
                        const dot = front.dot(vecToEnemy);
                        if (dot > 0.8) {
                            shouldStop = true;
                            break;
                        }
                    }
                }
            }

            if (shouldStop) {
                car.speed = Math.max(0, car.speed - delta * 30); // Brake
            } else {
                car.speed = Math.min(car.maxSpeed, car.speed + delta * 20); // Accelerate
            }

            // Move
            if (car.axis === 'x') {
                car.mesh.position.x += car.speed * car.dir * delta;
                if (car.mesh.position.x > limit) car.mesh.position.x = -limit;
                if (car.mesh.position.x < -limit) car.mesh.position.x = limit;
            } else {
                car.mesh.position.z += car.speed * car.dir * delta;
                if (car.mesh.position.z > limit) car.mesh.position.z = -limit;
                if (car.mesh.position.z < -limit) car.mesh.position.z = limit;
            }
        });

        // --- Move Civilians ---
        this.updateCivilians(delta);
    }

    updateCivilians(delta) {
        this.civilians.forEach(civ => {
            if (civ.waitTime > 0) {
                civ.waitTime -= delta;
                return;
            }

            const dist = civ.mesh.position.distanceTo(civ.target);
            if (dist < 1) {
                // Pick new target ON ROAD
                civ.waitTime = Math.random() * 2;

                const possibleLines = [-100, -60, -20, 20, 60, 100];
                const isXLine = Math.random() > 0.5;
                let tx, tz;

                if (isXLine) {
                    tz = possibleLines[Math.floor(Math.random() * possibleLines.length)];
                    tx = (Math.random() * 200) - 100;
                } else {
                    tx = possibleLines[Math.floor(Math.random() * possibleLines.length)];
                    tz = (Math.random() * 200) - 100;
                }

                civ.target.set(tx, 0, tz);
                civ.mesh.lookAt(civ.target.x, civ.mesh.position.y, civ.target.z);
            } else {
                const dir = new THREE.Vector3().subVectors(civ.target, civ.mesh.position).normalize();
                civ.mesh.position.add(dir.multiplyScalar(civ.speed * delta));
            }
        });
    }
}
