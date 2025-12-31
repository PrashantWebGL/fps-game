import * as THREE from 'three';

export function createSoldierModel(color = 0x4a5a3a) {
    const soldier = new THREE.Group();
    const container = new THREE.Group();
    container.position.y = 0.9; // Lift up
    soldier.add(container);

    const darkColor = 0x1a1a1a;
    const skinColor = 0xc68642; // Tan skin

    // --- TORSO ---
    const bodyGroup = new THREE.Group();

    // Chest (wider)
    const chestGeo = new THREE.BoxGeometry(0.9, 0.6, 0.5);
    const chestMat = new THREE.MeshStandardMaterial({ color: color });
    const chest = new THREE.Mesh(chestGeo, chestMat);
    chest.position.y = 0.7;
    chest.castShadow = true;
    bodyGroup.add(chest);

    // Abs/Stomach
    const absGeo = new THREE.BoxGeometry(0.75, 0.6, 0.45);
    const absMat = new THREE.MeshStandardMaterial({ color: color }); // darker?
    const abs = new THREE.Mesh(absGeo, absMat);
    abs.position.y = 0.15;
    abs.castShadow = true;
    bodyGroup.add(abs);

    container.add(bodyGroup);

    // --- HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.1;

    // Head Base
    const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.4);
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    headGroup.add(head);

    // Helmet (Scary/Tactical)
    const helmetGeo = new THREE.BoxGeometry(0.4, 0.2, 0.45);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 0.2;
    headGroup.add(helmet);

    // Eyes (Glowing Red - Scary)
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.05);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 0.05, 0.2);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08, 0.05, 0.2);
    headGroup.add(rightEye);

    container.add(headGroup);

    // --- ARMS ---
    function createArm(isLeft) {
        const armGroup = new THREE.Group();
        const xOffset = isLeft ? -0.55 : 0.55;

        // Shoulder
        const shoulderGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: color });
        const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulder.position.set(0, 0, 0);
        armGroup.add(shoulder);

        // Arm
        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const armMat = new THREE.MeshStandardMaterial({ color: color }); // Sleeves
        const armMesh = new THREE.Mesh(armGeo, armMat);
        armMesh.position.y = -0.3;
        armGroup.add(armMesh);

        // Hand
        const handGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const handMat = new THREE.MeshStandardMaterial({ color: skinColor }); // Gloves?
        const hand = new THREE.Mesh(handGeo, handMat);
        hand.position.y = -0.7;
        armGroup.add(hand);

        armGroup.position.set(xOffset, 0.9, 0);
        return armGroup;
    }

    const leftArm = createArm(true);
    container.add(leftArm);

    const rightArm = createArm(false);
    container.add(rightArm);


    // --- LEGS ---
    function createLeg(isLeft) {
        const legGroup = new THREE.Group();
        const xOffset = isLeft ? -0.25 : 0.25;

        // Thigh
        const thighGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        const thighMat = new THREE.MeshStandardMaterial({ color: 0x2e3b26 }); // Darker pants
        const thigh = new THREE.Mesh(thighGeo, thighMat);
        thigh.position.y = -0.25;
        legGroup.add(thigh);

        // Shin/Boot
        const shinGeo = new THREE.BoxGeometry(0.28, 0.5, 0.28);
        const shin = new THREE.Mesh(shinGeo, thighMat);
        shin.position.y = -0.75;
        legGroup.add(shin);

        // Boot
        const bootGeo = new THREE.BoxGeometry(0.32, 0.2, 0.4);
        const bootMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const boot = new THREE.Mesh(bootGeo, bootMat);
        boot.position.set(0, -0.95, 0.05);
        legGroup.add(boot);

        legGroup.position.set(xOffset, 0, 0);
        return legGroup;
    }

    const leftLeg = createLeg(true);
    container.add(leftLeg);

    const rightLeg = createLeg(false);
    container.add(rightLeg);

    // --- GUN ---
    const gunGroup = new THREE.Group();
    // Gun Body
    const gunBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    gunGroup.add(gunBody);

    // Barrel
    const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.5;
    gunGroup.add(barrel);

    // Magazine
    const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.3, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    mag.position.set(0, -0.2, 0.1);
    gunGroup.add(mag);

    // Position gun attached to right arm
    // Arm is rotated -90 X (Pointing Forward).
    // Y is Forward, Z is Up in this Arm space.
    // Gun Cylinder is along Z. We want Gun Z (Barrel) to align with Arm Y (Forward).
    // Rotate Gun X 90 degrees? Or -90?
    // Let's position it at the hand first (y = -0.7).

    gunGroup.position.set(0.1, -0.7, 0.05); // Near Hand

    // Rotate so Gun Z aligns with Arm Y?
    // Actually, simply rotating the gun group so it looks "forward" relative to the world
    // Arm Y is World -Z.
    // Gun Z is World Y (initially).
    // We want Gun Z to be World -Z.
    // Rotate X 90: Y->Z, Z->-Y.
    // Rotate X -90: Y->-Z, Z->Y.
    // Rotate so Gun Z aligns with Arm Y?
    // User reported PI/2 points at head.
    // User reported PI points at Sky.
    // Adding another 90 degrees -> 1.5 * PI (Forward?)
    gunGroup.rotation.x = Math.PI * 1.5;
    gunGroup.rotation.z = Math.PI * 1.5 * 2;

    rightArm.add(gunGroup); // Attach to arm for movement

    // Correct arm rotation for holding gun pointing forward
    rightArm.rotation.x = -Math.PI / 2;
    rightArm.rotation.y = 0;
    rightArm.rotation.z = -0.1;


    // Store parts
    soldier.userData.parts = {
        head: headGroup,
        body: bodyGroup,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        gun: gunGroup
    };

    return soldier;
}
