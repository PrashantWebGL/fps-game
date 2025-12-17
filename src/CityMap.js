import * as THREE from 'three';

export class CityMap {
    static create(gameMap) {
        gameMap.createSky();
        gameMap.createFloor(0x1a451a); // Green Grass

        // Load Building Textures
        const textureLoader = new THREE.TextureLoader();
        const buildingTextures = [
            textureLoader.load('/assets/textures/grayBuilding.jpg'),
            textureLoader.load('/assets/textures/redBuilding.jpg'),
            textureLoader.load('/assets/textures/whiteBuilding.jpg')
        ];

        buildingTextures.forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
        });

        // City Grid
        const gridSize = 100;
        const streetWidth = 10;
        const blockSize = 30; // 30x30 blocks

        CityMap.createRoads(gameMap, gridSize, streetWidth, blockSize);
        CityMap.createBuildings(gameMap, gridSize, streetWidth, blockSize, buildingTextures);
        CityMap.createCars(gameMap, gridSize);
        CityMap.createCivilians(gameMap, gridSize, 15);
        gameMap.createCityBoundary(gridSize, 10, '/assets/textures/cityouterwall.jpg');
    }

    static createRoads(gameMap, gridSize, streetWidth, blockSize) {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Asphalt

        // Roads along X
        for (let z = -gridSize; z <= gridSize; z += blockSize + streetWidth) {
            const roadGeo = new THREE.PlaneGeometry(gridSize * 2, streetWidth);
            const road = new THREE.Mesh(roadGeo, roadMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.05, z);
            road.receiveShadow = true;
            gameMap.scene.add(road);
            gameMap.mapObjects.push(road);
        }

        // Roads along Z
        for (let x = -gridSize; x <= gridSize; x += blockSize + streetWidth) {
            const roadGeo = new THREE.PlaneGeometry(streetWidth, gridSize * 2);
            const road = new THREE.Mesh(roadGeo, roadMat);
            road.rotation.x = -Math.PI / 2;
            road.position.set(x, 0.06, 0);
            road.receiveShadow = true;
            gameMap.scene.add(road);
            gameMap.mapObjects.push(road);
        }
    }

    static createBuildings(gameMap, gridSize, streetWidth, blockSize, buildingTextures) {
        for (let x = -gridSize + blockSize / 2 + streetWidth / 2; x < gridSize; x += blockSize + streetWidth) {
            for (let z = -gridSize + blockSize / 2 + streetWidth / 2; z < gridSize; z += blockSize + streetWidth) {
                // Don't build on center spawn
                if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

                const height = 10 + Math.random() * 40;
                const width = blockSize - 2;
                const depth = blockSize - 2;

                const texture = buildingTextures[Math.floor(Math.random() * buildingTextures.length)];
                texture.repeat.set(1, height / 10);

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

                gameMap.scene.add(building);
                gameMap.mapObjects.push(building);
                gameMap.walls.push(building);
            }
        }
    }

    static createCars(gameMap, gridSize) {
        for (let i = 0; i < 20; i++) {
            const carGroup = new THREE.Group();

            const color = Math.random() > 0.5 ? 0xff0000 : 0x0000ff;
            const bodyGeo = new THREE.BoxGeometry(2, 0.5, 4);
            const bodyMat = new THREE.MeshStandardMaterial({ color: color });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            body.receiveShadow = true;
            body.position.y = 0.5;
            carGroup.add(body);

            const cabinGeo = new THREE.BoxGeometry(1.8, 0.4, 2);
            const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const cabin = new THREE.Mesh(cabinGeo, cabinMat);
            cabin.position.y = 1.0;
            cabin.position.z = -0.2;
            cabin.castShadow = true;
            carGroup.add(cabin);

            const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            wheelGeo.rotateZ(Math.PI / 2);

            const positions = [
                { x: -1, z: 1.2 }, { x: 1, z: 1.2 },
                { x: -1, z: -1.2 }, { x: 1, z: -1.2 }
            ];

            positions.forEach(pos => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(pos.x, 0.4, pos.z);
                carGroup.add(wheel);
            });

            const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
            const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 2 });
            const lightL = new THREE.Mesh(lightGeo, lightMat);
            lightL.position.set(-0.6, 0.6, 2.0);
            carGroup.add(lightL);

            const lightR = new THREE.Mesh(lightGeo, lightMat);
            lightR.position.set(0.6, 0.6, 2.0);
            carGroup.add(lightR);

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

            gameMap.scene.add(carGroup);
            gameMap.mapObjects.push(carGroup);

            gameMap.cars.push({
                mesh: carGroup,
                maxSpeed: 10 + Math.random() * 10,
                speed: 0,
                axis: isXAxis ? 'x' : 'z',
                dir: carGroup.rotation.y === 0 || carGroup.rotation.y === Math.PI / 2 ? 1 : -1
            });
        }
    }

    static createCivilians(gameMap, gridSize, count) {
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();

            const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const legL = new THREE.Mesh(legGeo, legMat);
            legL.position.set(-0.2, 0.4, 0);
            const legR = new THREE.Mesh(legGeo, legMat);
            legR.position.set(0.2, 0.4, 0);
            group.add(legL);
            group.add(legR);

            const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
            const bodyColor = Math.random() * 0xffffff;
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 1.0;
            body.castShadow = true;
            group.add(body);

            const headGeo = new THREE.SphereGeometry(0.25);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.55;
            group.add(head);

            let x = (Math.random() * gridSize * 2) - gridSize;
            let z = (Math.random() * gridSize * 2) - gridSize;

            if (Math.abs(x) < 5 && Math.abs(z) < 5) x += 10;

            group.position.set(x, 0, z);

            gameMap.scene.add(group);
            gameMap.mapObjects.push(group);
            gameMap.civilians.push({
                mesh: group,
                target: new THREE.Vector3(x, 0, z),
                speed: 2 + Math.random() * 2,
                waitTime: 0
            });
        }
    }
}
