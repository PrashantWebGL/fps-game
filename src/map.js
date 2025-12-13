import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Can remove if not used, but leaving for now doesn't hurt



import { createBrickTexture, createFloorTexture } from './textures.js';

export class GameMap {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.floor = null;
        this.mapObjects = []; // Track objects to remove on clear
        this.treePositions = []; // Track tree positions for spawns
        this.cars = []; // Track cars
        this.civilians = []; // Track civilians




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
        this.floor = null; // Floor is usually part of mapObjects

        // Note: We don't clear lights or sky here, they are global in main.js (except sky which creates here)
        // Wait, current createSky acts on scene. We should track sky too if we want to change it.
        // For now, let's keep sky persistent or check if we spawned it.
    }

    // Original procedural map
    createHouseLevel() {
        this.createSky();
        this.createFloor();
        // this.createForest(); // Removed as per user request (boundary only)
        this.createBoundary(); // Add boundary trees
        this.createWalls();
        this.createHouse(30, -30); // Place house
        this.createCemetery(-30, 30); // Place cemetery
        this.createCityBoundary(50); // Add solid boundary walls (size 50)
    }

    // ... create() and loadJungle() ...

    // --- Helper Methods (Modified to track objects) ---

    // ... createSky, createFloor ...

    createForest() {
        for (let i = 0; i < 50; i++) {
            const angle = (i / 50) * Math.PI * 2;
            const radius = 45 + Math.random() * 5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.createTree(x, z);
        }
    }

    createBoundary() {
        // Generate Forest Boundary (moved from main.js)
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

    create() {
        // Default entry point, can be alias for house level for backward compatibility
        this.createHouseLevel();
    }

    // --- CITY GENERATION ---
    createCityLevel() {
        this.createSky();
        this.createFloor(0x1a451a); // Green Grass

        // Load Building Textures
        const textureLoader = new THREE.TextureLoader();
        this.buildingTextures = [
            textureLoader.load('/assets/textures/grayBuilding.jpg'),
            textureLoader.load('/assets/textures/redBuilding.jpg'),
            textureLoader.load('/assets/textures/whiteBuilding.jpg')
        ];

        this.buildingTextures.forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
        });

        // City Grid
        const gridSize = 100;
        const streetWidth = 10;
        const blockSize = 30; // 30x30 blocks

        // Create Roads
        this.createRoads(gridSize, streetWidth, blockSize);

        // Create Buildings
        this.createBuildings(gridSize, streetWidth, blockSize);

        // Create Cars
        this.createCars(gridSize);

        // Create Civilians
        this.createCivilians(gridSize, 15);

        // Create Boundary Walls
        this.createCityBoundary(gridSize);
    }

    createRoads(gridSize, streetWidth, blockSize) {
        // Simple cross-hatch roads
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Asphalt

        // Roads along X
        for (let z = -gridSize; z <= gridSize; z += blockSize + streetWidth) {
            const roadGeo = new THREE.PlaneGeometry(gridSize * 2, streetWidth);
            const road = new THREE.Mesh(roadGeo, roadMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.05, z); // Slightly above floor
            road.receiveShadow = true;
            this.scene.add(road);
            this.mapObjects.push(road);
        }

        // Roads along Z
        for (let x = -gridSize; x <= gridSize; x += blockSize + streetWidth) {
            const roadGeo = new THREE.PlaneGeometry(streetWidth, gridSize * 2);
            const road = new THREE.Mesh(roadGeo, roadMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(x, 0.06, 0); // avoid z-fighting
            road.receiveShadow = true;
            this.scene.add(road);
            this.mapObjects.push(road);
        }
    }

    createBuildings(gridSize, streetWidth, blockSize) {
        // Fill the blocks between roads
        for (let x = -gridSize + blockSize / 2 + streetWidth / 2; x < gridSize; x += blockSize + streetWidth) {
            for (let z = -gridSize + blockSize / 2 + streetWidth / 2; z < gridSize; z += blockSize + streetWidth) {
                // Don't build on center spawn (approx)
                if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

                // Building properties
                const height = 10 + Math.random() * 40; // Skyscrapers
                const width = blockSize - 2;
                const depth = blockSize - 2;

                // Random Texture
                const texture = this.buildingTextures[Math.floor(Math.random() * this.buildingTextures.length)];
                texture.repeat.set(1, height / 10); // Adjust vertical tiling based on height

                const mat = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.5,
                    metalness: 0.1
                });

                const geo = new THREE.BoxGeometry(width, height, depth);
                const building = new THREE.Mesh(geo, mat);

                building.position.set(x, height / 2, z);
                building.castShadow = true;
                building.receiveShadow = true;

                this.scene.add(building);
                this.mapObjects.push(building);
                this.walls.push(building); // Collision

                // Add "windows" (emissive texture simulated by small cubes or just detail)
                // For performance, simple blocks are better. 
            }
        }
    }

    createCars(gridSize) {
        // Create detailed cars

        // Spawn 20 cars
        for (let i = 0; i < 20; i++) {
            const carGroup = new THREE.Group();

            // Car Body
            const color = Math.random() > 0.5 ? 0xff0000 : 0x0000ff;
            const bodyGeo = new THREE.BoxGeometry(2, 0.5, 4);
            const bodyMat = new THREE.MeshStandardMaterial({ color: color });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            body.receiveShadow = true;
            body.position.y = 0.5; // Lift up
            carGroup.add(body);

            // Car Cabin
            const cabinGeo = new THREE.BoxGeometry(1.8, 0.4, 2);
            const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Tinted glass/black
            const cabin = new THREE.Mesh(cabinGeo, cabinMat);
            cabin.position.y = 1.0;
            cabin.position.z = -0.2; // Slightly back
            cabin.castShadow = true;
            carGroup.add(cabin);

            // Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            wheelGeo.rotateZ(Math.PI / 2); // Rotate to roll

            const positions = [
                { x: -1, z: 1.2 }, { x: 1, z: 1.2 },
                { x: -1, z: -1.2 }, { x: 1, z: -1.2 }
            ];

            positions.forEach(pos => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(pos.x, 0.4, pos.z);
                carGroup.add(wheel);
            });

            // Headlights
            const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
            const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 2 });
            const lightL = new THREE.Mesh(lightGeo, lightMat);
            lightL.position.set(-0.6, 0.6, 2.0); // Front
            carGroup.add(lightL);

            const lightR = new THREE.Mesh(lightGeo, lightMat);
            lightR.position.set(0.6, 0.6, 2.0);
            carGroup.add(lightR);


            // Positioning
            const spacing = 30 + 10;
            const line = Math.floor((Math.random() * 6) - 3) * spacing;

            const isXAxis = Math.random() > 0.5;

            if (isXAxis) {
                carGroup.position.set((Math.random() * 200) - 100, 0, line);
                carGroup.rotation.y = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
            } else {
                carGroup.position.set(line, 0, (Math.random() * 200) - 100);
                carGroup.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
            }

            this.scene.add(carGroup);
            this.mapObjects.push(carGroup);

            this.cars.push({
                mesh: carGroup,
                maxSpeed: 10 + Math.random() * 10,
                speed: 0,
                axis: isXAxis ? 'x' : 'z',
                dir: carGroup.rotation.y === 0 || carGroup.rotation.y === Math.PI / 2 ? 1 : -1
            });
        }
    }

    createCivilians(gridSize, count) {
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();

            // Legs
            const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const legL = new THREE.Mesh(legGeo, legMat);
            legL.position.set(-0.2, 0.4, 0);
            const legR = new THREE.Mesh(legGeo, legMat);
            legR.position.set(0.2, 0.4, 0);
            group.add(legL);
            group.add(legR);

            // Body
            const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
            const bodyColor = Math.random() * 0xffffff;
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 1.0;
            body.castShadow = true;
            group.add(body);

            // Head
            const headGeo = new THREE.SphereGeometry(0.25);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.55;
            group.add(head);

            // Set random position (avoiding exact center spawn)
            let x = (Math.random() * gridSize * 2) - gridSize;
            let z = (Math.random() * gridSize * 2) - gridSize;

            // Reposition if too close to spawn
            if (Math.abs(x) < 5 && Math.abs(z) < 5) x += 10;

            group.position.set(x, 0, z); // Feet on ground

            this.scene.add(group);
            this.mapObjects.push(group);
            this.civilians.push({
                mesh: group,
                target: new THREE.Vector3(x, 0, z), // Initial target is self
                speed: 2 + Math.random() * 2,
                waitTime: 0
            });
        }
    }

    update(delta, player, enemies) {
        // --- Move Cars ---
        const limit = 100;
        this.cars.forEach(car => {
            // Check for braking (Player or Enemies in front)
            // Forward vector
            const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.mesh.rotation.y);
            const carPos = car.mesh.position;

            let shouldStop = false;

            // Check Player
            if (player) {
                const vecToPlayer = new THREE.Vector3().subVectors(player.dummyCamera.position, carPos);
                const dist = vecToPlayer.length();
                // Check if in front (dot product > 0.8) and close (< 15)
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

                // Rotate wheels for effect? (Simulated by existing geometry rotation if complex)
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
                civ.waitTime = Math.random() * 2; // Pause before walking

                // Grid logic: roads are at starts of -gridSize, stepping by (blockSize + streetWidth) = 40
                // Roads along Z (fixed x): -100, -60, -20, 20, 60, 100
                // Roads along X (fixed z): -100, -60, -20, 20, 60, 100

                const possibleLines = [-100, -60, -20, 20, 60, 100];


                const isXLine = Math.random() > 0.5;
                let tx, tz;

                if (isXLine) {
                    // Walk along an X-axis road (z is fixed to a line)
                    tz = possibleLines[Math.floor(Math.random() * possibleLines.length)];
                    tx = (Math.random() * 200) - 100; // Anywhere on X
                } else {
                    // Walk along a Z-axis road (x is fixed to a line)
                    tx = possibleLines[Math.floor(Math.random() * possibleLines.length)];
                    tz = (Math.random() * 200) - 100; // Anywhere on Z
                }

                civ.target.set(tx, 0, tz);

                // Rotate to face target
                civ.mesh.lookAt(civ.target.x, civ.mesh.position.y, civ.target.z);
            } else {
                // Move towards target
                const dir = new THREE.Vector3().subVectors(civ.target, civ.mesh.position).normalize();
                civ.mesh.position.add(dir.multiplyScalar(civ.speed * delta));
            }
        });
    }

    // loadJungle removed




    // --- Helper Methods (Modified to track objects) ---

    createSky() {
        // Check if sky already exists? or just add new one
        // For now simple add
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
        // Use color if provided, otherwise texture
        let floorMaterial;

        if (color) {
            floorMaterial = new THREE.MeshStandardMaterial({ color: color });
        } else {
            const floorTexture = createFloorTexture();
            floorTexture.repeat.set(20, 20);
            floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
        }

        const floorGeometry = new THREE.PlaneGeometry(250, 250); // Increased size
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        this.mapObjects.push(this.floor);
    }

    createForest() {
        // Reduced tree count by 30% (35 trees)
        // Also exclude house and cemetery areas
        for (let i = 0; i < 35; i++) {
            const angle = (i / 35) * Math.PI * 2;
            const radius = 35 + Math.random() * 10; // Slightly inner forest
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Safe Zone Check for Player Spawn (0, 0, 10)
            const distToSpawn = Math.hypot(x - 0, z - 10);
            if (distToSpawn < 5) continue;

            // Exclude House Area (30, -30) radius 15
            if (Math.hypot(x - 30, z - (-30)) < 15) continue;

            // Exclude Cemetery Area (-30, 30) radius 15
            if (Math.hypot(x - (-30), z - 30) < 15) continue;

            this.createTree(x, z);
        }
    }

    createBoundary() {
        // Outer boundary
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
            this.scene.add(wall);
            this.walls.push(wall);
            this.mapObjects.push(wall);
        });
    }

    createHouse(x, z) {
        // Simplified for safe replace - reusing logic but tracking objects
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x800000 });
        const wallHeight = 4;
        const wallWidth = 6;
        const wallThick = 0.5;
        const roofGeo = new THREE.ConeGeometry(5, 3, 4);

        const addWall = (w, h, d, px, py, pz) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            mesh.position.set(x + px, py, z + pz);
            this.scene.add(mesh);
            this.walls.push(mesh);
            this.mapObjects.push(mesh);
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
        this.scene.add(roofMesh);
        this.walls.push(roofMesh);
        this.mapObjects.push(roofMesh);
    }

    createCemetery(x, z) {
        const fenceMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const postGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
        const stoneGeo = new THREE.BoxGeometry(0.6, 0.8, 0.2);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

        const size = 10;
        const posts = 8;

        for (let i = 0; i < posts; i++) {
            // 4 sides... reusing loop logic concept for brevity in replace
            const p1 = new THREE.Mesh(postGeo, fenceMat); p1.position.set(x - size / 2 + i * size / posts, 0.75, z - size / 2); this.scene.add(p1); this.walls.push(p1); this.mapObjects.push(p1);
            const p2 = new THREE.Mesh(postGeo, fenceMat); p2.position.set(x - size / 2 + i * size / posts, 0.75, z + size / 2); this.scene.add(p2); this.walls.push(p2); this.mapObjects.push(p2);
            const p3 = new THREE.Mesh(postGeo, fenceMat); p3.position.set(x - size / 2, 0.75, z - size / 2 + i * size / posts); this.scene.add(p3); this.walls.push(p3); this.mapObjects.push(p3);
            const p4 = new THREE.Mesh(postGeo, fenceMat); p4.position.set(x + size / 2, 0.75, z - size / 2 + i * size / posts); this.scene.add(p4); this.walls.push(p4); this.mapObjects.push(p4);
        }

        for (let i = 0; i < 5; i++) {
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            stone.position.set(x + (Math.random() - 0.5) * 8, 0.4, z + (Math.random() - 0.5) * 8);
            stone.rotation.y = (Math.random() - 0.5) * 0.5;
            this.scene.add(stone);
            this.walls.push(stone);
            this.mapObjects.push(stone);
        }
    }
    createCityBoundary(gridSize) {
        // Create large invisible-ish walls at the edges
        // Grid is +/- 100. Let's put walls at +/- 110.
        const limit = 110;
        const height = 5;
        const thickness = 5;

        const boundaryMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.8
        }); // Visible for now as dark walls

        const walls = [
            { pos: [0, height / 2, -limit], dim: [limit * 2.2, height, thickness] }, // North
            { pos: [0, height / 2, limit], dim: [limit * 2.2, height, thickness] },  // South
            { pos: [-limit, height / 2, 0], dim: [thickness, height, limit * 2.2] }, // West
            { pos: [limit, height / 2, 0], dim: [thickness, height, limit * 2.2] }   // East
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.dim), boundaryMat);
            mesh.position.set(...w.pos);
            this.scene.add(mesh);
            this.walls.push(mesh); // Add to collision walls
            this.mapObjects.push(mesh);
        });
    }
}
