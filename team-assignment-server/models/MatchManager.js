const TeamAssigner = require('../utils/TeamAssigner');
const { getRedisClient } = require('../config/redis');

class MatchManager {
    constructor() {
        this.maxPlayers = 6;
        this.redis = null;
        
        // Cleanup old matches every 30 minutes
        setInterval(() => this.cleanup(), 30 * 60 * 1000);
    }

    initialize() {
        this.redis = getRedisClient();
        console.log('MatchManager initialized with Redis');
    }

    async _getMatch(matchId) {
        const data = await this.redis.get(`match:${matchId}`);
        if (!data) return null;
        
        const match = JSON.parse(data);
        // Convert players array back to Map
        match.players = new Map(match.players);
        match.createdAt = new Date(match.createdAt);
        return match;
    }

    async _saveMatch(match) {
        // Convert players Map to array for JSON serialization
        const matchData = {
            ...match,
            players: Array.from(match.players.entries())
        };
        await this.redis.set(`match:${match.matchId}`, JSON.stringify(matchData), 'EX', 7200); // 2 hour TTL
    }

    async setPlayerMetadata(playerId, metadata) {
        // Store metadata with validation
        const playerMetadata = {
            name: metadata.name || 'Unknown',
            level: metadata.level || 1,
            avatarId: metadata.avatarId ?? 0,
            rank: metadata.rank || 'Unranked',
            team: null, // Will be set when teams are assigned
            updatedAt: new Date().toISOString()
        };
        
        await this.redis.set(`metadata:${playerId}`, JSON.stringify(playerMetadata), 'EX', 7200); // 2 hour TTL
        console.log(`Metadata set for player ${playerId}:`, JSON.stringify(playerMetadata));
        
        return {
            success: true,
            message: 'Player metadata saved',
            playerId,
            metadata: playerMetadata
        };
    }

    async _getPlayerMetadata(playerId) {
        const data = await this.redis.get(`metadata:${playerId}`);
        if (!data) return null;
        return JSON.parse(data);
    }

    async _updatePlayerMetadataTeam(playerId, team, order) {
        let metadata = await this._getPlayerMetadata(playerId);
        if (!metadata) {
            // Create fallback metadata if the client hasn't set it yet
            metadata = {
                name: 'Unknown',
                level: 1,
                avatarId: 0,
                rank: 'Unranked',
                team: null,
                order: null,
                updatedAt: new Date().toISOString()
            };
        }

        metadata.team = team;
        metadata.order = order;
        metadata.updatedAt = new Date().toISOString();
        await this.redis.set(`metadata:${playerId}`, JSON.stringify(metadata), 'EX', 7200);
    }

    async getMatchMetadata(matchId) {
        const match = await this._getMatch(matchId);
        
        if (!match) {
            return {
                success: false,
                message: 'Match not found',
                matchId
            };
        }

        // Fetch metadata for all players in the match
        const playersMetadata = [];
        for (const [playerId, playerData] of match.players) {
            const metadata = await this._getPlayerMetadata(playerId);
            
            if (metadata) {
                playersMetadata.push({
                    playerId,
                    name: metadata.name,
                    level: metadata.level,
                    avatarId: metadata.avatarId,
                    rank: metadata.rank,
                    team: metadata.team,
                    order: metadata.order,
                    lobbyId: playerData.lobbyId
                });
            } else {
                // Fallback if no metadata set
                playersMetadata.push({
                    playerId,
                    name: playerData.playerName || 'Unknown',
                    level: 1,
                    avatarId: 0,
                    rank: 'Unranked',
                    team: playerData.team,
                    order: playerData.order,
                    lobbyId: playerData.lobbyId
                });
            }
        }

        // Group by teams
        const team0 = playersMetadata.filter(p => p.team === 0).sort((a, b) => (a.order || 0) - (b.order || 0));
        const team1 = playersMetadata.filter(p => p.team === 1).sort((a, b) => (a.order || 0) - (b.order || 0));
        const unassigned = playersMetadata.filter(p => p.team === null);

        return {
            success: true,
            matchId,
            teamsAssigned: match.teamsAssigned,
            totalPlayers: match.maxPlayers,
            registeredPlayers: match.players.size,
            map: match.map,
            teams: {
                team0,
                team1,
                unassigned
            }
        };
    }
    
    async registerPlayer(matchId, playerId, playerName = 'Unknown', lobbyId = null) {
        const key = `match:${matchId}`;

        // Simple distributed lock using SET NX PX to ensure only one process mutates the match at a time.
        const lockKey = `lock:match:${matchId}`;
        const lockTtl = 10000; // Increased to 10s to accommodate metadata updates within lock
        const acquireAttempts = 20; // Increased attempts for better retry behavior

        const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        for (let attempt = 0; attempt < acquireAttempts; attempt++) {
            const ok = await this.redis.set(lockKey, token, 'NX', 'PX', lockTtl);
            if (ok) {
                try {
                    // We hold the lock — safe to read/modify/write
                    const raw = await this.redis.get(key);
                    let stored = null;
                    if (!raw) {
                        stored = {
                            matchId,
                            players: [],
                            teamsAssigned: false,
                            createdAt: new Date().toISOString(),
                            maxPlayers: this.maxPlayers,
                            map: Math.floor(Math.random() * 2) + 1
                        };
                        console.log(`Creating new match ${matchId} (map ${stored.map})`);
                    } else {
                        try {
                            stored = JSON.parse(raw);
                        } catch (err) {
                            console.error('Failed to parse match JSON from Redis', err);
                            return { success: false, message: 'Internal server error parsing match data' };
                        }
                    }

                    // Convert players array back to Map for in-memory manipulation
                    const playersMap = new Map();
                    if (Array.isArray(stored.players)) {
                        for (const [pid, pdata] of stored.players) {
                            playersMap.set(pid, pdata);
                        }
                    }

                    // Check full
                    if (playersMap.size >= this.maxPlayers) {
                        return {
                            success: false,
                            message: 'Match already full',
                            matchId
                        };
                    }

                    // Already registered
                    if (playersMap.has(playerId)) {
                        return {
                            success: true,
                            message: 'Player already registered',
                            matchId,
                            playerId,
                            registeredPlayers: playersMap.size,
                            teamsAssigned: !!stored.teamsAssigned
                        };
                    }

                    // Add player
                    playersMap.set(playerId, {
                        playerId,
                        playerName,
                        lobbyId: lobbyId || null,
                        team: null,
                        order: null,
                        registeredAt: new Date().toISOString()
                    });

                    // Prepare a match-like object for TeamAssigner which expects a Map in `players`
                    const tempMatch = {
                        matchId,
                        players: playersMap,
                        teamsAssigned: !!stored.teamsAssigned,
                        createdAt: stored.createdAt || new Date().toISOString(),
                        maxPlayers: this.maxPlayers,
                        map: stored.map || Math.floor(Math.random() * 2) + 1
                    };

                    // If match becomes full now, assign teams deterministically
                    if (playersMap.size >= this.maxPlayers && !tempMatch.teamsAssigned) {
                        TeamAssigner.assignTeams(tempMatch);
                        tempMatch.teamsAssigned = true;
                        
                        // VALIDATION: Verify all players have valid team assignments
                        let assignmentValid = true;
                        const teamCounts = { 0: 0, 1: 0 };
                        
                        for (const [pid, pdata] of tempMatch.players) {
                            if (pdata.team !== 0 && pdata.team !== 1) {
                                console.error(`CRITICAL: Player ${pid} has invalid team: ${pdata.team}`);
                                assignmentValid = false;
                            }
                            if (pdata.order === null || pdata.order === undefined) {
                                console.error(`CRITICAL: Player ${pid} has no order assigned`);
                                assignmentValid = false;
                            }
                            teamCounts[pdata.team]++;
                        }
                        
                        if (!assignmentValid) {
                            console.error(`CRITICAL: Team assignment validation failed for match ${matchId}`);
                            return {
                                success: false,
                                message: 'Team assignment failed validation',
                                matchId
                            };
                        }
                        
                        console.log(`Teams assigned for match ${matchId}: Team 0 = ${teamCounts[0]}, Team 1 = ${teamCounts[1]}`);
                        
                        // CRITICAL: Persist metadata updates BEFORE saving match and releasing lock
                        // This prevents race condition where other players query before metadata is set
                        for (const [pid, pdata] of tempMatch.players) {
                            await this._updatePlayerMetadataTeam(pid, pdata.team, pdata.order);
                        }
                        console.log(`All player metadata updated for match ${matchId}`);
                    }

                    // Serialize players Map to array for storage
                    const matchData = {
                        ...tempMatch,
                        players: Array.from(tempMatch.players.entries()),
                        createdAt: (tempMatch.createdAt instanceof Date) ? tempMatch.createdAt.toISOString() : tempMatch.createdAt
                    };

                    // Save match to Redis - this is the final atomic operation
                    await this.redis.set(key, JSON.stringify(matchData), 'EX', 7200);

                    return {
                        success: true,
                        message: tempMatch.teamsAssigned ? 'Player registered - teams assigned' : 'Player registered successfully',
                        matchId,
                        playerId,
                        registeredPlayers: tempMatch.players.size,
                        teamsAssigned: tempMatch.teamsAssigned,
                        map: tempMatch.map
                    };
                } finally {
                    // Release lock only if we still own it
                    try {
                        const cur = await this.redis.get(lockKey);
                        if (cur === token) {
                            await this.redis.del(lockKey);
                        }
                    } catch (e) {
                        console.error('Error releasing lock', e);
                    }
                }
            }

            // Failed to acquire lock, wait a bit and retry
            await sleep(50 + Math.floor(Math.random() * 100));
        }

        return {
            success: false,
            message: 'Could not register player due to concurrent updates, please retry',
            matchId
        };
    }
    
    async getTeamAssignment(matchId, playerId) {
        // Simple retry logic for eventual consistency
        let retries = 3;
        let lastError = null;
        
        while (retries > 0) {
            try {
                const match = await this._getMatch(matchId);
                
                if (!match) {
                    return {
                        success: false,
                        message: 'Match not found',
                        matchId,
                        playerId,
                        notFound: true
                    };
                }
                
                const player = match.players.get(playerId);
                
                if (!player) {
                    return {
                        success: false,
                        message: 'Player not found in match',
                        matchId,
                        playerId,
                        notFound: true
                    };
                }
                
                // If teams are not assigned yet, return team as null so clients always receive a 'team' field.
                if (!match.teamsAssigned || player.team === null) {
                    return {
                        success: true,
                        message: 'Teams not assigned yet',
                        matchId,
                        playerId,
                        team: null,
                        order: null,
                        registeredPlayers: match.players.size,
                        map: match.map
                    };
                }

                // DEFENSIVE: Verify team assignment integrity
                if (player.team !== 0 && player.team !== 1) {
                    console.error(`Invalid team value for player ${playerId}: ${player.team} (attempt ${4-retries}/3)`);
                    lastError = 'Invalid team assignment detected';
                    retries--;
                    if (retries > 0) await new Promise(r => setTimeout(r, 100)); // 100ms retry delay
                    continue;
                }

                if (player.order === null || player.order === undefined) {
                    console.error(`Missing order for player ${playerId} in team ${player.team} (attempt ${4-retries}/3)`);
                    lastError = 'Incomplete team assignment detected';
                    retries--;
                    if (retries > 0) await new Promise(r => setTimeout(r, 100)); // 100ms retry delay
                    continue;
                }

                return {
                    success: true,
                    playerId,
                    team: player.team,
                    order: player.order,
                    matchId,
                    message: 'Team assignment found',
                    map: match.map
                };
            } catch (error) {
                console.error(`Error fetching team assignment (attempt ${4-retries}/3):`, error);
                lastError = error.message;
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 100));
            }
        }
        
        // All retries exhausted
        return {
            success: false,
            message: lastError || 'Failed to get team assignment after retries',
            matchId,
            playerId
        };
    }
    
    async getMatchStatus(matchId) {
        const match = await this._getMatch(matchId);
        
        if (!match) {
            return {
                success: false,
                message: 'Match not found',
                matchId
            };
        }
        
        return {
            success: true,
            matchId,
            totalPlayers: this.maxPlayers,
            registeredPlayers: match.players.size,
            teamsAssigned: match.teamsAssigned,
            map: match.map,
            players: Array.from(match.players.values())
        };
    }
    
    async cleanup() {
        // Redis TTL handles automatic cleanup, but we can scan for old matches if needed
        console.log('Cleanup triggered - Redis TTL handles expiration automatically');
        
        // Optional: Scan and manually clean up old matches
        const pattern = 'match:*';
        const stream = this.redis.scanStream({
            match: pattern,
            count: 100
        });

        const now = new Date();
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours

        stream.on('data', async (keys) => {
            for (const key of keys) {
                const data = await this.redis.get(key);
                if (data) {
                    const match = JSON.parse(data);
                    const createdAt = new Date(match.createdAt);
                    if (now - createdAt > maxAge) {
                        await this.redis.del(key);
                        console.log(`Cleaned up expired match: ${match.matchId}`);
                    }
                }
            }
        });

        stream.on('end', () => {
            console.log('Cleanup scan completed');
        });
    }
}

module.exports = new MatchManager();
