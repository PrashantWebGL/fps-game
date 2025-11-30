import * as THREE from 'three';
import { createBrickTexture, createFloorTexture } from './textures.js';

export class GameMap {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.floor = null;
    }

    create() {
        this.createSky();
        this.createFloor();
        this.createForest();
        this.createWalls();
        this.createHouse(30, -30); // Place house
        this.createCemetery(-30, 30); // Place cemetery
    }

    createSky() {
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }

    createFloor() {
        const floorTexture = createFloorTexture();
        floorTexture.repeat.set(20, 20);
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
    }

    createForest() {
        for (let i = 0; i < 50; i++) {
            const angle = (i / 50) * Math.PI * 2;
            const radius = 45 + Math.random() * 5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.createTree(x, z);
        }
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
        this.walls.push(trunk); // Add to collision

        // Leaves
        const leavesGeo = new THREE.ConeGeometry(3, 6, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 5;
        leaves.castShadow = true;
        tree.add(leaves);
        this.walls.push(leaves); // Add to collision

        tree.position.set(x, 0, z);
        this.scene.add(tree);
    }

    createWalls() {
        const brickTexture = createBrickTexture();
        brickTexture.repeat.set(0.5, 0.5);
        const wallMat = new THREE.MeshStandardMaterial({ map: brickTexture });

        const wallPositions = [
            { x: 0, z: -20, r: 0, h: 5 },
            { x: 0, z: 20, r: 0, h: 5 },
            { x: -20, z: 0, r: Math.PI / 2, h: 5 },
            { x: 20, z: 0, r: Math.PI / 2, h: 5 },
            // Inner walls - varied heights for parkour
            { x: -10, z: -10, r: 0, h: 2.5 }, // Jumpable
            { x: 10, z: 10, r: 0, h: 2.5 },   // Jumpable
            { x: -10, z: 10, r: Math.PI / 2, h: 5 },
            { x: 10, z: -10, r: Math.PI / 2, h: 5 },
            // Extra parkour blocks
            { x: 0, z: 0, r: 0, h: 2 },
            { x: 5, z: 5, r: 0, h: 3 },
            { x: -5, z: -5, r: 0, h: 1.5 }
        ];

        wallPositions.forEach(pos => {
            const height = pos.h || 5;
            const wallGeo = new THREE.BoxGeometry(10, height, 1);
            // Adjust texture repeat based on height if needed, but 0.5 is fine for now

            const wall = new THREE.Mesh(wallGeo, wallMat);
            wall.position.set(pos.x, height / 2, pos.z);
            wall.rotation.y = pos.r;
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.walls.push(wall);
        });
    }

    createHouse(x, z) {
        const houseGroup = new THREE.Group();
        houseGroup.position.set(x, 0, z);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown wood
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x800000 }); // Dark red roof

        // Walls (Box with hole? Or 3 walls + door frame?)
        // Let's do 3 full walls and 1 wall with door
        const wallHeight = 4;
        const wallWidth = 6;
        const wallThick = 0.5;

        // Back Wall
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, wallThick), wallMat);
        backWall.position.set(0, wallHeight / 2, -wallWidth / 2);
        houseGroup.add(backWall);
        this.walls.push(backWall); // Add to collision

        // Left Wall
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, wallWidth), wallMat);
        leftWall.position.set(-wallWidth / 2, wallHeight / 2, 0);
        houseGroup.add(leftWall);
        this.walls.push(leftWall);

        // Right Wall
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, wallWidth), wallMat);
        rightWall.position.set(wallWidth / 2, wallHeight / 2, 0);
        houseGroup.add(rightWall);
        this.walls.push(rightWall);

        // Front Wall (Left part)
        const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(2, wallHeight, wallThick), wallMat);
        frontLeft.position.set(-2, wallHeight / 2, wallWidth / 2);
        houseGroup.add(frontLeft);
        this.walls.push(frontLeft);

        // Front Wall (Right part)
        const frontRight = new THREE.Mesh(new THREE.BoxGeometry(2, wallHeight, wallThick), wallMat);
        frontRight.position.set(2, wallHeight / 2, wallWidth / 2);
        houseGroup.add(frontRight);
        this.walls.push(frontRight);

        // Front Wall (Top part above door)
        const frontTop = new THREE.Mesh(new THREE.BoxGeometry(2, 1, wallThick), wallMat);
        frontTop.position.set(0, wallHeight - 0.5, wallWidth / 2);
        houseGroup.add(frontTop);
        this.walls.push(frontTop);

        // Roof (Pyramid)
        const roofGeo = new THREE.ConeGeometry(5, 3, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = wallHeight + 1.5;
        roof.rotation.y = Math.PI / 4; // Align corners
        houseGroup.add(roof);

        this.scene.add(houseGroup);

        // We need to add the house walls to the main walls array, but they are inside a group.
        // The collision logic in main.js/player.js expects world position walls.
        // Since houseGroup is at (x,0,z), the local positions are relative.
        // To make collision work simply, we should add the meshes directly to scene or update collision logic.
        // For now, let's just add them to scene and position them manually without a group to keep collision simple.
        // Re-doing without group for simplicity in collision array.

        this.scene.remove(houseGroup); // Remove the group approach

        // Helper to add wall
        const addWall = (w, h, d, px, py, pz) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            mesh.position.set(x + px, py, z + pz);
            this.scene.add(mesh);
            this.walls.push(mesh);
        };

        addWall(wallWidth, wallHeight, wallThick, 0, wallHeight / 2, -wallWidth / 2); // Back
        addWall(wallThick, wallHeight, wallWidth, -wallWidth / 2, wallHeight / 2, 0); // Left
        addWall(wallThick, wallHeight, wallWidth, wallWidth / 2, wallHeight / 2, 0); // Right
        addWall(2, wallHeight, wallThick, -2, wallHeight / 2, wallWidth / 2); // Front Left
        addWall(2, wallHeight, wallThick, 2, wallHeight / 2, wallWidth / 2); // Front Right
        addWall(2, 1, wallThick, 0, wallHeight - 0.5, wallWidth / 2); // Front Top

        // Roof
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.set(x, wallHeight + 1.5, z);
        roofMesh.rotation.y = Math.PI / 4;
        this.scene.add(roofMesh);
        this.walls.push(roofMesh); // Add to collision
    }

    createCemetery(x, z) {
        // Fence
        const fenceMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const postGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);

        const size = 10;
        const posts = 8;

        for (let i = 0; i < posts; i++) {
            // Top side
            const post1 = new THREE.Mesh(postGeo, fenceMat);
            post1.position.set(x - size / 2 + (i * size / posts), 0.75, z - size / 2);
            this.scene.add(post1);
            this.walls.push(post1);

            // Bottom side
            const post2 = new THREE.Mesh(postGeo, fenceMat);
            post2.position.set(x - size / 2 + (i * size / posts), 0.75, z + size / 2);
            this.scene.add(post2);
            this.walls.push(post2);

            // Left side
            const post3 = new THREE.Mesh(postGeo, fenceMat);
            post3.position.set(x - size / 2, 0.75, z - size / 2 + (i * size / posts));
            this.scene.add(post3);
            this.walls.push(post3);

            // Right side
            const post4 = new THREE.Mesh(postGeo, fenceMat);
            post4.position.set(x + size / 2, 0.75, z - size / 2 + (i * size / posts));
            this.scene.add(post4);
            this.walls.push(post4);
        }

        // Tombstones
        const stoneGeo = new THREE.BoxGeometry(0.6, 0.8, 0.2);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

        for (let i = 0; i < 5; i++) {
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            const tx = x + (Math.random() - 0.5) * 8;
            const tz = z + (Math.random() - 0.5) * 8;
            stone.position.set(tx, 0.4, tz);
            stone.rotation.y = (Math.random() - 0.5) * 0.5; // Slight tilt
            this.scene.add(stone);
            this.walls.push(stone);
        }
    }
}
