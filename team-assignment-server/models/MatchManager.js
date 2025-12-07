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
            avatarId: metadata.avatarId || 0,
            team: null, // Will be set when teams are assigned
            updatedAt: new Date().toISOString()
        };
        
        await this.redis.set(`metadata:${playerId}`, JSON.stringify(playerMetadata), 'EX', 7200); // 2 hour TTL
        console.log(`Metadata set for player ${playerId}`);
        
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
        const metadata = await this._getPlayerMetadata(playerId);
        if (metadata) {
            metadata.team = team;
            metadata.order = order;
            metadata.updatedAt = new Date().toISOString();
            await this.redis.set(`metadata:${playerId}`, JSON.stringify(metadata), 'EX', 7200);
        }
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
            teams: {
                team0,
                team1,
                unassigned
            }
        };
    }
    
    async registerPlayer(matchId, playerId, playerName = 'Unknown', lobbyId = null) {
        let match = await this._getMatch(matchId);
        
        if (!match) {
            match = {
                matchId,
                players: new Map(),
                teamsAssigned: false,
                createdAt: new Date(),
                maxPlayers: this.maxPlayers
            };
            console.log(`Created new match: ${matchId}`);
        }
        
        // Check if match is full
        if (match.players.size >= this.maxPlayers) {
            return {
                success: false,
                message: 'Match already full',
                matchId
            };
        }
        
        // Check if player already registered
        if (match.players.has(playerId)) {
            return {
                success: true,
                message: 'Player already registered',
                matchId,
                playerId,
                registeredPlayers: match.players.size,
                teamsAssigned: match.teamsAssigned
            };
        }
        
        // Register player
        match.players.set(playerId, {
            playerId,
            playerName,
            lobbyId: lobbyId || null,
            team: null,
            order: null,
            registeredAt: new Date()
        });
        
        console.log(`Player ${playerId} registered for match ${matchId} (${match.players.size}/${this.maxPlayers})`);
        
        // Assign teams if match is full
        if (match.players.size >= this.maxPlayers && !match.teamsAssigned) {
            TeamAssigner.assignTeams(match);
            match.teamsAssigned = true;
            console.log(`Teams assigned for match ${matchId}`);
            
            // Update metadata with team assignments
            for (const [playerId, playerData] of match.players) {
                await this._updatePlayerMetadataTeam(playerId, playerData.team, playerData.order);
            }
        }

        // Save to Redis
        await this._saveMatch(match);
        
        return {
            success: true,
            message: match.teamsAssigned ? 'Player registered - teams assigned' : 'Player registered successfully',
            matchId,
            playerId,
            registeredPlayers: match.players.size,
            teamsAssigned: match.teamsAssigned
        };
    }
    
    async getTeamAssignment(matchId, playerId) {
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
                registeredPlayers: match.players.size
            };
        }

        return {
            success: true,
            playerId,
            team: player.team,
            order: player.order,
            matchId,
            message: 'Team assignment found'
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
