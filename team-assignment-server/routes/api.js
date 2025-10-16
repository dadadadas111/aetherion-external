const express = require('express');
const MatchManager = require('../models/MatchManager');
const router = express.Router();

// POST /api/register
router.post('/register', (req, res) => {
    try {
        const { matchId, playerId, playerName, lobbyId } = req.body;

        // Validation
        if (!matchId || !playerId) {
            return res.status(400).json({
                success: false,
                message: 'matchId and playerId are required'
            });
        }

        const result = MatchManager.registerPlayer(matchId, playerId, playerName, lobbyId);
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
router.get('/teams/:matchId/:playerId', (req, res) => {
    try {
        const { matchId, playerId } = req.params;
        const result = MatchManager.getTeamAssignment(matchId, playerId);
        
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
router.get('/status/:matchId', (req, res) => {
    try {
        const { matchId } = req.params;
        const result = MatchManager.getMatchStatus(matchId);
        res.json(result);
        
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get match status'
        });
    }
});

module.exports = router;
