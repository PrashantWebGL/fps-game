import * as THREE from 'three';

export function createSoldierModel(color = 0x4a5a3a) {
    const soldier = new THREE.Group();
    const container = new THREE.Group();
    container.position.y = 0.8; // Lift up so feet are at y=0
    soldier.add(container);

    // Body (torso) - olive green uniform
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color }); // Olive green
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    container.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac }); // Skin tone
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.3;
    container.add(head);

    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.32, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a }); // Dark green
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 1.4;
    container.add(helmet);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.5, 0.5, 0);
    leftArm.rotation.z = 0.3;
    container.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.5, 0.5, 0);
    rightArm.rotation.z = -0.3;
    container.add(rightArm);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.15, 0.8, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, -0.4, 0);
    container.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, -0.4, 0);
    container.add(rightLeg);

    // Gun in hand
    const gunGroup = new THREE.Group();

    // Gun body
    const gunBodyGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
    gunBody.position.z = -0.3;
    gunGroup.add(gunBody);

    // Gun barrel
    const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    const barrel = new THREE.Mesh(barrelGeo, gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.6);
    gunGroup.add(barrel);

    // Position gun in front of soldier
    gunGroup.position.set(0.3, 0.6, -0.4);
    gunGroup.rotation.y = -0.2;
    container.add(gunGroup);

    // Store references for collision detection
    soldier.userData.parts = {
        head,
        body,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        gun: gunGroup
    };

    return soldier;
}
