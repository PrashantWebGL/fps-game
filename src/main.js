import * as THREE from 'three';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { BossEnemy } from './BossEnemy.js';
import { Bullet } from './bullet.js';
import { Particles } from './particles.js';
import { GameMap } from './map.js';
import { SoundManager } from './audio.js';
import { HealthPotion } from './healthPotion.js';
import { RedPotion } from './RedPotion.js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'; // Needed for cloning skinned meshes
import { SoldierEnemy } from './SoldierEnemy.js';
import { MultiplayerManager } from './MultiplayerManager.js';
import { inject } from '@vercel/analytics';


// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

// Variable Declarations (Hoisted)
let soldierModel = null;
let soldierAnimations = [];
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);


const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Brighter
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 1.0); // Brighter
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Brighter Sun
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

// Trees moved to GameMap class
// const treePositions = []; // Removed, utilizing gameMap.treePositions

// Map Generation
const gameMap = new GameMap(scene);
gameMap.create();
// const walls = gameMap.walls; // Removed to avoid stale reference

// Preload Soldier Model
const gltfLoader = new GLTFLoader();
gltfLoader.load('/assets/enemies/Soldier.glb', (gltf) => {
    soldierModel = gltf.scene;
    soldierModel.traverse(function (object) {
        if (object.isMesh) object.castShadow = true;
    });
    soldierAnimations = gltf.animations;
    console.log('Soldier model loaded with animations:', soldierAnimations.map(a => a.name));
}, undefined, (error) => {
    console.error('An error happened loading soldier model:', error);
});

// Snow Effect
let snowSystem = null;

function createSnow() {
    if (snowSystem) return; // Already exists

    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        // Random position above player
        positions.push(
            (Math.random() - 0.5) * 100, // x
            Math.random() * 50,          // y
            (Math.random() - 0.5) * 100  // z
        );

        velocities.push(
            (Math.random() - 0.5) * 0.5, // drift x
            -1 - Math.random(),          // fall y
            (Math.random() - 0.5) * 0.5  // drift z
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Custom shader or simple points? Simple points for now.
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.2,
        transparent: true,
        opacity: 0.8
    });

    snowSystem = new THREE.Points(geometry, material);
    snowSystem.userData = { velocities: velocities };
    scene.add(snowSystem);
}

function updateSnow(delta) {
    if (!snowSystem) return;

    const positions = snowSystem.geometry.attributes.position.array;
    const velocities = snowSystem.userData.velocities;

    for (let i = 0; i < positions.length / 3; i++) {
        // Fall
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 5;

        // Drift
        positions[i * 3] += velocities[i * 3] * delta * 2;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 2;

        // Reset if below ground
        if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 50;
            positions[i * 3] = (Math.random() - 0.5) * 100 + player.dummyCamera.position.x; // Reappearing relative to player? 
            // Better: random world box, but for infinite feel, updating x/z relative to player is good trick
            // but for now just reset Y, let them drift out
        }
    }
    snowSystem.geometry.attributes.position.needsUpdate = true;

    // Follow player (infinite effect hack)
    // snowSystem.position.x = player.dummyCamera.position.x;
    // snowSystem.position.z = player.dummyCamera.position.z;
    // But we need to offset texture... points don't tile well like that.
    // simpler: just spawn enough around 0,0 and let them fall.
}



// Game State
const bullets = [];
const enemies = [];
const particles = new Particles(scene);
const soundManager = new SoundManager();

// Score / HUD state
let kCount = 0;
let score = 0;
let killCount = 0;
const scoreEl = document.getElementById('score-value');
const instructionsEl = document.getElementById('instructions');

function updateHUD() {
    if (scoreEl) {
        scoreEl.innerText = kCount;
    }
}

// Player
const player = new Player(camera, scene, document.body, soundManager, isSafari); // Pass isSafari
scene.add(player.hitbox); // Add hitbox to scene for debugging/logic
player.dummyCamera.position.set(0, 2, 10); // Start position (Safe Zone)

// Multiplayer
const multiplayerManager = new MultiplayerManager(scene, player);

// Setup Multiplayer Callbacks
multiplayerManager.onKillConfirmed = (data) => {
    console.log('CLIENT: onKillConfirmed called with data:', data);
    kCount = data.totalKills; // Sync with server value
    updateHUD();
    showMessage(`KILLED ${data.victimName}! +1`, 2000, '#00ff00', '24px');
};

multiplayerManager.onRemoteShot = (data) => {
    // Other players see these tracers
    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    const bullet = new Bullet(scene, origin, direction, 'remote');
    bullets.push(bullet);
};

multiplayerManager.onPlayerJoined = (data) => {
    // Managers handles the kill feed message, but we can add sound or secondary log here
    console.log(`Callback: ${data.name} joined the arena.`);
};

multiplayerManager.onDeathLimitReached = (data) => {
    console.log('Death limit reached:', data.deathCount);
    player.isDead = true;
    player.controls.unlock();

    // Create Match Summary Overlay
    const overlay = document.createElement('div');
    overlay.id = 'match-summary-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Inter', Arial, sans-serif;
    `;

    let rankingHTML = `
        <h1 style="color: #ff4444; font-size: 64px; margin-bottom: 5px; text-shadow: 0 0 20px rgba(255,0,0,0.5);">Game Over</h1>
        <p style="font-size: 24px; color: #aaaaaa; margin-bottom: 20px;">You reached 10 deaths and are out of the match.</p>
        <div style="font-size: 32px; color: #ffd700; margin-bottom: 30px; font-weight: bold;">YOUR KILLS: ${kCount}</div>
        
        <div style="width: 80%; max-width: 600px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px; color: #00ffff;">MATCH RANKING</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 18px;">
                <thead>
                    <tr style="text-align: left; color: #888;">
                        <th style="padding: 10px;">PLAYER</th>
                        <th style="padding: 10px;">KILLS</th>
                        <th style="padding: 10px;">DEATHS</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.ranking.forEach((entry, index) => {
        const isSelf = entry.name === playerName;
        rankingHTML += `
            <tr style="background: ${isSelf ? 'rgba(255, 255, 255, 0.15)' : 'transparent'}; border-bottom: 1px solid #333;">
                <td style="padding: 12px; color: ${isSelf ? '#44ff44' : 'white'};">${index + 1}. ${entry.name} ${isSelf ? '(YOU)' : ''}</td>
                <td style="padding: 12px;">${entry.kills}</td>
                <td style="padding: 12px;">${entry.deaths}</td>
            </tr>
        `;
    });

    rankingHTML += `
                </tbody>
            </table>
        </div>

        <div id="match-summary-ad" style="margin: 20px 0; min-height: 100px; display: flex; justify-content: center;">
            <ins class="adsbygoogle"
                 style="display:block; min-width:320px;"
                 data-ad-client="ca-pub-6711187069654589"
                 data-ad-slot="1234567890"
                 data-ad-format="horizontal"
                 data-full-width-responsive="true"></ins>
        </div>
        
        <p style="margin-top: 20px; font-size: 18px; color: #888;">Refresh the page to join a new match.</p>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 15px 40px; background: #44ff44; color: black; border: none; border-radius: 8px; font-size: 20px; cursor: pointer; font-weight: bold; transition: transform 0.2s;">REJOIN GAME</button>
    `;

    overlay.innerHTML = rankingHTML;
    document.body.appendChild(overlay);

    // Hide player model
    if (player.playerModel) player.playerModel.visible = false;

    // Refresh ad
    setTimeout(() => {
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.log('AdSense in match summary:', e);
        }
    }, 100);
};

// Mobile auto-fire
let mobileAutoFireTimer = 0;
const mobileAutoFireInterval = 0.1; // 100ms = 0.1 seconds
let isAimingAtEnemy = false;

let lastTime = performance.now();
let maxEnemies = 1;
let gameStarted = false;
const potions = [];
let bossSpawned = false; // Track if boss is currently active
let totalKills = 0; // Track total kills for boss spawn
let killsSinceBoss = 0; // Track kills since last boss spawn

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

async function getLeaderboard(difficulty) {
    // If difficulty is not provided, default to 'easy' or allow all?
    // User requested filtering by difficulty.
    const targetDifficulty = difficulty || 'easy';

    if (!isSupabaseConfigured()) {
        const data = localStorage.getItem('fpsLeaderboard');
        let parsed = data ? JSON.parse(data) : [];
        // Local storage might have mixed difficulties if we didn't separate them before.
        // Let's just filter them now.
        return parsed.filter(entry => entry.difficulty === targetDifficulty);
    }

    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('difficulty', targetDifficulty)
        .order('score', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
    return data;
}

async function getUserRank(score, difficulty) {
    if (!isSupabaseConfigured()) return 'N/A';

    // Count how many people have a higher score in this difficulty
    // This gives us the rank (count + 1)
    const { count, error } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('difficulty', difficulty)
        .gt('score', score);

    if (error) {
        console.error('Error fetching rank:', error);
        return 'N/A';
    }
    return count + 1;
}

async function saveScore(name, score, difficulty) {
    if (!isSupabaseConfigured()) {
        const id = Date.now().toString(); // Local fake ID
        let leaderboard = JSON.parse(localStorage.getItem('fpsLeaderboard') || '[]');
        leaderboard.push({
            id,
            name: name || 'Anonymous',
            score,
            difficulty: difficulty || 'easy',
            date: new Date().toISOString()
        });
        // Sort entire local leaderboard first? Or just by difficulty?
        // Let's keep existing behavior but just filter on read.
        leaderboard.sort((a, b) => b.score - a.score);
        // Keep top 50 locally to allow for multiple difficulties
        const top50 = leaderboard.slice(0, 50);
        localStorage.setItem('fpsLeaderboard', JSON.stringify(top50));

        return { id, leaderboard: top50.filter(e => e.difficulty === difficulty).slice(0, 10) };
    }

    const { data: insertedData, error } = await supabase
        .from('leaderboard')
        .insert([
            {
                name: name || 'Anonymous',
                score: score,
                difficulty: difficulty || 'easy'
            }
        ])
        .select(); // Fetch the inserted row to get ID

    let newId = null;
    if (insertedData && insertedData.length > 0) {
        newId = insertedData[0].id;
    }

    if (error) {
        console.error('Error saving score:', error);
        alert(`Supabase Error: ${error.message}\n\nHint: Check your Table RLS Polices! Did you disable RLS or add a policy for Anon Key?`);
    }

    return { id: newId, leaderboard: await getLeaderboard(difficulty) };
}

// Banner Interaction
async function updateBannerContent(mesh) {
    // Debounce: don't reload if already showing (or recently triggered)
    if (mesh.userData.isShowingLeaderboard) return;

    mesh.userData.isShowingLeaderboard = true;
    console.log('Banner hit! Loading leaderboard...');

    // Visual feedback immediately (flash or something? maybe just wait for texture)

    // Fetch Data
    const difficultyForBanner = currentDifficulty || 'easy';
    const data = await getLeaderboard(difficultyForBanner);

    // Create Canvas (HIGH RES for clarity)
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#ffd700';
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Header
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0000'; // GOLD
    ctx.fillText(`LEADERBOARD (${difficultyForBanner.toUpperCase()})`, canvas.width / 2, 160);

    // Columns
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('Rank', 200, 300);
    ctx.textAlign = 'left';
    ctx.fillText('Name', 500, 300);
    ctx.textAlign = 'right';
    ctx.fillText('Score', 1800, 300);

    // Line
    ctx.beginPath();
    ctx.moveTo(100, 340);
    ctx.lineTo(1948, 340);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Entries
    ctx.font = '80px Arial';
    ctx.fillStyle = '#ffffff';

    if (data.length === 0) {
        ctx.textAlign = 'center';
        ctx.fillText('No scores yet!', canvas.width / 2, 600);
    } else {
        const slots = Math.min(data.length, 5); // Show top 5
        for (let i = 0; i < slots; i++) {
            const entry = data[i];
            const y = 460 + (i * 120);

            // Rank
            ctx.textAlign = 'center';
            ctx.fillStyle = i === 0 ? '#ffd700' : '#ffffff';
            ctx.fillText(`#${i + 1}`, 200, y);

            // Name
            ctx.textAlign = 'left';
            ctx.fillText(entry.name.substring(0, 15), 500, y);

            // Score
            ctx.textAlign = 'right';
            ctx.fillStyle = '#00ff88';
            ctx.fillText(entry.score, 1800, y);
        }
    }

    // UPDATE TEXTURE
    const texture = new THREE.CanvasTexture(canvas);

    // If double-sided mesh logic:
    // We applied texture to mesh.material.map.
    // Assuming mesh has its own material clone or we clone it now.
    // If we shared materials, all banners would update! 
    // We should ensure unique materials or just clone explicitly.
    // Since GameMap creates new MeshBasicMaterial for each banner, they are unique instances.

    const originalMap = mesh.userData.originalMap; // Saved in map.js
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;

    // Reset Timer (5 seconds)
    setTimeout(() => {
        if (mesh.material.map === texture) {
            mesh.material.map = originalMap;
            mesh.material.needsUpdate = true;
            mesh.userData.isShowingLeaderboard = false;

            // Trigger a fresh ad load for this specific banner immediately after the leaderboard closes
            if (gameMap && gameMap.adGames.length > 0) {
                // We need to know which screen we are on. 
                // Since mesh is the screen, we can just call loadRealTimeAd if we have access to the screen pair.
                // Or easier: find the pair in adScreens.
                const screenPair = gameMap.adScreens.find(s => s.front === mesh || s.back === mesh);
                if (screenPair) {
                    gameMap.loadRealTimeAd(screenPair.front, screenPair.back);
                }
            }

            texture.dispose(); // Cleanup memory
        }
    }, 5000); // 5 seconds
}

async function showLeaderboard(currentScore, viewOnly = false) {
    if (currentDifficulty === 'multiplayer') {
        console.log('Skipping global leaderboard in multiplayer mode');
        return;
    }

    // If not configued, show local warning
    let warningHTML = '';
    if (!isSupabaseConfigured()) {
        warningHTML = '<div style="color: yellow; text-align: center; margin-bottom: 10px; font-size: 14px;">⚠️ Global Leaderboard Not Configured (Using Local)</div>';
    }

    let leaderboard;
    let newScoreId = null;

    if (viewOnly) {
        leaderboard = await getLeaderboard(currentDifficulty);
    } else {
        const result = await saveScore(playerName, currentScore, currentDifficulty);
        leaderboard = result.leaderboard;
        newScoreId = result.id;
    }

    // Get global rank logic
    let globalRank = '...';

    // Check if player is present in current leaderboard page
    let foundInListIndex = -1;
    if (newScoreId) {
        foundInListIndex = leaderboard.findIndex(e => e.id === newScoreId);
    } else if (!viewOnly && !isSupabaseConfigured()) {
        // Fallback for local storage without robust ID persistence in memory (though we added it)
        foundInListIndex = leaderboard.findIndex(e => e.score === currentScore && e.name === playerName);
    }

    // Rank Sync Logic:
    // 1. If we found the player in the list, their rank is index + 1
    // 2. If not found (out of top 10), we fetch DB rank

    if (foundInListIndex !== -1) {
        globalRank = '#' + (foundInListIndex + 1);
    } else {
        if (isSupabaseConfigured()) {
            globalRank = await getUserRank(currentScore, currentDifficulty);
            if (globalRank !== 'N/A') globalRank = '#' + globalRank;
        } else {
            // Calculate local rank
            const localData = JSON.parse(localStorage.getItem('fpsLeaderboard') || '[]');
            const betterScores = localData.filter(e => e.difficulty === currentDifficulty && e.score > currentScore).length;
            globalRank = '#' + (betterScores + 1) + ' (Local)';
        }
    }

    let tableRows = '';

    if (leaderboard.length === 0) {
        tableRows = `
            <tr>
                <td colspan="4" style="color: white; font-size: 20px; padding: 30px; text-align: center;">
                    No scores yet for ${currentDifficulty.toUpperCase()}! Be the first!
                </td>
            </tr>
        `;
    } else {
        leaderboard.forEach((entry, index) => {
            // Highlighting based on Unique ID
            let isCurrentPlayer = false;

            if (!viewOnly && newScoreId) {
                isCurrentPlayer = entry.id === newScoreId;
            } else if (!viewOnly && !isSupabaseConfigured()) {
                isCurrentPlayer = entry.id === newScoreId; // Local adds IDs now
            }

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

    // Rank Display Logic when viewing only vs dying
    const rankDisplay = viewOnly
        ? `<p style="color: white; font-size: 16px; text-align: center;">Current Difficulty: <b style="color:#00ff88">${currentDifficulty.toUpperCase()}</b></p>`
        : `<p style="color: white; font-size: 18px; text-align: center; margin: 5px 0 15px 0;">
                Your Score: <span style="color: #ffd700; font-size: 26px; font-weight: bold;">${currentScore}</span>
                <span style="color: #aaa; margin: 0 10px;">|</span>
                Global Rank: <span style="color: #00ff88; font-size: 26px; font-weight: bold;">${globalRank}</span>
           </p>`;

    return `
        <div style="background: #1a1a1aee; padding: 20px; border-radius: 20px; border: 3px solid #ffd700; width: 95%; max-width: 800px; max-height: 85vh; margin: 0 auto; display: flex; flex-direction: column;">
            <h1 style="color: #ffd700; font-size: 28px; text-align: center; margin: 0 0 10px 0;">
                🏆 LEADERBOARD 🏆
            </h1>
            ${warningHTML}
            ${rankDisplay}
            
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
            
            <div id="leaderboard-ad" style="margin: 15px 0; min-height: 100px; display: flex; justify-content: center;">
                <ins class="adsbygoogle"
                     style="display:block; min-width:320px;"
                     data-ad-client="ca-pub-6711187069654589"
                     data-ad-slot="1234567890"
                     data-ad-format="horizontal"
                     data-full-width-responsive="true"></ins>
            </div>
            
            <button onclick="${viewOnly ? 'window.closeLeaderboard()' : 'location.reload()'}" style="margin-top: 20px; padding: 15px 40px; font-size: 18px; font-weight: bold; cursor: pointer; background: #00ff00; color: black; border: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 255, 0, 0.3); transition: all 0.2s;">
                ${viewOnly ? '✕ CLOSE' : '🔄 PLAY AGAIN'}
            </button>
        </div>
    `;
}

// Mobile detection
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
// iOS/Safari detection for browser-specific handling
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;


// Get references after DOM is ready
const mobileStartEl = document.getElementById('mobile-start');

// Validation Logic (Hoisted)
function checkNameValidity(name) {
    playerName = name;
    const isValid = playerName && playerName.length > 3;

    // Ensure buttons are available in scope or fetch them here if needed
    // Global 'buttons' array might not be ready if this runs too early, but it's called inside init or event, so DOM should be ready.
    // However, 'buttons' variable is defined later (const buttons = ...). 
    // We should re-fetch or use the global const defined below if possible. 
    // Wait, 'buttons' const is defined where? Let's check view.
    // It's likely defined near the difficulty buttons.
    // Safest is to fetch them inside helper.

    const relevantButtons = [
        document.getElementById('btn-easy'),
        document.getElementById('btn-medium'),
        document.getElementById('btn-hard'),
        document.getElementById('btn-multiplayer')
    ];
    const btnLB = document.getElementById('btn-show-scores');

    relevantButtons.forEach(btn => {
        if (!btn) return;
        btn.disabled = !isValid;
        btn.style.opacity = isValid ? '1' : '0.5';
        btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    });
    if (btnLB) {
        btnLB.disabled = !isValid;
        btnLB.style.opacity = isValid ? '1' : '0.5';
        btnLB.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }
    return isValid;
}
window.checkNameValidity = checkNameValidity;


// Show mobile start overlay on small screens
function showMobileStartOverlay() {
    if (window.innerWidth <= 768) {
        mobileStartEl.style.display = 'flex';
    }
}
// showMobileStartOverlay();

// Restore player name from localStorage
const savedName = localStorage.getItem('fps_playerName');
if (savedName) {
    const nameInput = document.getElementById('player-name');
    if (nameInput) {
        nameInput.value = savedName;
        // Trigger validation immediately
        checkNameValidity(savedName);
    }
}

// Mobile users will use the same difficulty selection as desktop
// No need for separate "tap to play" overlay

const btnFullscreen = document.getElementById('btn-fullscreen');
const btnPause = document.getElementById('btn-pause');
const mobileControlsTop = document.getElementById('mobile-controls-top');

// Enable controls for everyone (hidden initially)
if (mobileControlsTop) mobileControlsTop.style.display = 'none';

// Event Listeners for Buttons (Desktop & Mobile)
if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });
}

if (btnPause) {
    btnPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.isGamePaused) {
            // Resume
            window.isGamePaused = false;
            instructionsEl.style.display = 'none';
            btnPause.innerText = '⏸️';
            // Lock pointer again if desktop
            if (!isMobile) {
                player.controls.lock();
            }
        } else {
            // Pause
            window.isGamePaused = true;
            if (!isMobile) player.controls.unlock();
            instructionsEl.style.display = 'block';

            // Enhanced Pause Menu
            instructionsEl.innerHTML = `
                <h1 style="color:white; margin:0 0 20px 0;">PAUSED</h1>
                <div style="display:flex; flex-direction:column; gap:15px; align-items:center;">
                    <button id="btn-continue" style="padding:15px 40px; font-size:20px; font-weight:bold; cursor:pointer; background:#00ff00; color:black; border:none; border-radius:8px;">
                        CONTINUE
                    </button>
                    <button id="btn-surrender" style="padding:15px 40px; font-size:20px; font-weight:bold; cursor:pointer; background:#ff0000; color:white; border:none; border-radius:8px;">
                        🏳️ SURRENDER
                    </button>
                </div>
            `;

            // Add event listeners to new buttons
            document.getElementById('btn-continue').addEventListener('click', () => {
                window.isGamePaused = false;
                instructionsEl.style.display = 'none';
                btnPause.innerText = '⏸️';
                if (!isMobile) player.controls.lock();
            });

            document.getElementById('btn-surrender').addEventListener('click', async () => {
                player.isDead = true;
                player.setFinalScore(score);
                window.dispatchEvent(new CustomEvent('playerDied'));
            });

            soundManager.stopBreathing();
            btnPause.innerText = '▶️';
        }
    });
}

if (isMobile) {
    document.body.classList.add('mobile-mode');
}


// Difficulty Selection
function startGame(difficulty) {
    const nameInput = document.getElementById('player-name');
    playerName = nameInput.value.trim() || 'Anonymous';
    // Persist player name
    localStorage.setItem('fps_playerName', playerName);
    currentDifficulty = difficulty; // Store the difficulty

    console.log('Starting game with difficulty:', difficulty);
    switch (difficulty) {
        case 'easy': maxEnemies = 1; break;
        case 'medium': maxEnemies = 2; break;
        case 'hard': maxEnemies = 4; break;
        case 'multiplayer':
            maxEnemies = 5; // We'll maintain a total of 5 entities (players + bots)
            console.log(`Connecting to multiplayer as: ${playerName}`);
            multiplayerManager.connect(playerName).then(spawnPos => {
                if (spawnPos) {
                    player.dummyCamera.position.set(spawnPos.x, 2, spawnPos.z);
                    console.log('Spawned at initial position:', spawnPos);
                }
            }).catch(err => {
                console.error('Failed to connect to multiplayer:', err);
                alert('Multiplayer server unreachable. Running in offline mode.');
            });
            document.getElementById('player-count').style.display = 'block';
            document.getElementById('multiplayer-info').style.display = 'block';
            break;
    }
    if (difficulty !== 'multiplayer') {
        document.getElementById('multiplayer-info').style.display = 'none';
        document.getElementById('player-count').style.display = 'none';
        multiplayerManager.disconnect();
    }
    gameStarted = true;
    // Reset score saved flag for new game
    window.isScoreSavedForThisRun = false;

    // Reset counts
    kCount = 0;
    score = 0;
    if (scoreEl) scoreEl.innerText = '0';

    // Explicitly reset breathing sound
    soundManager.stopBreathing();

    // Reset player state
    player.isDead = false;
    player.health = player.maxHealth;
    player.finalScore = 0;

    // Blur potential inputs
    if (document.activeElement) document.activeElement.blur();

    // Request pointer lock only on desktop
    if (!isMobile) {
        try {
            player.controls.lock();
            console.log('Pointer lock requested');
        } catch (e) {
            console.error('Pointer lock failed:', e);
        }
    }

    // Hide the instructions overlay (pause screen)
    instructionsEl.style.display = 'none';
    instructionsEl.style.visibility = 'hidden';
    instructionsEl.style.opacity = '0';

    // Update HUD Name
    document.getElementById('hud-player-name').textContent = playerName.toUpperCase();

    // Show mobile controls on start (NOW FOR ALL PLATFORMS)
    if (mobileControlsTop) {
        mobileControlsTop.style.display = 'flex';
    }
}

// Map Selection State
let selectedMap = 'house'; // 'house' or 'jungle'

// Map Buttons
const btnMapHouse = document.getElementById('btn-map-house');
const btnMapCity = document.getElementById('btn-map-city');

function updateMapButtons() {
    if (selectedMap === 'house') {
        btnMapHouse.style.background = '#ffffff';
        btnMapHouse.style.color = '#000000';
        btnMapHouse.style.borderColor = '#00ff00';

        btnMapCity.style.background = 'rgba(0,0,0,0.5)';
        btnMapCity.style.color = '#ffffff';
        btnMapCity.style.borderColor = 'rgba(255,255,255,0.3)';
    } else {
        btnMapCity.style.background = '#ffffff';
        btnMapCity.style.color = '#000000';
        btnMapCity.style.borderColor = '#00ff00';

        btnMapHouse.style.background = 'rgba(0,0,0,0.5)';
        btnMapHouse.style.color = '#ffffff';
        btnMapHouse.style.borderColor = 'rgba(255,255,255,0.3)';
    }
}

btnMapHouse.addEventListener('click', () => {
    console.log('House Map Clicked');
    if (selectedMap === 'house') return;
    selectedMap = 'house';
    updateMapButtons();
    gameMap.clear();
    gameMap.createHouseLevel();
    // Reset player position?
    player.dummyCamera.position.set(0, 2, 10);
});

btnMapCity.addEventListener('click', () => {
    console.log('City Map Clicked');
    if (selectedMap === 'city') return;
    selectedMap = 'city';
    updateMapButtons();

    gameMap.clear();
    gameMap.createCityLevel();
    player.dummyCamera.position.set(0, 2, 10);
});

// Start Game Logic
const nameInput = document.getElementById('player-name');
const btnEasy = document.getElementById('btn-easy');
const btnMedium = document.getElementById('btn-medium');
const btnHard = document.getElementById('btn-hard');
const btnMultiplayer = document.getElementById('btn-multiplayer');
const buttons = [btnEasy, btnMedium, btnHard, btnMultiplayer];
const btnShowLeaderboard = document.getElementById('btn-show-leaderboard');

// Create a safe close function for the leaderboard
window.closeLeaderboard = function () {
    const lbOverlay = document.getElementById('leaderboard-overlay');
    if (lbOverlay) {
        lbOverlay.style.display = 'none';
        lbOverlay.innerHTML = ''; // Clear content
    }

    // Only mess with instructions/pointer lock if we are IN GAME
    if (gameStarted && !player.isDead) {
        try {
            document.body.requestPointerLock();
        } catch (e) { console.log('Could not re-lock pointer'); }
        const instructions = document.getElementById('instructions');
        instructions.style.display = 'none';
    }
};

// Leaderboard Button Click
if (btnShowLeaderboard) {
    btnShowLeaderboard.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent clicks from shooting

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        const lbOverlay = document.getElementById('leaderboard-overlay');
        lbOverlay.innerHTML = '<h1 style="color:white; text-align:center; margin-top: 200px;">LOADING RANKS...</h1>';
        lbOverlay.style.display = 'flex'; // Use flex to center

        const html = await showLeaderboard(score, true); // true = viewOnly
        lbOverlay.innerHTML = html;
        refreshAds(); // Refresh ads after content is loaded

        // Ensure the close button in the HTML calls window.closeLeaderboard()
        if (mobileControlsTop) mobileControlsTop.style.display = 'none';
    });
}

// Disable initially
buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
});
if (btnShowLeaderboard) {
    btnShowLeaderboard.disabled = true;
    btnShowLeaderboard.style.opacity = '0.5';
    btnShowLeaderboard.style.cursor = 'not-allowed';
}

// Final check: If name was restored, re-enable buttons now that they are initialized
if (playerName && playerName.length > 3) {
    checkNameValidity(playerName);
}

// function checkNameValidity moved to top scope

nameInput.addEventListener('input', (e) => {
    // Validation: Only alphanumerics, underscores, hyphens, dollars
    e.target.value = e.target.value.replace(/[^a-zA-Z0-9_$-]/g, '');
    checkNameValidity(e.target.value);
});

btnEasy.addEventListener('click', () => { if (playerName.length > 3) startGame('easy'); });
btnMedium.addEventListener('click', () => { if (playerName.length > 3) startGame('medium'); });
btnHard.addEventListener('click', () => { if (playerName.length > 3) startGame('hard'); });
btnMultiplayer.addEventListener('click', () => { if (playerName.length > 3) startGame('multiplayer'); });

// Handle player death
window.addEventListener('playerDied', async (event) => {
    if (currentDifficulty === 'multiplayer') {
        console.log('Player died in multiplayer - letting server handle respawn/limit');
        showMessage("YOU ARE DOWN! RESPAWNING...", 3000, "#ff4444", "40px");
        return;
    }
    console.log('=== PLAYER DIED EVENT HANDLER START ===');
    console.log('Player died event triggered, score:', score);
    console.log('Browser info - iOS:', isIOS, 'Safari:', isSafari, 'Mobile:', isMobile);

    // CRITICAL: Mark player as dead immediately to stop game loop
    player.isDead = true;
    console.log('Player.isDead set to true');

    // Stop boss music if playing
    try {
        soundManager.stopBossAmbient();
        soundManager.stopBreathing();
        console.log('Sounds stopped');
    } catch (e) {
        console.warn('Error stopping sounds:', e);
    }

    // Safely unlock pointer - with iOS/Safari specific handling
    if (!isIOS && !isSafari) {
        try {
            if (document.pointerLockElement) {
                document.exitPointerLock();
                console.log('Pointer unlocked');
            }
        } catch (e) {
            console.warn('Pointer unlock failed (non-critical):', e);
        }
    } else {
        console.log('Skipping pointer unlock on iOS/Safari');
    }

    // Disable Leaderboard Button
    if (btnShowLeaderboard) {
        btnShowLeaderboard.disabled = true;
        btnShowLeaderboard.style.opacity = '0.5';
        btnShowLeaderboard.style.cursor = 'not-allowed';
    }

    player.setFinalScore(score);
    const instructions = document.getElementById('instructions');

    // CRITICAL: Force display of instructions overlay
    console.log('Showing instructions overlay');
    instructions.style.display = 'block';
    instructions.style.visibility = 'visible';
    instructions.style.opacity = '1';
    instructions.style.pointerEvents = 'auto';
    instructions.style.zIndex = '10000';
    instructions.innerHTML = '<h1 style="color:white; text-align:center; margin-top: 200px;">LOADING SCORES...</h1>';

    // Hide controls
    if (mobileControlsTop) {
        mobileControlsTop.style.display = 'none';
        console.log('Mobile controls hidden');
    }

    // Prevent duplicate score saves
    if (window.isScoreSavedForThisRun) {
        console.log('Score already saved, skipping');
        return;
    }
    window.isScoreSavedForThisRun = true;

    // Load and display leaderboard with robust error handling
    try {
        console.log('Fetching leaderboard...');

        // Shorter timeout for mobile/Safari (3 seconds instead of 5)
        const timeoutDuration = (isIOS || isSafari) ? 3000 : 5000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Leaderboard loading timeout')), timeoutDuration)
        );

        const leaderboardPromise = showLeaderboard(score);
        const leaderboardHTML = await Promise.race([leaderboardPromise, timeoutPromise]);

        console.log('Leaderboard HTML generated, length:', leaderboardHTML.length);
        instructions.innerHTML = leaderboardHTML;

        refreshAds(); // Refresh ads after content is loaded

        console.log('Leaderboard displayed successfully');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        // Fallback UI if leaderboard fails - GUARANTEED to show
        instructions.innerHTML = `
            <div style="background: rgba(0,0,0,0.9); padding: 40px; border-radius: 20px; text-align: center;">
                <h1 style="color: white; margin: 0 0 20px 0;">GAME OVER</h1>
                <p style="color: #ffd700; font-size: 32px; margin: 20px 0;">Score: ${score}</p>
                <p style="color: #ff6b6b; margin: 20px 0;">Unable to load leaderboard</p>
                <div id="gameover-ad-container" style="margin: 20px 0; width: 100%; display: flex; justify-content: center;">
                    <ins class="adsbygoogle"
                         style="display:inline-block;width:320px;height:100px"
                         data-ad-client="ca-pub-6711187069654589"
                         data-ad-slot="1234567890"></ins>
                </div>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 15px 40px; font-size: 18px; font-weight: bold; cursor: pointer; background: #00ff00; color: black; border: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 255, 0, 0.3);">
                    🔄 PLAY AGAIN
                </button>
            </div>
        `;
        refreshAds(); // Refresh ads for the fallback UI as well
        console.log('Fallback UI displayed');
    }

    console.log('=== PLAYER DIED EVENT HANDLER END ===');
});

// Helper to refresh ads
function refreshAds() {
    if (window.adsbygoogle) {
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.warn('AdSense push failed:', e);
        }
    }
}

document.addEventListener('click', () => {
    if (player.isDead) {
        // Don't do anything when dead - leaderboard is showing
        return;
    }

    if (gameStarted && !isMobile && !player.controls.isLocked) {
        try {
            player.controls.lock();
        } catch (e) {
            console.warn('Pointer lock failed:', e);
        }
    } else if (gameStarted && !isMobile) {
        player.shoot(bullets);
    }
    // On mobile, shooting is handled by touch controls or auto-fire
});

// Pointer lock event listeners (desktop only)
if (!isMobile) {
    player.controls.addEventListener('lock', () => {
        console.log('Pointer locked');
        instructionsEl.style.display = 'none';
        window.isGamePaused = false;
    });

    player.controls.addEventListener('unlock', () => {
        console.log('Pointer unlocked');
        if (player.isDead) {
            // Don't change anything - leaderboard is already showing
            return;
        } else {
            // Pause menu or just show instructions again?
            instructionsEl.style.display = 'block';
            instructionsEl.innerHTML = '<h1>PAUSED</h1><p>Click to Resume</p>';

            // Stop breathing sound when paused
            soundManager.stopBreathing();
        }
    });
}

// Message Display System
function showMessage(text, duration = 2000, color = '#FFD700', fontSize = '48px') {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
        position: fixed;
        top: 15%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: ${fontSize};
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
        // Check gameMap.treePositions if available
        if (gameMap.treePositions) {
            for (const treePos of gameMap.treePositions) {
                const d = Math.hypot(x - treePos.x, z - treePos.z);
                if (d < 3) { tooCloseToTree = true; break; }
            }
        }
        if (tooCloseToTree) { attempts++; continue; }

        // Check walls
        let valid = true;
        for (const wall of gameMap.walls) {
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
    // Don't spawn normal enemies if boss is currently active or in multiplayer mode
    if (bossSpawned || currentDifficulty === 'multiplayer') return;

    let targetEnemyCount = maxEnemies;
    if (currentDifficulty === 'multiplayer') {
        const onlineCount = multiplayerManager.playerCount;
        targetEnemyCount = Math.max(0, 5 - onlineCount);
    }

    if ((player.controls.isLocked || isMobile || currentDifficulty === 'multiplayer') && enemies.length < targetEnemyCount) {            // Try to find a valid spawn position not inside a tree and away from player
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
            // Check gameMap.treePositions if available
            if (gameMap.treePositions) {
                for (const treePos of gameMap.treePositions) {
                    const d = Math.hypot(x - treePos.x, z - treePos.z);
                    if (d < 2) { tooCloseToTree = true; break; }
                }
            }
            if (tooCloseToTree) { attempts++; continue; }

            // Simple wall check (existing logic)
            let valid = true;
            for (const wall of gameMap.walls) {
                if (new THREE.Vector3(x, 0, z).distanceTo(wall.position) < 2) { valid = false; break; }
            }
            if (valid) { spawnPos = new THREE.Vector3(x, 0, z); break; }
            attempts++;
        }

        if (spawnPos) {
            if (currentDifficulty === 'expert' && soldierModel) {
                // Determine if we spawn a Boss (still existing logic? Or just Soldier?)
                // Assuming Solders are normal enemies in Expert mode.

                // Clone using SkeletonUtils to handle skinned meshes correctly
                const clone = SkeletonUtils.clone(soldierModel);
                const enemy = new SoldierEnemy(scene, player.position, soundManager, clone, soldierAnimations);
                enemy.mesh.position.set(spawnPos.x, 0, spawnPos.z);
                enemies.push(enemy);

            } else {
                const enemy = new Enemy(scene, player.position, soundManager);
                enemy.mesh.position.set(spawnPos.x, 0, spawnPos.z); // Override default random spawn
                enemies.push(enemy);
            }
        }
    }
}, 2000);

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    // WASD Fix: Ensure update runs if gameStarted.
    // We remove the strict isLocked check here to allow movement even if lock is technically lost 
    // (e.g. persistent overlay focus issue), as long as gameStarted is true.
    // player.update() has its own isDead check.
    // Pause Logic
    // Desktop: Pause if pointer is unlocked (and not dead)
    // Mobile: Pause if window.isGamePaused is set
    // CRITICAL: Stop all game logic immediately if player is dead
    if (player.isDead) {
        return; // Don't process any game logic when dead
    }

    const isPaused = (!isMobile && !player.controls.isLocked) || (isMobile && window.isGamePaused);

    if (gameStarted && !player.isDead && !isPaused) { // Added pause check
        player.update(delta, gameMap.walls); // Pass walls for collision

        // Enemy Collision (Player vs Enemy)
        // Prevent player from walking through enemies
        const playerPos = player.dummyCamera.position;
        const playerRadius = 1.0;
        const enemyRadius = 1.0;

        for (const enemy of enemies) {
            if (enemy.isDead || enemy.isBroken) continue;

            const dx = playerPos.x - enemy.mesh.position.x;
            const dz = playerPos.z - enemy.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = playerRadius + enemyRadius;

            if (dist < minDist) {
                // Formatting collision - Push player back
                const angle = Math.atan2(dz, dx);
                const pushX = Math.cos(angle) * (minDist - dist);
                const pushZ = Math.sin(angle) * (minDist - dist);

                playerPos.x += pushX;
                playerPos.z += pushZ;

                // Also stop velocity in that direction?
                // Simple position correction is often enough for this
            }
        }

        // Low Health Audio
        // Only run this if player is ALIVE. If dead, we handle stop in playerDied.
        if (!player.isDead) {
            if (player.health < 25) {
                soundManager.playBreathing();
            } else {
                soundManager.stopBreathing();
            }
        }

        // Check for touch shooting
        if (player.touchControls.shouldShoot) {
            player.shoot(bullets);
        }

        // Update Cars / Civilians
        if (gameMap) {
            gameMap.update(delta, player, enemies);
        }

        // Car Collision (Player vs Car)
        if (gameMap.cars) {
            const pPos = player.dummyCamera.position;
            const pRadius = 1.0;
            const cRadius = 2.5; // Approx for car size

            for (const car of gameMap.cars) {
                const dx = pPos.x - car.mesh.position.x;
                const dz = pPos.z - car.mesh.position.z;
                const dist = Math.hypot(dx, dz);

                if (dist < pRadius + cRadius) {
                    // Push Player Back
                    const angle = Math.atan2(dz, dx);
                    const pushDist = (pRadius + cRadius) - dist;
                    pPos.x += Math.cos(angle) * pushDist;
                    pPos.z += Math.sin(angle) * pushDist;
                }
            }
        }

        // Update Potions
        const currentTime = performance.now();
        for (let i = potions.length - 1; i >= 0; i--) {
            const potion = potions[i];
            potion.update(delta);

            // Green Potion Timeout (15 seconds)
            // Check if potion is HealthPotion (using instanceof or property)
            // We set spawnTime when creating HealthPotion
            if (potion instanceof HealthPotion && potion.spawnTime) {
                if (currentTime - potion.spawnTime > 15000) { // 15 seconds
                    potion.remove();
                    potions.splice(i, 1);
                    continue;
                }
            }

            // Check if player collects potion
            if (potion.checkCollision(player.dummyCamera.position)) {
                const result = potion.collect();

                if (result === 'burst') {
                    // Start Burst Mode
                    player.isBurstMode = true;
                    soundManager.playPowerupCollect();
                    showMessage('BURST MODE ACTIVATED', 2000, '#ff0000', '32px');

                    // Reset timer if already active to extend duration? Or just let it run?
                    if (player.burstTimer) clearTimeout(player.burstTimer);

                    player.burstTimer = setTimeout(() => {
                        player.isBurstMode = false;
                        showMessage('BURST MODE DEACTIVATED', 2000, '#ffffff', '24px');
                    }, 30000); // 30 seconds
                } else {
                    // Health Potion
                    player.heal(result);
                    soundManager.playPotionCollect();
                }

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

            // Check Civilians (in City)
            if (gameMap && gameMap.civilians && gameMap.civilians.length > 0) {
                for (let c = 0; c < gameMap.civilians.length; c++) {
                    const civ = gameMap.civilians[c];
                    // Simple distance check for bullet hit
                    const dist = bullet.position.distanceTo(civ.mesh.position);
                    if (dist < 1.5) { // Hit civilian

                        // Penalty
                        kCount = Math.max(0, kCount - 30);
                        updateHUD();
                        showMessage("-30 (Civilian Casualty!)", 2000, "red", '24px'); // Added duration and size for consistency

                        // Remove civilian
                        civ.remove(); // Assuming civilian has a remove method

                        gameMap.civilians.splice(c, 1);

                        // Remove bullet
                        bullet.remove();
                        bullets.splice(i, 1);
                        i--; // Decrement i because an element was removed
                        break; // Bullet handled, move to next bullet
                    }
                }
            }

            // Check collisions
            let closestHit = null;

            // 0. Bullet vs Walls
            for (const wall of gameMap.walls) {
                const intersection = bullet.checkCollision(wall);
                if (intersection) {
                    if (!closestHit || intersection.distance < closestHit.distance) {
                        closestHit = {
                            type: wall.userData.type === 'ad-banner' ? 'banner' : 'wall',
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
            // 2. Bullet vs Player (Local)
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

            // 3. Bullet vs Remote Players (Multiplayer)
            if (currentDifficulty === 'multiplayer' && bullet.owner === 'player') {
                const remotePlayersArr = multiplayerManager.getRemotePlayers();
                for (const remote of remotePlayersArr) {
                    // Only hit if they are visible (not dead)
                    if (!remote.mesh.visible) continue;

                    const intersection = bullet.checkCollision(remote.mesh);
                    if (intersection) {
                        if (!closestHit || intersection.distance < closestHit.distance) {
                            closestHit = {
                                type: 'remotePlayer',
                                distance: intersection.distance,
                                point: intersection.point,
                                playerId: remote.data.id
                            };
                        }
                    }
                }
            }

            // Apply hit to closest target
            if (closestHit) {
                if (closestHit.type === 'wall') {
                    bullet.remove();
                    bullets.splice(i, 1);
                } else if (closestHit.type === 'banner') {
                    bullet.remove();
                    bullets.splice(i, 1);
                    updateBannerContent(closestHit.object);
                } else if (closestHit.type === 'enemy') {
                    const enemy = closestHit.enemy;
                    let multiplier = 1.0;
                    const partName = closestHit.partName;
                    if (partName === 'head') {
                        multiplier = 2.0;
                        showMessage('Headshot !!', 700, '#ff0000', '24px');
                        soundManager.playHeadshot();
                    }
                    else if (partName === 'torso' || partName === 'body') multiplier = 1.0;
                    else multiplier = 0.68;
                    const finalDamage = 50 * multiplier;

                    const willDie = (enemy.health - finalDamage <= 0) && !enemy.isBroken;
                    const isBoss = enemy.isBoss;
                    const deathPosition = enemy.mesh.position.clone();

                    enemy.takeDamage(50, bullet.velocity, partName);
                    particles.createBlood(bullet.position, bullet.velocity);
                    bullet.remove();
                    bullets.splice(i, 1);

                    if (willDie) {
                        if (isBoss) {
                            kCount += 500; // Use kCount in multiplayer if that's the HUD focus
                            score += 500;
                            soundManager.playBossDown();
                            soundManager.stopBossAmbient();
                            showMessage('💀 BIG BOSS DOWN! +500 💀', 3000, '#FF0000');
                            const redPotion = new RedPotion(scene, deathPosition, particles);
                            potions.push(redPotion);
                        } else {
                            kCount += 100;
                            score += 100;
                        }
                        updateHUD();
                        killCount++;
                        totalKills++;
                        if (isBoss) {
                            bossSpawned = false;
                            killsSinceBoss = 0;
                        } else {
                            killsSinceBoss++;
                        }
                        if (killsSinceBoss >= 10 && !bossSpawned) {
                            spawnBoss();
                        }
                        if (killCount % 6 === 0) {
                            const potion = new HealthPotion(scene, deathPosition, particles);
                            potion.spawnTime = performance.now();
                            potions.push(potion);
                        }
                    }
                } else if (closestHit.type === 'remotePlayer') {
                    multiplayerManager.sendDamage(closestHit.playerId, 25);
                    particles.createBlood(bullet.position, bullet.velocity);
                    bullet.remove();
                    bullets.splice(i, 1);
                } else if (closestHit.type === 'player') {
                    const playerHeadHeight = player.dummyCamera.position.y;
                    const hitHeight = closestHit.point.y;
                    const isHeadshot = hitHeight > (playerHeadHeight - 0.4);

                    player.takeDamage(10, isHeadshot);
                    particles.createBlood(bullet.position, bullet.velocity);
                    bullet.remove();
                    bullets.splice(i, 1);
                }
            }
        }

        // Update Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const remotePlayers = currentDifficulty === 'multiplayer' ? multiplayerManager.getRemotePlayers() : [];
            enemies[i].update(delta, player.position, bullets, gameMap.walls, remotePlayers);

            // Clean up enemies that have finished their death animation (isDead = true after 3 seconds)
            if (enemies[i].isDead) {
                enemies[i].remove();
                enemies.splice(i, 1);
            }
        }

        // Update Multiplayer
        if (currentDifficulty === 'multiplayer') {
            multiplayerManager.sendPosition(player.position, player.rotation);
            multiplayerManager.update();
        }

        // Update Particles
        particles.update(delta);
        updateSnow(delta);

        // Crosshair Targeting Logic
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            let pointingAtEnemy = false;

            // Check intersection with all enemies
            for (const enemy of enemies) {
                if (enemy.isDead || enemy.isBroken) continue;
                // Raycast against the enemy mesh
                const intersects = raycaster.intersectObject(enemy.mesh, true);
                if (intersects.length > 0) {
                    // Check if it's the closest thing (or close enough)
                    // We could check walls too to see if enemy is behind wall, but simple check is okay for UI feedback
                    pointingAtEnemy = true;
                    break;
                }
            }

            if (pointingAtEnemy) {
                crosshair.classList.add('enemy-target');
                isAimingAtEnemy = true;
            } else {
                crosshair.classList.remove('enemy-target');
                isAimingAtEnemy = false;
            }
        }

        // Mobile Auto-Fire: shoot automatically when aiming at enemy
        if (isMobile && isAimingAtEnemy && !player.isDead) {
            mobileAutoFireTimer += delta;
            if (mobileAutoFireTimer >= mobileAutoFireInterval) {
                player.shoot(bullets);
                mobileAutoFireTimer = 0;
            }
        } else {
            mobileAutoFireTimer = 0; // Reset timer when not aiming
        }
    }

    renderer.render(scene, camera);
}

// Resume handler for mobile (click on instructions overlay)
instructionsEl.addEventListener('click', () => {
    if (isMobile && window.isGamePaused) {
        window.isGamePaused = false;
        instructionsEl.style.display = 'none';
        if (btnPause) btnPause.innerText = '⏸️';
    }
});

// Initialize Vercel Analytics
inject();

animate();
