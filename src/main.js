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

// Trees moved to GameMap class
// const treePositions = []; // Removed, utilizing gameMap.treePositions

// Map Generation
const gameMap = new GameMap(scene);
gameMap.create();
// const walls = gameMap.walls; // Removed to avoid stale reference


// Game State
const bullets = [];
const enemies = [];
const particles = new Particles(scene);
const soundManager = new SoundManager();

// Player
const player = new Player(camera, scene, document.body, soundManager);
scene.add(player.hitbox); // Add hitbox to scene for debugging/logic
player.dummyCamera.position.set(0, 2, 10); // Start position (Safe Zone)

let lastTime = performance.now();
let score = 0;
let killCount = 0;
let maxEnemies = 1;
let gameStarted = false;
const potions = [];
let bossSpawned = false; // Track if boss is currently active
let totalKills = 0; // Track total kills for boss spawn
let killsSinceBoss = 0; // Track kills since last boss spawn

// Mobile auto-fire
let mobileAutoFireTimer = 0;
const mobileAutoFireInterval = 0.1; // 100ms = 0.1 seconds
let isAimingAtEnemy = false;

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

async function showLeaderboard(currentScore, viewOnly = false) {
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
            
            <button onclick="${viewOnly ? 'window.closeLeaderboard()' : 'location.reload()'}" style="margin-top: 20px; padding: 15px 40px; font-size: 18px; font-weight: bold; cursor: pointer; background: #00ff00; color: black; border: none; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 255, 0, 0.3); transition: all 0.2s;">
                ${viewOnly ? '✕ CLOSE' : '🔄 PLAY AGAIN'}
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
// showMobileStartOverlay();

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
    currentDifficulty = difficulty; // Store the difficulty

    console.log('Starting game with difficulty:', difficulty);
    switch (difficulty) {
        case 'easy': maxEnemies = 1; break;
        case 'medium': maxEnemies = 2; break;
        case 'hard': maxEnemies = 4; break;
    }
    gameStarted = true;
    // Reset score saved flag for new game
    window.isScoreSavedForThisRun = false;

    // Explicitly reset breathing sound
    soundManager.stopBreathing();

    // Reset player state
    player.isDead = false;
    player.health = player.maxHealth;
    player.finalScore = 0;

    // Blur potential inputs
    if (document.activeElement) document.activeElement.blur();

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
    if (selectedMap === 'house') return;
    selectedMap = 'house';
    updateMapButtons();
    gameMap.clear();
    gameMap.createHouseLevel();
    // Reset player position?
    player.dummyCamera.position.set(0, 2, 10);
});

btnMapCity.addEventListener('click', () => {
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
const buttons = [btnEasy, btnMedium, btnHard];
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

nameInput.addEventListener('input', (e) => {
    // Validation: Only alphanumerics, underscores, hyphens, dollars
    e.target.value = e.target.value.replace(/[^a-zA-Z0-9_$-]/g, '');
    playerName = e.target.value;
    const isValid = playerName.length > 3;
    buttons.forEach(btn => {
        btn.disabled = !isValid;
        btn.style.opacity = isValid ? '1' : '0.5';
        btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
    });
    if (btnShowLeaderboard) {
        btnShowLeaderboard.disabled = !isValid;
        btnShowLeaderboard.style.opacity = isValid ? '1' : '0.5';
        btnShowLeaderboard.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }
});

btnEasy.addEventListener('click', () => { if (playerName.length > 3) startGame('easy'); });
btnMedium.addEventListener('click', () => { if (playerName.length > 3) startGame('medium'); });
btnHard.addEventListener('click', () => { if (playerName.length > 3) startGame('hard'); });

// Handle player death
window.addEventListener('playerDied', async (event) => {
    console.log('Player died event triggered, score:', score);

    // Stop boss music if playing
    soundManager.stopBossAmbient();

    // Disable Leaderboard Button
    if (btnShowLeaderboard) {
        btnShowLeaderboard.disabled = true;
        btnShowLeaderboard.style.opacity = '0.5';
        btnShowLeaderboard.style.cursor = 'not-allowed';
    }

    player.setFinalScore(score);
    const instructions = document.getElementById('instructions');
    // Show loading text while fetching async leaderboard
    instructions.innerHTML = '<h1 style="color:white; text-align:center; margin-top: 200px;">LOADING SCORES...</h1>';
    instructions.style.display = 'block';
    instructions.style.visibility = 'visible';
    instructions.style.opacity = '1';

    // Hide controls
    if (mobileControlsTop) mobileControlsTop.style.display = 'none';

    // Fix: Use global/closure variable instead of 'this'
    if (window.isScoreSavedForThisRun) return;
    window.isScoreSavedForThisRun = true;

    // Explicitly stop breathing sound on death
    soundManager.stopBreathing();

    const leaderboardHTML = await showLeaderboard(score); // false = save score

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
    window.isGamePaused = false;
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

        // Stop breathing sound when paused
        soundManager.stopBreathing();
    }
});

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

    // WASD Fix: Ensure update runs if gameStarted.
    // We remove the strict isLocked check here to allow movement even if lock is technically lost 
    // (e.g. persistent overlay focus issue), as long as gameStarted is true.
    // player.update() has its own isDead check.
    // Pause Logic
    // Desktop: Pause if pointer is unlocked (and not dead)
    // Mobile: Pause if window.isGamePaused is set
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
                        score = Math.max(0, score - 30);
                        updateHUD(); // Assuming updateHUD exists to refresh score display
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
                    if (partName === 'head') {
                        multiplier = 2.0;
                        showMessage('Headshot !!', 700, '#ff0000', '24px');
                        soundManager.playHeadshot();
                    }
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

                            // Spawn Red Potion
                            const redPotion = new RedPotion(scene, deathPosition, particles);
                            potions.push(redPotion);

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
                            const potion = new HealthPotion(scene, deathPosition, particles);
                            potion.spawnTime = performance.now(); // Track spawn time
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
            enemies[i].update(delta, player.position, bullets, gameMap.walls);

            // Clean up enemies that have finished their death animation (isDead = true after 3 seconds)
            if (enemies[i].isDead) {
                enemies[i].remove();
                enemies.splice(i, 1);
                // Note: Points already awarded when enemy was killed by bullet
            }
        }

        // Update Particles
        particles.update(delta);

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
