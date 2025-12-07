const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_MATCH_ID = 'test-match-' + Date.now();

// Test colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSetMetadata() {
    log('\n=== Testing Set Player Metadata ===', 'blue');
    
    const playersMetadata = [
        { playerId: 'player1', name: 'Alice', level: 10, avatarId: 'avatar_1' },
        { playerId: 'player2', name: 'Bob', level: 15, avatarId: 'avatar_2' },
        { playerId: 'player3', name: 'Charlie', level: 8, avatarId: 'avatar_3' },
        { playerId: 'player4', name: 'David', level: 20, avatarId: 'avatar_4' },
        { playerId: 'player5', name: 'Eve', level: 12, avatarId: 'avatar_5' },
        { playerId: 'player6', name: 'Frank', level: 18, avatarId: 'avatar_6' }
    ];

    for (const metadata of playersMetadata) {
        try {
            const response = await axios.post(`${BASE_URL}/api/set-metadata`, metadata);
            
            if (response.data.success) {
                log(`✓ Metadata set for ${metadata.name} (Level ${metadata.level})`, 'green');
            }
        } catch (error) {
            log(`✗ Failed to set metadata for ${metadata.name}: ${error.message}`, 'red');
        }
    }
}

async function testRegisterPlayers() {
    log('\n=== Testing Player Registration ===', 'blue');
    
    const players = [
        { playerId: 'player1', playerName: 'Alice', lobbyId: 'lobby1' },
        { playerId: 'player2', playerName: 'Bob', lobbyId: 'lobby1' },
        { playerId: 'player3', playerName: 'Charlie', lobbyId: 'lobby2' },
        { playerId: 'player4', playerName: 'David', lobbyId: 'lobby2' },
        { playerId: 'player5', playerName: 'Eve', lobbyId: null },
        { playerId: 'player6', playerName: 'Frank', lobbyId: null }
    ];

    for (const player of players) {
        try {
            const response = await axios.post(`${BASE_URL}/api/register`, {
                matchId: TEST_MATCH_ID,
                ...player
            });
            
            if (response.data.success) {
                log(`✓ Registered ${player.playerName} (${player.playerId})`, 'green');
                log(`  - Players: ${response.data.registeredPlayers}/6`, 'yellow');
                log(`  - Teams assigned: ${response.data.teamsAssigned}`, 'yellow');
            }
        } catch (error) {
            log(`✗ Failed to register ${player.playerName}: ${error.message}`, 'red');
        }
        
        await sleep(200); // Small delay between registrations
    }
}

async function testGetTeamAssignments() {
    log('\n=== Testing Team Assignments ===', 'blue');
    
    const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6'];
    
    for (const playerId of playerIds) {
        try {
            const response = await axios.get(`${BASE_URL}/api/teams/${TEST_MATCH_ID}/${playerId}`);
            
            if (response.data.success && response.data.team !== null) {
                log(`✓ ${playerId} → Team ${response.data.team}, Order ${response.data.order}`, 'green');
            } else {
                log(`? ${playerId} → Teams not assigned yet`, 'yellow');
            }
        } catch (error) {
            log(`✗ Failed to get team for ${playerId}: ${error.message}`, 'red');
        }
    }
}

async function testMatchStatus() {
    log('\n=== Testing Match Status ===', 'blue');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/status/${TEST_MATCH_ID}`);
        
        if (response.data.success) {
            log('✓ Match status retrieved successfully', 'green');
            log(`  - Match ID: ${response.data.matchId}`, 'yellow');
            log(`  - Players: ${response.data.registeredPlayers}/${response.data.totalPlayers}`, 'yellow');
            log(`  - Teams assigned: ${response.data.teamsAssigned}`, 'yellow');
            
            if (response.data.players) {
                log('\n  Players breakdown:', 'blue');
                const teamA = response.data.players.filter(p => p.team === 0);
                const teamB = response.data.players.filter(p => p.team === 1);
                
                log('  Team 0:', 'yellow');
                teamA.forEach(p => log(`    - ${p.playerName} (${p.playerId}) [lobby: ${p.lobbyId || 'none'}]`));
                
                log('  Team 1:', 'yellow');
                teamB.forEach(p => log(`    - ${p.playerName} (${p.playerId}) [lobby: ${p.lobbyId || 'none'}]`));
            }
        }
    } catch (error) {
        log(`✗ Failed to get match status: ${error.message}`, 'red');
    }
}

async function testMatchMetadata() {
    log('\n=== Testing Match Metadata (with player info) ===', 'blue');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/match-metadata/${TEST_MATCH_ID}`);
        
        if (response.data.success) {
            log('✓ Match metadata retrieved successfully', 'green');
            log(`  - Match ID: ${response.data.matchId}`, 'yellow');
            log(`  - Players: ${response.data.registeredPlayers}/${response.data.totalPlayers}`, 'yellow');
            log(`  - Teams assigned: ${response.data.teamsAssigned}`, 'yellow');
            
            const { team0, team1, unassigned } = response.data.teams;
            
            if (team0.length > 0) {
                log('\n  Team 0:', 'blue');
                team0.forEach(p => {
                    log(`    - ${p.name} (${p.playerId})`, 'green');
                    log(`      Level: ${p.level}, Avatar: ${p.avatarId}, Order: ${p.order}`, 'yellow');
                });
            }
            
            if (team1.length > 0) {
                log('\n  Team 1:', 'blue');
                team1.forEach(p => {
                    log(`    - ${p.name} (${p.playerId})`, 'green');
                    log(`      Level: ${p.level}, Avatar: ${p.avatarId}, Order: ${p.order}`, 'yellow');
                });
            }
            
            if (unassigned.length > 0) {
                log('\n  Unassigned:', 'yellow');
                unassigned.forEach(p => {
                    log(`    - ${p.name} (${p.playerId}) - Level: ${p.level}`, 'yellow');
                });
            }
        }
    } catch (error) {
        log(`✗ Failed to get match metadata: ${error.message}`, 'red');
    }
}

async function testNotFound() {
    log('\n=== Testing Not Found Cases ===', 'blue');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/teams/nonexistent-match/player1`);
        log('? Unexpected success for nonexistent match', 'yellow');
    } catch (error) {
        if (error.response && error.response.status === 404) {
            log('✓ Correctly returns 404 for nonexistent match', 'green');
        } else {
            log(`✗ Wrong error response: ${error.message}`, 'red');
        }
    }
}

async function testHealthCheck() {
    log('\n=== Testing Health Check ===', 'blue');
    
    try {
        const response = await axios.get(`${BASE_URL}/`);
        
        if (response.data.status) {
            log('✓ Server is running', 'green');
            log(`  - Status: ${response.data.status}`, 'yellow');
            log(`  - Version: ${response.data.version}`, 'yellow');
        }
    } catch (error) {
        log(`✗ Health check failed: ${error.message}`, 'red');
    }
}

async function runTests() {
    log('\n╔════════════════════════════════════════╗', 'blue');
    log('║  Team Assignment Server - Test Suite  ║', 'blue');
    log('╚════════════════════════════════════════╝', 'blue');
    
    try {
        await testHealthCheck();
        await testSetMetadata(); // Set metadata before registering
        await testRegisterPlayers();
        await sleep(500); // Wait for teams to be assigned
        await testGetTeamAssignments();
        await testMatchStatus();
        await testMatchMetadata(); // New test for match metadata
        await testNotFound();
        
        log('\n✓ All tests completed!', 'green');
        log(`\nTest Match ID: ${TEST_MATCH_ID}`, 'yellow');
        log('This match will auto-expire in 2 hours.\n', 'yellow');
    } catch (error) {
        log(`\n✗ Test suite failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Check if server is running
axios.get(`${BASE_URL}/`)
    .then(() => {
        runTests();
    })
    .catch((error) => {
        log('✗ Server is not running! Start the server first with: npm start', 'red');
        log(`  Error: ${error.message}`, 'red');
        process.exit(1);
    });
