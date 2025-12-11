import * as THREE from 'three';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { BossEnemy } from './BossEnemy.js';
import { Bullet } from './bullet.js';
import { Particles } from './particles.js';
import { GameMap } from './map.js';
import { SoundManager } from './audio.js';
import { HealthPotion } from './healthPotion.js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { inject } from '@vercel/analytics';


// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue


const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Increased intensity
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6); // Sky color, Ground color, Intensity
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
scene.add(dirLight);

// Environment
// Skybox
const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    side: THREE.BackSide
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Trees
const treePositions = [];
function createTree(x, z) {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Leaves
    const leavesGeo = new THREE.ConeGeometry(3, 6, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);
    // Store position for spawn checks
    treePositions.push(new THREE.Vector3(x, 0, z));
}


// Generate Forest Boundary
for (let i = 0; i < 50; i++) {
    const angle = (i / 50) * Math.PI * 2;
    const radius = 45 + Math.random() * 5; // Outside the 100x100 floor (radius 50)
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    createTree(x, z);
}

// Map Generation
const gameMap = new GameMap(scene);
gameMap.create();
const walls = gameMap.walls; // Expose walls for collision

// Game State
const bullets = [];
const enemies = [];
const particles = new Particles(scene);
const soundManager = new SoundManager();

// Player
const player = new Player(camera, scene, document.body, soundManager);
scene.add(player.hitbox); // Add hitbox to scene for debugging/logic
player.dummyCamera.position.set(30, 2, -20); // Start position (Outside House)

let lastTime = performance.now();
let score = 0;
let killCount = 0;
let maxEnemies = 1;
let gameStarted = false;
const potions = [];
let bossSpawned = false; // Track if boss is currently active
let totalKills = 0; // Track total kills for boss spawn
let killsSinceBoss = 0; // Track kills since last boss spawn

const scoreEl = document.getElementById('score-value');
const instructionsEl = document.getElementById('instructions');

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Leaderboard System
let playerName = '';
let currentDifficulty = 'easy';
let localScore = 0; // Store last score for display

async function getLeaderboard() {
    if (!isSupabaseConfigured()) {
        const data = localStorage.getItem('fpsLeaderboard');
        return data ? JSON.parse(data) : [];
    }

    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching leaderboard:', error);
        // Show silent error in console, but return empty
        return [];
    }
    return data;
}

async function saveScore(name, score, difficulty) {
    if (!isSupabaseConfigured()) {
        const leaderboard = await getLeaderboard();
        leaderboard.push({
            name: name || 'Anonymous',
            score,
            difficulty: difficulty || 'easy',
            date: new Date().toISOString()
        });
        leaderboard.sort((a, b) => b.score - a.score);
        const top10 = leaderboard.slice(0, 10);
        localStorage.setItem('fpsLeaderboard', JSON.stringify(top10));
        return top10;
    }

    const { error } = await supabase
        .from('leaderboard')
        .insert([
            {
                name: name || 'Anonymous',
                score: score,
                difficulty: difficulty || 'easy'
            }
        ]);

    if (error) {
        console.error('Error saving score:', error);
        alert(`Supabase Error: ${error.message}\n\nHint: Check your Table RLS Polices! Did you disable RLS or add a policy for Anon Key?`);
    }

    return await getLeaderboard();
}

async function showLeaderboard(currentScore) {
    // If not configued, show local warning
    let warningHTML = '';
    if (!isSupabaseConfigured()) {
        warningHTML = '<div style="color: yellow; text-align: center; margin-bottom: 10px; font-size: 14px;">⚠️ Global Leaderboard Not Configured (Using Local)</div>';
    }

    // Save and fetch global
    const leaderboard = await saveScore(playerName, currentScore, currentDifficulty);

    let tableRows = '';

    if (leaderboard.length === 0) {
        tableRows = `
            <tr>
                <td colspan="4" style="color: white; font-size: 20px; padding: 30px; text-align: center;">
                    No scores yet! Be the first!
                </td>
            </tr>
        `;
    } else {
        leaderboard.forEach((entry, index) => {
            // Highlighting current player globally is tricky without Auth ID.
            // We can match by name and score, but it might highlight duplicates.
            const isCurrentPlayer = entry.name === playerName && entry.score === currentScore;
            // Or just check if index matches the one we just inserted? No, we re-fetched.

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            const rank = medal || (index + 1);
            const difficultyBadge = entry.difficulty === 'hard' ? '🔴' : entry.difficulty === 'medium' ? '🟡' : '🟢';
            const difficultyText = (entry.difficulty || 'easy').toUpperCase();

            tableRows += `
                <tr style="background: ${isCurrentPlayer ? '#ffd70044' : 'transparent'}; border-left: 4px solid ${isCurrentPlayer ? '#ffd700' : 'transparent'};">
                    <td style="color: ${isCurrentPlayer ? '#ffd700' : 'white'}; font-size: 20px; padding: 10px; text-align: center; font-weight: bold;">
                        ${rank}
                    </td>
                    <td style="color: ${isCurrentPlayer ? '#ffd700' : 'white'}; font-size: 20px; padding: 10px; font-weight: ${isCurrentPlayer ? 'bold' : 'normal'};">
                        ${entry.name}
                    </td>
                    <td style="color: white; font-size: 16px; padding: 10px; text-align: center;">
                        ${difficultyBadge} ${difficultyText}
                    </td>
                    <td style="color: #00ff88; font-size: 22px; padding: 10px; text-align: right; font-weight: bold;">
                        ${entry.score}
                    </td>
                </tr>
            `;
        });
    }

    return `
        <div style="background: #1a1a1aee; padding: 30px; border-radius: 20px; border: 3px solid #ffd700; max-width: 800px; max-height: 90vh; margin: 0 auto; display: flex; flex-direction: column;">
            <h1 style="color: #ffd700; font-size: 36px; text-align: center; margin: 0 0 10px 0;">
                🏆 LEADERBOARD 🏆
            </h1>
            ${warningHTML}
            <p style="color: white; font-size: 18px; text-align: center; margin: 5px 0 15px 0;">
                Your Score: <span style="color: #ffd700; font-size: 26px; font-weight: bold;">${currentScore}</span>
            </p>
            
            <div style="background: #00000066; padding: 15px; border-radius: 12px; border: 2px solid #ffd70066; overflow-y: auto; flex: 1;">
                <table style="width: 100%; border-collapse: collapse; color: white;">
                    <thead style="position: sticky; top: 0; background: #000000cc; z-index: 10;">
                        <tr style="border-bottom: 2px solid #ffd700;">
                            <th style="color: #ffd700; font-size: 14px; padding: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                Rank
                            </th>
                            <th style="color: #ffd700; font-size: 14px; padding: 10px; text-align: left; text-transform: uppercase; letter-spacing: 1px;">
                                Name
                            </th>
                            <th style="color: #ffd700; font-size: 14px; padding: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                Level
                            </th>
                            <th style="color: #ffd700; font-size: 14px; padding: 10px; text-align: right; text-transform: uppercase; letter-spacing: 1px;">
                                Score
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            
            <button onclick="location.reload()" style="margin-top: 20px; padding: 15px 40px; font-size: 18px; font-weight: bold; cursor: pointer; background: #00ff00; color: black; border: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 255, 0, 0.3); transition: all 0.2s;">
                🔄 PLAY AGAIN
            </button>
        </div>
    `;
}

// Mobile detection
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Get references after DOM is ready
const mobileStartEl = document.getElementById('mobile-start');

// Show mobile start overlay on small screens
function showMobileStartOverlay() {
    if (window.innerWidth <= 768) {
        mobileStartEl.style.display = 'flex';
    }
}
// Don't auto-show mobile overlay - let users see difficulty selection
// showMobileStartOverlay();

// Mobile users will use the same difficulty selection as desktop
// No need for separate "tap to play" overlay

// Difficulty Selection
function startGame(difficulty) {
    const nameInput = document.getElementById('player-name');
    playerName = nameInput.value.trim() || 'Anonymous';
    currentDifficulty = difficulty; // Store the difficulty

    console.log('Starting game with difficulty:', difficulty);
    switch (difficulty) {
        case 'easy': maxEnemies = 1; break;
        case 'medium': maxEnemies = 2; break;
        case 'hard': maxEnemies = 4; break;
    }
    gameStarted = true;
    try {
        if (!isMobile) {
            player.controls.lock();
            console.log('Pointer lock requested');
        }
    } catch (e) {
        console.error('Pointer lock failed:', e);
    }
    // Hide the instructions overlay (pause screen)
    instructionsEl.style.display = 'none';
    instructionsEl.style.visibility = 'hidden';
    instructionsEl.style.opacity = '0';
}

const nameInput = document.getElementById('player-name');
const btnEasy = document.getElementById('btn-easy');
const btnMedium = document.getElementById('btn-medium');
const btnHard = document.getElementById('btn-hard');
const buttons = [btnEasy, btnMedium, btnHard];

// Disable initially
buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
});

nameInput.addEventListener('input', (e) => {
    playerName = e.target.value;
    const isValid = playerName.length > 3;
    buttons.forEach(btn => {
        btn.disabled = !isValid;
        btn.style.opacity = isValid ? '1' : '0.5';
        btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    });
});

btnEasy.addEventListener('click', () => { if (playerName.length > 3) startGame('easy'); });
btnMedium.addEventListener('click', () => { if (playerName.length > 3) startGame('medium'); });
btnHard.addEventListener('click', () => { if (playerName.length > 3) startGame('hard'); });

// Handle player death
window.addEventListener('playerDied', async (event) => {
    console.log('Player died event triggered, score:', score);
    player.setFinalScore(score);
    const instructions = document.getElementById('instructions');
    // Show loading text while fetching async leaderboard
    instructions.innerHTML = '<h1 style="color:white; text-align:center; margin-top: 200px;">LOADING SCORES...</h1>';
    instructions.style.display = 'block';
    instructions.style.visibility = 'visible';
    instructions.style.opacity = '1';

    const leaderboardHTML = await showLeaderboard(score);
    console.log('Leaderboard HTML generated, length:', leaderboardHTML.length);
    instructions.innerHTML = leaderboardHTML;
});

document.addEventListener('click', () => {
    if (player.isDead) {
        // Don't do anything when dead - leaderboard is showing
        return;
    }

    if (gameStarted && !player.controls.isLocked) {
        player.controls.lock();
    } else if (gameStarted) {
        player.shoot(bullets);
    }
});

player.controls.addEventListener('lock', () => {
    console.log('Pointer locked');
    instructionsEl.style.display = 'none';
});

player.controls.addEventListener('unlock', () => {
    console.log('Pointer unlocked');
    if (player.isDead) {
        // Don't change anything - leaderboard is already showing
        return;
    } else {
        // Pause menu or just show instructions again? 
        // For now, let's just keep it simple, maybe show "Click to Resume"
        instructionsEl.style.display = 'block';
        instructionsEl.innerHTML = '<h1>PAUSED</h1><p>Click to Resume</p>';
    }
});

// Message Display System
function showMessage(text, duration = 2000, color = '#FFD700') {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        font-weight: bold;
        color: ${color};
        text-shadow: 0 0 20px ${color}, 0 0 40px ${color}, 0 4px 8px rgba(0,0,0,0.8);
        z-index: 9999;
        pointer-events: none;
        font-family: 'Courier New', monospace;
        animation: messagePopIn 0.3s ease-out;
        text-align: center;
        padding: 20px;
        background: rgba(0,0,0,0.7);
        border-radius: 15px;
        border: 3px solid ${color};
    `;
    messageEl.textContent = text;
    document.body.appendChild(messageEl);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes messagePopIn {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.1); }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        messageEl.style.transition = 'opacity 0.5s';
        messageEl.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(messageEl);
            document.head.removeChild(style);
        }, 500);
    }, duration);
}

// Boss Spawn Function
function spawnBoss() {
    bossSpawned = true;

    // Play boss spawn sound
    soundManager.playBossSpawn();
    soundManager.playBossAmbient();

    // Show dramatic announcement
    showMessage('⚠️ BIG BOSS INCOMING! ⚠️', 3000, '#FF0000');

    console.log('🔥 SPAWNING BIG BOSS at 15 kills!');

    // Find spawn position away from player
    let spawnPos;
    let attempts = 0;
    const minDistFromPlayer = 25; // Spawn far away for dramatic entrance

    while (attempts < 30) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 25 + Math.random() * 15;
        const x = player.dummyCamera.position.x + Math.cos(angle) * radius;
        const z = player.dummyCamera.position.z + Math.sin(angle) * radius;

        // Check distance to player
        const distToPlayer = Math.hypot(x - player.dummyCamera.position.x, z - player.dummyCamera.position.z);
        if (distToPlayer < minDistFromPlayer) { attempts++; continue; }

        // Check against trees
        let tooCloseToTree = false;
        for (const treePos of treePositions) {
            const d = Math.hypot(x - treePos.x, z - treePos.z);
            if (d < 3) { tooCloseToTree = true; break; }
        }
        if (tooCloseToTree) { attempts++; continue; }

        // Check walls
        let valid = true;
        for (const wall of walls) {
            if (new THREE.Vector3(x, 0, z).distanceTo(wall.position) < 3) { valid = false; break; }
        }
        if (valid) { spawnPos = new THREE.Vector3(x, 0, z); break; }
        attempts++;
    }

    if (spawnPos) {
        const boss = new BossEnemy(scene, player.position, soundManager);
        boss.mesh.position.set(spawnPos.x, 0, spawnPos.z);
        enemies.push(boss);
        console.log('💀 BIG BOSS SPAWNED at position:', spawnPos);
    } else {
        console.warn('Failed to find valid boss spawn position');
        // Spawn anyway at a default position
        const boss = new BossEnemy(scene, player.position, soundManager);
        enemies.push(boss);
    }
}

// Enemy Spawning
setInterval(() => {
    // Don't spawn normal enemies if boss is currently active
    if (bossSpawned) return;

    if ((player.controls.isLocked || isMobile) && enemies.length < maxEnemies) {            // Try to find a valid spawn position not inside a tree and away from player
        let spawnPos;
        let attempts = 0;
        const minDistFromPlayer = 5; // meters
        while (attempts < 20) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 10;
            const x = player.dummyCamera.position.x + Math.cos(angle) * radius;
            const z = player.dummyCamera.position.z + Math.sin(angle) * radius;

            // Check distance to player
            const distToPlayer = Math.hypot(x - player.dummyCamera.position.x, z - player.dummyCamera.position.z);
            if (distToPlayer < minDistFromPlayer) { attempts++; continue; }

            // Check against trees
            let tooCloseToTree = false;
            for (const treePos of treePositions) {
                const d = Math.hypot(x - treePos.x, z - treePos.z);
                if (d < 2) { tooCloseToTree = true; break; }
            }
            if (tooCloseToTree) { attempts++; continue; }

            // Simple wall check (existing logic)
            let valid = true;
            for (const wall of walls) {
                if (new THREE.Vector3(x, 0, z).distanceTo(wall.position) < 2) { valid = false; break; }
            }
            if (valid) { spawnPos = new THREE.Vector3(x, 0, z); break; }
            attempts++;
        }

        if (spawnPos) {
            const enemy = new Enemy(scene, player.position, soundManager);
            enemy.mesh.position.set(spawnPos.x, 0, spawnPos.z); // Override default random spawn
            enemies.push(enemy);
        }
    }
}, 2000);

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (gameStarted && (player.controls.isLocked || isMobile)) {
        player.update(delta, walls); // Pass walls for collision

        // Check for touch shooting
        if (player.touchControls.shouldShoot) {
            player.shoot(bullets);
        }

        // Update Potions
        for (let i = potions.length - 1; i >= 0; i--) {
            const potion = potions[i];
            potion.update(delta);

            // Check if player collects potion
            if (potion.checkCollision(player.dummyCamera.position)) {
                const healAmount = potion.collect();
                player.heal(healAmount);
                soundManager.playPotionCollect();
                potion.remove();
                potions.splice(i, 1);
            }
        }

        // Update Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.update(delta);

            // Remove if too old
            if (bullet.isDead) {
                bullet.remove();
                bullets.splice(i, 1);
                continue;
            }

            // Check collisions
            let closestHit = null;

            // 0. Bullet vs Walls
            for (const wall of walls) {
                const intersection = bullet.checkCollision(wall);
                if (intersection) {
                    if (!closestHit || intersection.distance < closestHit.distance) {
                        closestHit = {
                            type: 'wall',
                            distance: intersection.distance,
                            point: intersection.point,
                            object: wall
                        };
                    }
                }
            }

            // 1. Bullet vs Enemy
            if (bullet.owner === 'player') {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    // Check collision with each body part
                    for (const [partName, partMesh] of Object.entries(enemy.parts)) {
                        const intersection = bullet.checkCollision(partMesh);
                        if (intersection) {
                            if (!closestHit || intersection.distance < closestHit.distance) {
                                closestHit = {
                                    type: 'enemy',
                                    distance: intersection.distance,
                                    point: intersection.point,
                                    enemy: enemy,
                                    partName: partName,
                                    enemyIndex: j
                                };
                            }
                        }
                    }
                }
            }
            // 2. Bullet vs Player
            else if (bullet.owner === 'enemy') {
                const intersection = bullet.checkCollision(player.hitbox);
                if (intersection) {
                    if (!closestHit || intersection.distance < closestHit.distance) {
                        closestHit = {
                            type: 'player',
                            distance: intersection.distance,
                            point: intersection.point
                        };
                    }
                }
            }

            // Apply hit to closest target
            if (closestHit) {
                if (closestHit.type === 'wall') {
                    bullet.remove();
                    bullets.splice(i, 1);
                } else if (closestHit.type === 'enemy') {
                    const enemy = closestHit.enemy;

                    // Calculate damage before applying it
                    let multiplier = 1.0;
                    const partName = closestHit.partName;
                    if (partName === 'head') multiplier = 2.0;
                    else if (partName === 'torso' || partName === 'body') multiplier = 1.0;
                    else multiplier = 0.68;
                    const finalDamage = 50 * multiplier;

                    // Check if this hit will kill the enemy (BEFORE takeDamage is called)
                    const willDie = (enemy.health - finalDamage <= 0) && !enemy.isBroken;
                    const isBoss = enemy.isBoss;
                    const deathPosition = enemy.mesh.position.clone();

                    // Now apply damage
                    enemy.takeDamage(50, bullet.velocity, partName);
                    particles.createBlood(bullet.position, bullet.velocity);
                    bullet.remove();
                    bullets.splice(i, 1);

                    // If enemy just died, track the kill
                    if (willDie) {
                        console.log(`Enemy killed! isBoss: ${isBoss}`);

                        // Award points based on enemy type
                        if (isBoss) {
                            score += 500; // Boss reward
                            soundManager.playBossDown();
                            soundManager.stopBossAmbient();
                            console.log('🎉 BIG BOSS DOWN! +500 points');
                            showMessage('💀 BIG BOSS DOWN! +500 💀', 3000, '#FF0000');
                        } else {
                            score += 100; // Normal enemy
                        }
                        scoreEl.innerText = score;

                        // Increment kill count
                        killCount++;
                        totalKills++;
                        console.log(`✅ Total kills: ${totalKills}, Boss spawned: ${bossSpawned}`);

                        // If boss was killed, resume normal enemy spawning
                        if (isBoss) {
                            bossSpawned = false;
                            killsSinceBoss = 0;
                            console.log('🔓 Boss defeated! Normal enemies will resume spawning.');
                        } else {
                            killsSinceBoss++;
                        }

                        // Check if we should spawn boss (every 3 normal enemy kills)
                        if (killsSinceBoss >= 10 && !bossSpawned) {
                            console.log('🔥 TRIGGERING BOSS SPAWN!');
                            spawnBoss();
                        }

                        // Spawn health potion every 6th kill
                        if (killCount % 6 === 0) {
                            const potion = new HealthPotion(scene, deathPosition);
                            potions.push(potion);
                        }
                    }
                } else if (closestHit.type === 'player') {
                    player.takeDamage(10); // Enemy damage: 10 shots to kill
                    particles.createBlood(bullet.position, bullet.velocity);
                    bullet.remove();
                    bullets.splice(i, 1);
                }
                continue;
            }
        }

        // Update Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            enemies[i].update(delta, player.position, bullets, walls);

            // Clean up enemies that have finished their death animation (isDead = true after 3 seconds)
            if (enemies[i].isDead) {
                enemies[i].remove();
                enemies.splice(i, 1);
                // Note: Points already awarded when enemy was killed by bullet
            }
        }

        // Update Particles
        particles.update(delta);
    }

    renderer.render(scene, camera);
}

// Initialize Vercel Analytics
inject();

animate();
