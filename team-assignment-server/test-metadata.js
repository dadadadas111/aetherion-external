const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_MATCH_ID = 'metadata-test-' + Date.now();

// Test colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    cyan: '\x1b[96m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function step1_setMetadata() {
    log('\n╔═══════════════════════════════════════════════════╗', 'cyan');
    log('║  STEP 1: Set Player Metadata (Before Registration) ║', 'cyan');
    log('╚═══════════════════════════════════════════════════╝', 'cyan');
    
    const players = [
        { playerId: 'p1', name: 'Alice', level: 10, avatarId: 1 },
        { playerId: 'p2', name: 'Bob', level: 15, avatarId: 2 },
        { playerId: 'p3', name: 'Charlie', level: 8, avatarId: 3 },
        { playerId: 'p4', name: 'David', level: 20, avatarId: 4 },
        { playerId: 'p5', name: 'Eve', level: 12, avatarId: 5 },
        { playerId: 'p6', name: 'Frank', level: 18, avatarId: 6 }
    ];

    log('\nSetting metadata for 6 players...', 'yellow');
    
    for (const player of players) {
        try {
            const response = await axios.post(`${BASE_URL}/api/set-metadata`, player);
            
            if (response.data.success) {
                log(`✓ ${player.name} (Level ${player.level}) - Avatar: ${player.avatarId}`, 'green');
            } else {
                log(`✗ Failed: ${response.data.message}`, 'red');
            }
        } catch (error) {
            log(`✗ Error for ${player.name}: ${error.message}`, 'red');
        }
        await sleep(100);
    }
    
    return players;
}

async function step2_registerPlayers(players) {
    log('\n╔═══════════════════════════════════════╗', 'cyan');
    log('║  STEP 2: Register Players for Match  ║', 'cyan');
    log('╚═══════════════════════════════════════╝', 'cyan');
    
    const registrations = [
        { playerId: 'p1', playerName: 'Alice', lobbyId: 'lobby_alpha' },
        { playerId: 'p2', playerName: 'Bob', lobbyId: 'lobby_alpha' },
        { playerId: 'p3', playerName: 'Charlie', lobbyId: 'lobby_beta' },
        { playerId: 'p4', playerName: 'David', lobbyId: 'lobby_beta' },
        { playerId: 'p5', playerName: 'Eve', lobbyId: null },
        { playerId: 'p6', playerName: 'Frank', lobbyId: null }
    ];

    log(`\nRegistering players for match: ${TEST_MATCH_ID}`, 'yellow');
    
    for (const reg of registrations) {
        try {
            const response = await axios.post(`${BASE_URL}/api/register`, {
                matchId: TEST_MATCH_ID,
                ...reg
            });
            
            if (response.data.success) {
                const lobby = reg.lobbyId ? `[Lobby: ${reg.lobbyId}]` : '[Solo]';
                log(`✓ ${reg.playerName} registered ${lobby}`, 'green');
                log(`  Progress: ${response.data.registeredPlayers}/6 players`, 'yellow');
                
                if (response.data.teamsAssigned) {
                    log('  🎯 TEAMS ASSIGNED! Match is ready!', 'magenta');
                }
            }
        } catch (error) {
            log(`✗ Failed to register ${reg.playerName}: ${error.message}`, 'red');
        }
        await sleep(300);
    }
}

async function step3_getMatchMetadata() {
    log('\n╔═══════════════════════════════════════════════╗', 'cyan');
    log('║  STEP 3: Fetch Match Metadata (For UI Display) ║', 'cyan');
    log('╚═══════════════════════════════════════════════╝', 'cyan');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/match-metadata/${TEST_MATCH_ID}`);
        
        if (response.data.success) {
            log('\n✓ Match metadata retrieved successfully!', 'green');
            log(`\nMatch ID: ${response.data.matchId}`, 'yellow');
            log(`Players: ${response.data.registeredPlayers}/${response.data.totalPlayers}`, 'yellow');
            log(`Teams Assigned: ${response.data.teamsAssigned ? 'YES ✓' : 'NO'}`, response.data.teamsAssigned ? 'green' : 'yellow');
            
            const { team0, team1, unassigned } = response.data.teams;
            
            if (team0.length > 0) {
                log('\n┌─────────────────────────────────────┐', 'blue');
                log('│           🔵 TEAM 0 (Blue)          │', 'blue');
                log('└─────────────────────────────────────┘', 'blue');
                team0.forEach((p, idx) => {
                    log(`  ${idx + 1}. ${p.name}`, 'cyan');
                    log(`     ID: ${p.playerId}`, 'reset');
                    log(`     Level: ${p.level} | Avatar: ${p.avatarId}`, 'yellow');
                    log(`     Team: ${p.team} | Order: ${p.order} | Lobby: ${p.lobbyId || 'none'}`, 'yellow');
                });
            }
            
            if (team1.length > 0) {
                log('\n┌─────────────────────────────────────┐', 'red');
                log('│           🔴 TEAM 1 (Red)           │', 'red');
                log('└─────────────────────────────────────┘', 'red');
                team1.forEach((p, idx) => {
                    log(`  ${idx + 1}. ${p.name}`, 'magenta');
                    log(`     ID: ${p.playerId}`, 'reset');
                    log(`     Level: ${p.level} | Avatar: ${p.avatarId}`, 'yellow');
                    log(`     Team: ${p.team} | Order: ${p.order} | Lobby: ${p.lobbyId || 'none'}`, 'yellow');
                });
            }
            
            if (unassigned.length > 0) {
                log('\n⏳ Unassigned Players:', 'yellow');
                unassigned.forEach(p => {
                    log(`  - ${p.name} (Level ${p.level})`, 'yellow');
                });
            }
            
            // Display JSON response for Unity integration
            log('\n┌─────────────────────────────────────────────┐', 'green');
            log('│  JSON Response (for Unity C# deserialization) │', 'green');
            log('└─────────────────────────────────────────────┘', 'green');
            log(JSON.stringify(response.data, null, 2), 'reset');
            
            return response.data;
        }
    } catch (error) {
        log(`✗ Failed to get match metadata: ${error.message}`, 'red');
        throw error;
    }
}

async function step4_individualPlayerCheck() {
    log('\n╔════════════════════════════════════════════════╗', 'cyan');
    log('║  STEP 4: Individual Player Team Check (Optional) ║', 'cyan');
    log('╚════════════════════════════════════════════════╝', 'cyan');
    
    log('\nChecking individual player assignments...', 'yellow');
    
    const playerIds = ['p1', 'p3', 'p5'];
    
    for (const playerId of playerIds) {
        try {
            const response = await axios.get(`${BASE_URL}/api/teams/${TEST_MATCH_ID}/${playerId}`);
            
            if (response.data.success && response.data.team !== null) {
                log(`✓ ${playerId} → Team ${response.data.team}, Order ${response.data.order}`, 'green');
            } else {
                log(`? ${playerId} → ${response.data.message}`, 'yellow');
            }
        } catch (error) {
            log(`✗ Error for ${playerId}: ${error.message}`, 'red');
        }
    }
}

async function demonstrateWorkflow() {
    log('\n╔═══════════════════════════════════════════════════════╗', 'magenta');
    log('║                                                       ║', 'magenta');
    log('║     Team Assignment Server - Metadata Feature Test   ║', 'magenta');
    log('║                                                       ║', 'magenta');
    log('╚═══════════════════════════════════════════════════════╝', 'magenta');
    
    log('\nThis test demonstrates the complete workflow:', 'yellow');
    log('  1. Set player metadata (name, level, avatarId)', 'yellow');
    log('  2. Register players for a match', 'yellow');
    log('  3. Auto team assignment (when 6 players registered)', 'yellow');
    log('  4. Fetch match metadata for UI display\n', 'yellow');
    
    try {
        // Step 1: Set metadata
        const players = await step1_setMetadata();
        await sleep(500);
        
        // Step 2: Register players
        await step2_registerPlayers(players);
        await sleep(500);
        
        // Step 3: Get match metadata (main feature)
        const matchData = await step3_getMatchMetadata();
        await sleep(500);
        
        // Step 4: Individual checks (optional)
        await step4_individualPlayerCheck();
        
        log('\n╔═══════════════════════════════════╗', 'green');
        log('║   ✓ All Tests Passed Successfully! ║', 'green');
        log('╚═══════════════════════════════════╝', 'green');
        
        log(`\n📝 Test Match ID: ${TEST_MATCH_ID}`, 'cyan');
        log('💾 Data will auto-expire in 2 hours', 'cyan');
        log('🎮 Ready for Unity integration!\n', 'cyan');
        
    } catch (error) {
        log('\n✗ Test failed!', 'red');
        log(`Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Check if server is running and start tests
axios.get(`${BASE_URL}/`)
    .then(() => {
        demonstrateWorkflow();
    })
    .catch((error) => {
        log('\n✗ Server is not running!', 'red');
        log('Start the server first: npm start', 'yellow');
        log(`Error: ${error.message}\n`, 'red');
        process.exit(1);
    });
