import * as THREE from 'three';
import { createSoldierModel } from './soldierModel.js';

export class MultiplayerManager {
    constructor(scene, localPlayer) {
        this.scene = scene;
        this.localPlayer = localPlayer;
        this.socket = null;
        this.remotePlayers = new Map(); // playerId -> { mesh, data }
        this.isConnected = false;
        this.playerCount = 1; // Start with local player
        this.serverUrl = 'https://epicshooter3d.onrender.com';

        // Callbacks
        this.onKillConfirmed = null;
        this.onDeathLimitReached = null;
    }

    connect(playerName) {
        return new Promise((resolve, reject) => {
            // Load Socket.IO from CDN (already in index.html)
            if (typeof io === 'undefined') {
                reject(new Error('Socket.IO not loaded'));
                return;
            }

            this.socket = io(this.serverUrl);

            this.socket.on('connect', () => {
                console.log('Connected to multiplayer server');
                this.isConnected = true;

                // Listen for initial spawn position
                this.socket.once('initial-spawn', (data) => {
                    console.log('Received initial spawn:', data.position);
                    resolve(data.position);
                });

                // Join the game
                this.socket.emit('join-game', {
                    playerName: playerName || `Player_${Math.floor(Math.random() * 10000)}`,
                    roomId: 'default'
                });
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.isConnected = false;
                reject(error);
            });

            // Listen for current players
            this.socket.on('current-players', (players) => {
                console.log('Current players:', players);
                players.forEach(player => this.addRemotePlayer(player));
            });

            // Listen for new players
            this.socket.on('player-joined', (player) => {
                console.log('Player joined:', player.name);
                this.addRemotePlayer(player);
            });

            // Listen for player movement
            this.socket.on('player-moved', (data) => {
                const remotePlayer = this.remotePlayers.get(data.id);
                if (remotePlayer) {
                    remotePlayer.data.position = data.position;
                    remotePlayer.data.rotation = data.rotation;

                    // Update mesh position (grounded at y=0, assuming data.position is camera height y=2)
                    remotePlayer.mesh.position.set(data.position.x, 0, data.position.z);

                    // Rotate the model container to match player rotation (Y-axis only)
                    remotePlayer.mesh.rotation.y = data.rotation.y;
                }
            });

            // Listen for player shots
            this.socket.on('player-shot', (data) => {
                // Visual feedback for remote player shooting
                const remotePlayer = this.remotePlayers.get(data.id);
                if (remotePlayer) {
                    this.createMuzzleFlash(remotePlayer.mesh.position);
                }
            });

            // Listen for damage
            this.socket.on('take-damage', (data) => {
                console.log(`Taking ${data.damage} damage from ${data.shooterName}`);
                this.localPlayer.takeDamage(data.damage);
            });

            // Listen for kills
            this.socket.on('player-killed', (data) => {
                console.log(`${data.killerName} killed ${data.victimName}`);
                this.showKillFeed(data.killerName, data.victimName);

                // Remove victim's mesh temporarily if it's a remote player
                if (data.victimId !== this.socket.id) {
                    const victim = this.remotePlayers.get(data.victimId);
                    if (victim) {
                        victim.mesh.visible = false;
                        setTimeout(() => {
                            if (victim.mesh) victim.mesh.visible = true;
                        }, 3000);
                    }
                }
            });

            // Listen for respawn
            this.socket.on('respawn', (data) => {
                console.log('Respawning with full health at:', data.position);
                this.localPlayer.health = 100; // Force 100
                this.localPlayer.isDead = false;

                // Update HUD immediately
                const healthFill = document.getElementById('health-fill');
                const healthValue = document.getElementById('health-value');
                if (healthFill) healthFill.style.width = '100%';
                if (healthValue) healthValue.innerText = '100';

                if (data.position) {
                    console.log('CLIENT: Setting new position:', data.position);
                    data.position.x += Math.random() * 13;
                    data.position.z += Math.random() * 13;
                    this.localPlayer.dummyCamera.position.set(data.position.x, 2, data.position.z);
                    if (this.localPlayer.velocity) {
                        this.localPlayer.velocity.set(0, 0, 0);
                    }
                    this.localPlayer.dummyCamera.updateMatrixWorld(true);
                }
            });

            // Listen for kill confirmation (award points)
            this.socket.on('kill-confirmed', (data) => {
                console.log('KILL CONFIRMED RECEIVED:', data);
                if (this.onKillConfirmed) {
                    this.onKillConfirmed(data);
                }
            });

            // Listen for death limit
            this.socket.on('death-limit-reached', (data) => {
                if (this.onDeathLimitReached) {
                    this.onDeathLimitReached(data); // data contains { deathCount, ranking }
                }
            });

            // Listen for player leaving
            this.socket.on('player-left', (playerId) => {
                console.log('Player left:', playerId);
                this.removeRemotePlayer(playerId);
            });

            // Listen for player count updates
            this.socket.on('player-count-update', (count) => {
                this.playerCount = count;
                this.updatePlayerCountUI(count);
            });
        });
    }

    addRemotePlayer(playerData) {
        if (this.remotePlayers.has(playerData.id)) return;

        // Use the proper soldier model instead of a simple capsule
        const color = playerData.color || this.getRandomPlayerColor();
        const mesh = createSoldierModel(color);

        // Position at feet level (y=0), but use the x/z from received position
        mesh.position.set(
            playerData.position.x,
            0,
            playerData.position.z
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add name tag
        const nameTag = this.createNameTag(playerData.name);
        nameTag.position.y = 2.8; // Raised higher as requested
        nameTag.raycast = () => null; // Disable raycasting to prevent crashes with bullets
        mesh.add(nameTag);

        this.scene.add(mesh);

        this.remotePlayers.set(playerData.id, {
            mesh,
            data: playerData
        });

        console.log(`Added remote player: ${playerData.name}`);
    }

    removeRemotePlayer(playerId) {
        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            this.scene.remove(remotePlayer.mesh);
            remotePlayer.mesh.geometry.dispose();
            remotePlayer.mesh.material.dispose();
            this.remotePlayers.delete(playerId);
        }
    }

    createNameTag(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = 'Bold 24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(name, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 0.5, 1);

        return sprite;
    }

    getRandomPlayerColor() {
        const colors = [0xff4444, 0x4444ff, 0x44ff44, 0xffff44, 0xff44ff, 0x44ffff];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createMuzzleFlash(position) {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const flash = new THREE.Mesh(geometry, material);
        flash.position.copy(position);
        this.scene.add(flash);

        setTimeout(() => {
            this.scene.remove(flash);
            geometry.dispose();
            material.dispose();
        }, 50);
    }

    sendPosition(position, rotation) {
        if (!this.isConnected || !this.socket) return;

        this.socket.emit('player-move', {
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
        });
    }

    sendShot(origin, direction) {
        if (!this.isConnected || !this.socket) return;

        this.socket.emit('player-shoot', {
            origin: { x: origin.x, y: origin.y, z: origin.z },
            direction: { x: direction.x, y: direction.y, z: direction.z }
        });
    }

    sendDamage(targetId, damage) {
        if (!this.isConnected || !this.socket) return;
        console.log(`CLIENT: Sending damage ${damage} to ${targetId}`);
        this.socket.emit('player-damage', {
            targetId,
            damage,
            shooterId: this.socket.id
        });
    }

    showKillFeed(killerName, victimName) {
        const killFeed = document.getElementById('kill-feed');
        if (!killFeed) return;

        const killMessage = document.createElement('div');
        killMessage.className = 'kill-message';
        killMessage.textContent = `${killerName} killed ${victimName}`;
        killMessage.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 12px;
      margin-bottom: 5px;
      border-radius: 4px;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

        killFeed.appendChild(killMessage);

        // Limit to 5 messages
        while (killFeed.children.length > 5) {
            killFeed.removeChild(killFeed.firstChild);
        }

        // Remove after 5 seconds
        setTimeout(() => {
            if (killFeed.contains(killMessage)) {
                killMessage.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (killFeed.contains(killMessage)) killMessage.remove();
                }, 300);
            }
        }, 5000);
    }

    updatePlayerCountUI(count) {
        const playerCountEl = document.getElementById('player-count');
        if (playerCountEl) {
            playerCountEl.textContent = `(Beta Mode)Players Online: ${count}`;
        }
    }

    getRemotePlayers() {
        return Array.from(this.remotePlayers.values());
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }

        // Clean up remote players
        this.remotePlayers.forEach((player, id) => {
            this.removeRemotePlayer(id);
        });
    }

    update() {
        // Smooth interpolation for remote players could go here
        // For now, positions are updated directly in the event handlers
    }
}
