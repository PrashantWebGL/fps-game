# CrazyGames Submission Guide

## 📋 Overview

This guide will help you prepare and submit your **Epic Shooter 3D** FPS game to CrazyGames platform.

## 🎯 Submission Options

### Option 1: Basic Launch (Recommended First)
- ✅ No SDK integration required
- ✅ Quick submission process
- ✅ 2-week trial period with limited audience
- ❌ No monetization (ads disabled)
- ❌ No user accounts/data saving

### Option 2: Full Launch (For Monetization)
- ✅ Full monetization enabled (revenue share)
- ✅ User accounts and data saving
- ✅ Permanent listing
- ⚠️ Requires CrazyGames SDK integration
- ⚠️ More complex setup

---

## 🚀 Quick Start: Basic Launch (No SDK)

### Step 1: Build Your Game

```bash
# Navigate to your project directory
cd /Users/prashantdhawase/Work/Antigravity\ projects/fps-game

# Build production version
npm run build

# Check build size
du -sh dist/
find dist/ -type f | wc -l
```

**Requirements Check:**
- ✅ Initial download: < 50MB (< 20MB for mobile homepage)
- ✅ Total size: < 250MB
- ✅ File count: < 1500 files

### Step 2: Create Submission ZIP

```bash
# Create a ZIP file of your dist folder
cd dist
zip -r ../epic-shooter-3d-crazygames.zip .
cd ..
```

### Step 3: Prepare Game Metadata

**Game Information:**
- **Title:** Epic Shooter 3D
- **Category:** Action, Shooting, 3D
- **Description:** (See below)
- **Tags:** fps, shooter, 3d, action, survival, combat
- **Platforms:** Desktop + Mobile
- **Orientation:** Landscape

**Recommended Description:**
```
Epic Shooter 3D is an intense first-person shooter built with cutting-edge web technology. Battle against intelligent AI enemies across three difficulty levels. Features realistic physics, cross-platform controls, and addictive gameplay.

FEATURES:
• Realistic 3D graphics powered by Three.js
• Smart AI enemies that chase, shoot, and take cover
• Damage system: Headshots (2x), Torso (1x), Limbs (0.5x)
• Health potions spawn every 6th kill
• Three difficulty levels: Easy, Medium, Hard
• Full mobile support with virtual joysticks
• Smooth 60 FPS gameplay

CONTROLS:
Desktop: WASD/Arrow keys to move, Mouse to aim, Click to shoot, Space to jump
Mobile: Left joystick to move, Drag right side to look, Tap buttons to shoot/jump
```

### Step 4: Prepare Screenshots

You'll need **5-10 screenshots** showing:
1. Main menu / Start screen
2. Gameplay action (shooting enemies)
3. Mobile controls view
4. Different difficulty levels
5. Health potion pickup
6. Score display
7. Third-person view (press 3)

**Screenshot Requirements:**
- Format: PNG or JPG
- Resolution: 1920x1080 or higher
- Show actual gameplay, not just UI

### Step 5: Submit to CrazyGames

1. Go to [CrazyGames Developer Portal](https://developer.crazygames.com/)
2. Create an account or log in
3. Click "Submit Game"
4. Upload your ZIP file (`epic-shooter-3d-crazygames.zip`)
5. Fill in game metadata (title, description, tags)
6. Upload screenshots
7. Select platforms (Desktop + Mobile)
8. Submit for review

**Review Time:** Usually 1-3 business days

---

## 🔧 Advanced: Full Launch with SDK Integration

### Why Integrate the SDK?

- 💰 Enable monetization (revenue share from ads)
- 👤 User account system (save progress across devices)
- 📊 Analytics and insights
- 🎮 Better player engagement

### SDK Integration Steps

#### 1. Add SDK Script to HTML

Edit `index.html` and add this in the `<head>` section:

```html
<!-- CrazyGames SDK -->
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

#### 2. Initialize SDK in Your Game

Add to `src/main.js` at the top:

```javascript
// Initialize CrazyGames SDK
let crazysdk = null;

async function initCrazyGamesSDK() {
  if (typeof window.CrazyGames !== 'undefined') {
    try {
      crazysdk = window.CrazyGames.SDK;
      await crazysdk.init();
      console.log('CrazyGames SDK initialized');
    } catch (error) {
      console.log('CrazyGames SDK not available (local dev):', error);
    }
  }
}

// Call this before starting your game
initCrazyGamesSDK();
```

#### 3. Add Gameplay Events

**When game starts** (after clicking difficulty button):

```javascript
// Fire when gameplay actually begins
if (crazysdk) {
  crazysdk.game.gameplayStart();
}
```

**When game ends** (player dies or quits):

```javascript
// Fire when gameplay stops
if (crazysdk) {
  crazysdk.game.gameplayStop();
}
```

#### 4. Add Loading Events (Optional but Recommended)

```javascript
// When loading starts
if (crazysdk) {
  crazysdk.game.loadingStart();
}

// When loading finishes
if (crazysdk) {
  crazysdk.game.loadingStop();
}
```

#### 5. Test SDK Integration

The SDK will only work when:
- Hosted on CrazyGames domains, OR
- Running on `localhost` or `127.0.0.1`

To test locally:
```bash
npm run build
npm run preview
# Open http://localhost:4173 (or similar)
```

Check browser console for "CrazyGames SDK initialized" message.

---

## 📦 File Structure for Submission

Your `dist` folder should contain:

```
dist/
├── index.html          # Main HTML file (entry point)
├── assets/             # All JS, CSS, images, models
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [other assets]
└── vite.svg           # Favicon (optional)
```

**Important:** The ZIP file should contain the **contents** of the `dist` folder, not the `dist` folder itself. When unzipped, `index.html` should be at the root level.

---

## ✅ Pre-Submission Checklist

### Technical Requirements
- [ ] Game builds without errors (`npm run build`)
- [ ] Initial download size < 50MB
- [ ] Total size < 250MB
- [ ] File count < 1500 files
- [ ] Works on Chrome and Edge browsers
- [ ] No console errors during gameplay
- [ ] Maintains 60 FPS on average hardware

### Gameplay Requirements
- [ ] Mouse controls work (desktop)
- [ ] Keyboard controls work (WASD + Arrow keys)
- [ ] Touch controls work (mobile)
- [ ] Game is playable and fun
- [ ] No game-breaking bugs
- [ ] Clear win/lose conditions
- [ ] Score system works correctly

### Content Requirements
- [ ] Game is in English (or has English option)
- [ ] Content is PEGI 12 compliant (suitable for 13+)
- [ ] No copyrighted music/assets
- [ ] Original game name (not trademarked)
- [ ] No external links or ads (CrazyGames handles ads)

### SDK Requirements (Full Launch Only)
- [ ] SDK script added to HTML
- [ ] SDK initialized on game load
- [ ] `gameplayStart()` fires when game begins
- [ ] `gameplayStop()` fires when game ends
- [ ] Tested on localhost

### Metadata & Assets
- [ ] Game title decided
- [ ] Description written (100-500 words)
- [ ] 5-10 screenshots prepared
- [ ] Tags selected (relevant categories)
- [ ] Thumbnail/icon created (512x512px recommended)

---

## 🎮 Testing Your Build

### Local Testing

```bash
# Build and preview
npm run build
npm run preview

# Open in browser (usually http://localhost:4173)
```

**Test these scenarios:**
1. ✅ Desktop controls (WASD, mouse, click, space)
2. ✅ Mobile controls (open DevTools, toggle device toolbar)
3. ✅ All difficulty levels (Easy, Medium, Hard)
4. ✅ Health system (take damage, collect potions)
5. ✅ Score system (kill enemies, check score)
6. ✅ Game over screen
7. ✅ Third-person view (press 3)

### Browser Compatibility

Test on:
- ✅ Chrome (required)
- ✅ Edge (required)
- ⚠️ Safari (optional, but recommended)
- ⚠️ Firefox (optional)

### Mobile Testing

Use Chrome DevTools:
1. Open DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select a mobile device (iPhone, Android)
4. Test touch controls

---

## 📊 Post-Submission

### What Happens Next?

1. **Review Period:** 1-3 business days
2. **Feedback:** CrazyGames may request changes
3. **Approval:** Game goes live on platform
4. **Monitoring:** Track plays, engagement, revenue (if monetized)

### Common Rejection Reasons

- ❌ File size too large
- ❌ Game doesn't work on Chrome/Edge
- ❌ Poor mobile experience
- ❌ Console errors or crashes
- ❌ Copyrighted content
- ❌ Inappropriate content (not PEGI 12)
- ❌ Broken controls
- ❌ Missing SDK integration (for Full Launch)

### If Rejected

1. Read feedback carefully
2. Make requested changes
3. Test thoroughly
4. Resubmit

---

## 🔍 Troubleshooting

### Build Issues

**Problem:** Build fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Problem:** Build size too large
- Compress images/textures
- Remove unused dependencies
- Enable Vite compression
- Consider lazy loading assets

### SDK Issues

**Problem:** SDK not initializing
- Check browser console for errors
- Verify SDK script is loaded
- Test on localhost (not file://)
- Ensure async/await is used correctly

**Problem:** Events not firing
- Add console.log to verify code execution
- Check if `crazysdk` is defined
- Verify events are called at correct times

### Gameplay Issues

**Problem:** Controls don't work
- Test on different browsers
- Check for JavaScript errors
- Verify event listeners are attached
- Test both desktop and mobile

**Problem:** Performance issues
- Check FPS in DevTools
- Optimize Three.js rendering
- Reduce enemy count
- Simplify graphics

---

## 📞 Support

- **CrazyGames Developer Portal:** https://developer.crazygames.com/
- **SDK Documentation:** https://docs.crazygames.com/
- **Developer Discord:** Available through developer portal
- **Email Support:** Contact through developer portal

---

## 🎉 Success Tips

1. **Start with Basic Launch** - Get your game live quickly, then upgrade
2. **Test Thoroughly** - Play your game on different devices/browsers
3. **Optimize Performance** - Aim for consistent 60 FPS
4. **Good Screenshots** - First impression matters
5. **Clear Description** - Help players understand your game
6. **Engage with Feedback** - Respond to player comments
7. **Update Regularly** - Fix bugs and add features based on feedback

---

## 📝 Quick Command Reference

```bash
# Development
npm run dev                    # Run dev server

# Production Build
npm run build                  # Build for production
npm run preview               # Preview production build

# Check Build
du -sh dist/                  # Check total size
find dist/ -type f | wc -l    # Count files
ls -lh dist/index.html        # Check HTML size

# Create Submission ZIP
cd dist && zip -r ../epic-shooter-3d-crazygames.zip . && cd ..

# Clean Build
rm -rf dist node_modules
npm install
npm run build
```

---

Good luck with your submission! 🚀🎮
