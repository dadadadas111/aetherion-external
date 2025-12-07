const express = require('express');
const MatchManager = require('../models/MatchManager');
const router = express.Router();

// POST /api/register
router.post('/register', async (req, res) => {
    try {
        const { matchId, playerId, playerName, lobbyId } = req.body;

        // Validation
        if (!matchId || !playerId) {
            return res.status(400).json({
                success: false,
                message: 'matchId and playerId are required'
            });
        }

        const result = await MatchManager.registerPlayer(matchId, playerId, playerName, lobbyId);
        // If client provided lobbyId, echo it back for clarity
        if (result && result.success) result.lobbyId = lobbyId || null;
        res.json(result);

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// GET /api/teams/:matchId/:playerId
router.get('/teams/:matchId/:playerId', async (req, res) => {
    try {
        const { matchId, playerId } = req.params;
        const result = await MatchManager.getTeamAssignment(matchId, playerId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(result.notFound ? 404 : 200).json(result);
        }
        
    } catch (error) {
        console.error('Team assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team assignment'
        });
    }
});

// GET /api/status/:matchId
router.get('/status/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const result = await MatchManager.getMatchStatus(matchId);
        res.json(result);
        
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get match status'
        });
    }
});

// POST /api/set-metadata
router.post('/set-metadata', async (req, res) => {
    try {
        const { playerId, name, level, avatarId } = req.body;

        // Validation
        if (!playerId) {
            return res.status(400).json({
                success: false,
                message: 'playerId is required'
            });
        }

        const result = await MatchManager.setPlayerMetadata(playerId, {
            name,
            level,
            avatarId
        });
        
        res.json(result);

    } catch (error) {
        console.error('Set metadata error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set player metadata'
        });
    }
});

// GET /api/match-metadata/:matchId
router.get('/match-metadata/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const result = await MatchManager.getMatchMetadata(matchId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
        
    } catch (error) {
        console.error('Match metadata error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get match metadata'
        });
    }
});

module.exports = router;
