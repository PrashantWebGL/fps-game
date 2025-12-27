import * as THREE from 'three';
import { createBrickTexture } from './textures.js';

export class HouseMap {
    static create(gameMap) {
        // Access gameMap properties directly
        const scene = gameMap.scene;

        gameMap.createSky();
        gameMap.createFloor();
        // gameMap.createForest(); // Removed/Commented out
        HouseMap.createBoundary(gameMap);
        HouseMap.createWalls(gameMap);
        HouseMap.createHouse(gameMap, 30, -30);
        HouseMap.createCemetery(gameMap, -30, 30);
        HouseMap.createAdBanners(gameMap); // Add Banners
        gameMap.createCityBoundary(50, 10, '/assets/textures/housefence.jpg'); // Size 50, Height 10, Fence Texture
    }

    static createBoundary(gameMap) {
        // Generate Forest Boundary
        for (let i = 0; i < 48; i++) {
            const angle = (i / 50) * Math.PI * 2;
            const radius = 45 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            gameMap.createTree(x, z);
        }
    }

    static createWalls(gameMap) {
        const brickTexture = createBrickTexture();
        brickTexture.repeat.set(0.5, 0.5);
        const wallMat = new THREE.MeshStandardMaterial({ map: brickTexture });

        const wallPositions = [
            { x: 0, z: -20, r: 0, h: 5 },
            { x: 0, z: 20, r: 0, h: 5 },
            { x: -20, z: 0, r: Math.PI / 2, h: 5 },
            { x: 20, z: 0, r: Math.PI / 2, h: 5 },
            { x: -10, z: -10, r: 0, h: 2.5 },
            { x: 10, z: 10, r: 0, h: 2.5 },
            { x: -10, z: 10, r: Math.PI / 2, h: 5 },
            { x: 10, z: -10, r: Math.PI / 2, h: 5 },
            { x: 0, z: 0, r: 0, h: 2 },
            { x: 5, z: 5, r: 0, h: 3 },
            { x: -5, z: -5, r: 0, h: 1.5 }
        ];

        wallPositions.forEach(pos => {
            const height = pos.h || 5;
            const wallGeo = new THREE.BoxGeometry(10, height, 1);
            const wall = new THREE.Mesh(wallGeo, wallMat);
            wall.position.set(pos.x, height / 2, pos.z);
            wall.rotation.y = pos.r;
            wall.castShadow = true;
            wall.receiveShadow = true;
            gameMap.scene.add(wall);
            gameMap.walls.push(wall);
            gameMap.mapObjects.push(wall);
        });
    }

    static createHouse(gameMap, x, z) {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x800000 });
        const wallHeight = 4;
        const wallWidth = 6;
        const wallThick = 0.5;
        const roofGeo = new THREE.ConeGeometry(5, 3, 4);

        const addWall = (w, h, d, px, py, pz) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            mesh.position.set(x + px, py, z + pz);
            gameMap.scene.add(mesh);
            gameMap.walls.push(mesh);
            gameMap.mapObjects.push(mesh);
        };

        addWall(wallWidth, wallHeight, wallThick, 0, wallHeight / 2, -wallWidth / 2);
        addWall(wallThick, wallHeight, wallWidth, -wallWidth / 2, wallHeight / 2, 0);
        addWall(wallThick, wallHeight, wallWidth, wallWidth / 2, wallHeight / 2, 0);
        addWall(2, wallHeight, wallThick, -2, wallHeight / 2, wallWidth / 2);
        addWall(2, wallHeight, wallThick, 2, wallHeight / 2, wallWidth / 2);
        addWall(2, 1, wallThick, 0, wallHeight - 0.5, wallWidth / 2);

        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.set(x, wallHeight + 1.5, z);
        roofMesh.rotation.y = Math.PI / 4;
        gameMap.scene.add(roofMesh);
        gameMap.walls.push(roofMesh);
        gameMap.mapObjects.push(roofMesh);
    }

    static createCemetery(gameMap, x, z) {
        const fenceMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const postGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
        const stoneGeo = new THREE.BoxGeometry(0.6, 0.8, 0.2);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

        const size = 10;
        const posts = 8;

        for (let i = 0; i < posts; i++) {
            const offsets = [
                [x - size / 2 + i * size / posts, 0.75, z - size / 2],
                [x - size / 2 + i * size / posts, 0.75, z + size / 2],
                [x - size / 2, 0.75, z - size / 2 + i * size / posts],
                [x + size / 2, 0.75, z - size / 2 + i * size / posts]
            ];

            offsets.forEach(pos => {
                const mesh = new THREE.Mesh(postGeo, fenceMat);
                mesh.position.set(...pos);
                gameMap.scene.add(mesh);
                gameMap.walls.push(mesh);
                gameMap.mapObjects.push(mesh);
            });
        }

        for (let i = 0; i < 5; i++) {
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            stone.position.set(x + (Math.random() - 0.5) * 8, 0.4, z + (Math.random() - 0.5) * 8);
            stone.rotation.y = (Math.random() - 0.5) * 0.5;
            gameMap.scene.add(stone);
            gameMap.walls.push(stone);
            gameMap.mapObjects.push(stone);
        }
    }

    static createAdBanners(gameMap) {
        // 4 Ad Banners (TVs/Projectors)
        // 1. Near spawn (facing player)
        gameMap.createAdBanner(0, 9.5, -15, 0);

        // 2. Near House (side)
        gameMap.createAdBanner(35, 9.5, -30, -Math.PI / 2);

        // 3. Near Cemetery (side)
        gameMap.createAdBanner(-35, 9.5, 30, Math.PI / 2);

        // 4. Random spot (behind spawn)
        gameMap.createAdBanner(15, 9.5, 15, Math.PI);
    }
}
