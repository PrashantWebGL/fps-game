import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3001;

// Game state
const players = new Map(); // socketId -> player data
const rooms = new Map(); // roomId -> Set of socketIds

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Handle player join
    socket.on('join-game', (data) => {
        const { playerName, roomId = 'default' } = data;

        // Add player to room
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);

        // Initialize player data
        const spawnPos = findSafeSpawnPoint(roomId);
        players.set(socket.id, {
            id: socket.id,
            name: playerName || `Player_${Math.floor(Math.random() * 10000)}`,
            position: spawnPos,
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,
            deathCount: 0,
            kills: 0,
            roomId
        });

        // Send current players and initial position to new player
        const roomPlayers = Array.from(rooms.get(roomId))
            .filter(id => id !== socket.id)
            .map(id => players.get(id));

        socket.emit('current-players', roomPlayers);
        socket.emit('initial-spawn', { position: spawnPos });

        // Notify others about new player
        socket.to(roomId).emit('player-joined', players.get(socket.id));

        // Send updated player count
        broadcastPlayerCount(roomId);

        console.log(`${playerName} joined room ${roomId}. Total players: ${rooms.get(roomId).size}`);
    });

    // Handle player movement
    socket.on('player-move', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        player.position = data.position;
        player.rotation = data.rotation;

        // Broadcast to others in the same room
        socket.to(player.roomId).emit('player-moved', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation
        });
    });

    // Handle shooting
    socket.on('player-shoot', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Broadcast to others in the same room
        socket.to(player.roomId).emit('player-shot', {
            id: socket.id,
            origin: data.origin,
            direction: data.direction
        });
    });

    // Handle damage
    socket.on('player-damage', (data) => {
        const { targetId, damage, shooterId } = data;
        const targetPlayer = players.get(targetId);
        const shooter = players.get(shooterId);

        console.log(`Damage received: ${damage} from ${shooter ? shooter.name : 'Unknown'} to ${targetPlayer ? targetPlayer.name : 'Unknown'}`);

        if (!targetPlayer || !shooter) return;

        // CRITICAL: Ignore damage if player is already dead or pending respawn
        if (targetPlayer.health <= 0) {
            console.log(`Ignoring damage: ${targetPlayer.name} is already dead.`);
            return;
        }

        targetPlayer.health -= damage;

        // Notify target player
        io.to(targetId).emit('take-damage', {
            damage,
            shooterId,
            shooterName: shooter.name,
            newHealth: targetPlayer.health
        });

        // Check if player died
        if (targetPlayer.health <= 0) {
            console.log(`PLAYER DIED: ${targetPlayer.name} killed by ${shooter.name}`);
            targetPlayer.health = 0;
            targetPlayer.deathCount++;
            shooter.kills++;

            // Notify the shooter they got a kill (award 1 point)
            console.log(`EMITTING kill-confirmed to ${shooter.name} (${shooterId})`);
            io.to(shooterId).emit('kill-confirmed', {
                victimId: targetId,
                victimName: targetPlayer.name,
                totalKills: shooter.kills
            });

            // Broadcast kill event
            io.to(targetPlayer.roomId).emit('player-killed', {
                killerId: shooterId,
                killerName: shooter.name,
                victimId: targetId,
                victimName: targetPlayer.name
            });

            // Check death limit
            if (targetPlayer.deathCount >= 10) {
                // Get room ranking
                const roomId = targetPlayer.roomId;
                const ranking = Array.from(rooms.get(roomId) || [])
                    .map(id => {
                        const p = players.get(id);
                        return { name: p.name, kills: p.kills, deaths: p.deathCount };
                    })
                    .sort((a, b) => b.kills - a.kills);

                io.to(targetId).emit('death-limit-reached', {
                    deathCount: targetPlayer.deathCount,
                    ranking: ranking
                });

                // REMOVE PLAYER FROM ROOM immediately so they disappear for others
                if (rooms.has(roomId)) {
                    rooms.get(roomId).delete(targetId);
                    // Broadcast to others that this player is out
                    io.to(roomId).emit('player-left', targetId);
                    broadcastPlayerCount(roomId);
                }
            } else {
                // Respawn player after 3 seconds at a safe location
                setTimeout(() => {
                    if (players.has(targetId)) {
                        targetPlayer.health = 100;
                        const spawnPos = findSafeSpawnPoint(targetPlayer.roomId);
                        spawnPos.x -= Math.random() * 6;
                        spawnPos.z -= Math.random() * 6;
                        targetPlayer.position = spawnPos;

                        io.to(targetId).emit('respawn', {
                            health: 100,
                            position: spawnPos
                        });
                    }
                }, 3000);
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player) {
            const roomId = player.roomId;

            // Remove from room
            if (rooms.has(roomId)) {
                rooms.get(roomId).delete(socket.id);
                if (rooms.get(roomId).size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Notify others
                    socket.to(roomId).emit('player-left', socket.id);
                    broadcastPlayerCount(roomId);
                }
            }

            players.delete(socket.id);
            console.log(`Player disconnected: ${socket.id}. Remaining: ${players.size}`);
        }
    });
});

// Helper function to broadcast player count
function broadcastPlayerCount(roomId) {
    if (!rooms.has(roomId)) return;

    const count = rooms.get(roomId).size;
    io.to(roomId).emit('player-count-update', count);
}

// Helper function to find a spawn point away from other players
function findSafeSpawnPoint(roomId) {
    const roomPlayers = Array.from(rooms.get(roomId) || [])
        .map(id => players.get(id))
        .filter(p => p);

    let bestSpawn = { x: (Math.random() - 0.5) * 100, y: 0, z: (Math.random() - 0.5) * 100 };
    let maxMinDist = -1;

    // Try 20 random locations for better variety
    for (let i = 0; i < 20; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const testPos = { x, y: 0, z };

        let minDistToOthers = 1000;
        if (roomPlayers.length > 0) {
            for (const p of roomPlayers) {
                const dist = Math.sqrt(Math.pow(x - p.position.x, 2) + Math.pow(z - p.position.z, 2));
                if (dist < minDistToOthers) minDistToOthers = dist;
            }
        }

        if (minDistToOthers > maxMinDist) {
            maxMinDist = minDistToOthers;
            bestSpawn = testPos;
        }
    }

    return bestSpawn;
}

httpServer.listen(PORT, () => {
    console.log(`🎮 Multiplayer server running on port ${PORT}`);
});
