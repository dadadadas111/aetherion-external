const TeamAssigner = require('../utils/TeamAssigner');

class MatchManager {
    constructor() {
        this.matches = new Map(); // matchId -> Match object
        this.maxPlayers = 6;
        
        // Cleanup old matches every 30 minutes
        setInterval(() => this.cleanup(), 30 * 60 * 1000);
    }
    
    registerPlayer(matchId, playerId, playerName = 'Unknown', lobbyId = null) {
        let match = this.matches.get(matchId);
        
        if (!match) {
            match = {
                matchId,
                players: new Map(),
                teamsAssigned: false,
                createdAt: new Date(),
                maxPlayers: this.maxPlayers
            };
            this.matches.set(matchId, match);
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
        }
        
        return {
            success: true,
            message: match.teamsAssigned ? 'Player registered - teams assigned' : 'Player registered successfully',
            matchId,
            playerId,
            registeredPlayers: match.players.size,
            teamsAssigned: match.teamsAssigned
        };
    }
    
    getTeamAssignment(matchId, playerId) {
        const match = this.matches.get(matchId);
        
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
    
    getMatchStatus(matchId) {
        const match = this.matches.get(matchId);
        
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
    
    cleanup() {
        const now = new Date();
        const maxAge = 2 * 60 * 60 * 1000; // 2 hours
        
        for (const [matchId, match] of this.matches) {
            if (now - match.createdAt > maxAge) {
                this.matches.delete(matchId);
                console.log(`Cleaned up expired match: ${matchId}`);
            }
        }
    }
}

module.exports = new MatchManager();
