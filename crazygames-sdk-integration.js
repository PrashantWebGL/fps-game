// CrazyGames SDK Integration Example
// Add this code to your main.js file

// ============================================
// 1. SDK INITIALIZATION (Top of file)
// ============================================

let crazysdk = null;

async function initCrazyGamesSDK() {
    // Check if SDK is available (only on CrazyGames or localhost)
    if (typeof window.CrazyGames !== 'undefined') {
        try {
            crazysdk = window.CrazyGames.SDK;
            await crazysdk.init();
            console.log('✅ CrazyGames SDK initialized successfully');
            return true;
        } catch (error) {
            console.warn('⚠️ CrazyGames SDK initialization failed:', error);
            return false;
        }
    } else {
        console.log('ℹ️ CrazyGames SDK not available (running locally without SDK script)');
        return false;
    }
}

// ============================================
// 2. CALL INITIALIZATION ON GAME LOAD
// ============================================

// Call this when your game loads (before showing menu)
initCrazyGamesSDK();

// ============================================
// 3. GAMEPLAY START EVENT
// ============================================

// Fire this when gameplay actually begins
// (after player clicks difficulty button and game starts)
function onGameplayStart() {
    if (crazysdk) {
        try {
            crazysdk.game.gameplayStart();
            console.log('🎮 Gameplay started event sent');
        } catch (error) {
            console.error('Error sending gameplay start:', error);
        }
    }
}

// Example: Add to your difficulty button click handlers
// document.getElementById('btn-easy').addEventListener('click', () => {
//   startGame('easy');
//   onGameplayStart(); // <-- Add this
// });

// ============================================
// 4. GAMEPLAY STOP EVENT
// ============================================

// Fire this when gameplay ends (player dies or quits)
function onGameplayStop() {
    if (crazysdk) {
        try {
            crazysdk.game.gameplayStop();
            console.log('🛑 Gameplay stopped event sent');
        } catch (error) {
            console.error('Error sending gameplay stop:', error);
        }
    }
}

// Example: Add to your game over logic
// function gameOver() {
//   onGameplayStop(); // <-- Add this
//   showGameOverScreen();
// }

// ============================================
// 5. LOADING EVENTS (Optional but Recommended)
// ============================================

// Fire when loading starts
function onLoadingStart() {
    if (crazysdk) {
        try {
            crazysdk.game.loadingStart();
            console.log('⏳ Loading started event sent');
        } catch (error) {
            console.error('Error sending loading start:', error);
        }
    }
}

// Fire when loading finishes
function onLoadingStop() {
    if (crazysdk) {
        try {
            crazysdk.game.loadingStop();
            console.log('✅ Loading stopped event sent');
        } catch (error) {
            console.error('Error sending loading stop:', error);
        }
    }
}

// Example: If you have asset loading
// async function loadAssets() {
//   onLoadingStart(); // <-- Add this
//   await loadModels();
//   await loadTextures();
//   onLoadingStop(); // <-- Add this
// }

// ============================================
// 6. HAPPY TIME (Ad Breaks - Advanced)
// ============================================

// Optional: Request ad break at natural pause points
// Only use this if you want to show ads during gameplay
async function requestAdBreak() {
    if (crazysdk) {
        try {
            await crazysdk.ad.requestAd('midgame');
            console.log('📺 Ad break completed');
        } catch (error) {
            console.error('Error requesting ad:', error);
        }
    }
}

// Example: Show ad after every 5 levels
// if (currentLevel % 5 === 0) {
//   requestAdBreak();
// }

// ============================================
// 7. USER MODULE (Advanced - For Full Launch)
// ============================================

// Get user information (if logged in)
async function getUserInfo() {
    if (crazysdk) {
        try {
            const user = await crazysdk.user.getUser();
            if (user) {
                console.log('👤 User:', user.username);
                console.log('🖼️ Avatar:', user.profilePictureUrl);
                return user;
            }
        } catch (error) {
            console.error('Error getting user:', error);
        }
    }
    return null;
}

// ============================================
// 8. DATA MODULE (Advanced - Save Progress)
// ============================================

// Save game data to cloud
async function saveGameData(data) {
    if (crazysdk) {
        try {
            await crazysdk.data.setItem('gameProgress', JSON.stringify(data));
            console.log('💾 Game data saved');
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }
}

// Load game data from cloud
async function loadGameData() {
    if (crazysdk) {
        try {
            const data = await crazysdk.data.getItem('gameProgress');
            if (data) {
                console.log('📂 Game data loaded');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    return null;
}

// ============================================
// INTEGRATION CHECKLIST
// ============================================

/*
BASIC LAUNCH (No SDK Required):
- [ ] Just build and submit your game as-is
- [ ] No code changes needed

FULL LAUNCH (SDK Required):
- [ ] Add SDK script to index.html
- [ ] Call initCrazyGamesSDK() on game load
- [ ] Call onGameplayStart() when game begins
- [ ] Call onGameplayStop() when game ends
- [ ] (Optional) Add loading events
- [ ] (Optional) Integrate user module
- [ ] (Optional) Integrate data module
- [ ] Test on localhost before submitting

TESTING:
1. Build: npm run build
2. Preview: npm run preview
3. Open browser console
4. Look for "✅ CrazyGames SDK initialized successfully"
5. Play game and verify events fire correctly
*/

// ============================================
// EXPORT FUNCTIONS (if using modules)
// ============================================

export {
    initCrazyGamesSDK,
    onGameplayStart,
    onGameplayStop,
    onLoadingStart,
    onLoadingStop,
    requestAdBreak,
    getUserInfo,
    saveGameData,
    loadGameData
};
