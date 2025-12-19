const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_MATCH_ID = 'race-test-' + Date.now();

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Simulates aggressive concurrent client behavior
async function simulateClientPolling(playerId, matchId, startTime) {
    let attempts = 0;
    let teamAssigned = false;
    const maxAttempts = 50; // Poll for up to 5 seconds
    
    while (!teamAssigned && attempts < maxAttempts) {
        attempts++;
        try {
            const response = await axios.get(`${BASE_URL}/api/teams/${matchId}/${playerId}`);
            
            if (response.data.success && response.data.team !== null) {
                const elapsed = Date.now() - startTime;
                log(`✓ ${playerId} got team ${response.data.team}, order ${response.data.order} after ${attempts} attempts (${elapsed}ms)`, 'green');
                return {
                    playerId,
                    team: response.data.team,
                    order: response.data.order,
                    attempts,
                    elapsed,
                    success: true
                };
            }
            
            // Small delay between polls (100ms = aggressive client)
            await sleep(100);
        } catch (error) {
            console.error(`${playerId} poll error:`, error.message);
        }
    }
    
    log(`✗ ${playerId} FAILED to get team assignment after ${attempts} attempts`, 'red');
    return {
        playerId,
        team: null,
        order: null,
        attempts,
        success: false
    };
}

async function testRaceCondition() {
    log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
    log('║         RACE CONDITION TEST - CONCURRENT CLIENTS          ║', 'blue');
    log('╚═══════════════════════════════════════════════════════════╝', 'blue');
    
    const players = [
        { playerId: 'player1', playerName: 'Alice', lobbyId: 'lobby1' },
        { playerId: 'player2', playerName: 'Bob', lobbyId: 'lobby1' },
        { playerId: 'player3', playerName: 'Charlie', lobbyId: 'lobby2' },
        { playerId: 'player4', playerName: 'David', lobbyId: 'lobby2' },
        { playerId: 'player5', playerName: 'Eve', lobbyId: null },
        { playerId: 'player6', playerName: 'Frank', lobbyId: null }
    ];

    // Step 1: Set metadata for all players
    log('\n[1/4] Setting player metadata...', 'yellow');
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        await axios.post(`${BASE_URL}/api/set-metadata`, {
            playerId: p.playerId,
            name: p.playerName,
            level: 10 + i,
            avatarId: `avatar_${i}`,
            rank: 'Gold'
        });
    }
    log('✓ All metadata set', 'green');

    // Step 2: Start polling for ALL players BEFORE registering anyone
    // This simulates real clients that start polling immediately after registration
    log('\n[2/4] Starting player registration with CONCURRENT polling...', 'yellow');
    
    const startTime = Date.now();
    const pollingPromises = [];
    
    // Register players with small delays, while ALL of them poll aggressively
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        
        // Start polling IMMEDIATELY for this player
        pollingPromises.push(simulateClientPolling(player.playerId, TEST_MATCH_ID, startTime));
        
        // Register player
        try {
            const response = await axios.post(`${BASE_URL}/api/register`, {
                matchId: TEST_MATCH_ID,
                ...player
            });
            
            const elapsed = Date.now() - startTime;
            log(`  [${elapsed}ms] Registered ${player.playerName} (${i+1}/6) - Teams assigned: ${response.data.teamsAssigned}`, 'magenta');
        } catch (error) {
            log(`✗ Failed to register ${player.playerName}: ${error.message}`, 'red');
        }
        
        // Small random delay to simulate real-world timing variance
        await sleep(50 + Math.random() * 100);
    }
    
    log('\n[3/4] Waiting for all players to receive team assignments...', 'yellow');
    
    // Wait for all polling to complete
    const results = await Promise.all(pollingPromises);
    
    // Step 3: Analyze results
    log('\n[4/4] Analysis:', 'blue');
    log('═══════════════════════════════════════════════════════════', 'blue');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    log(`✓ Successful assignments: ${successful.length}/6`, successful.length === 6 ? 'green' : 'red');
    log(`✗ Failed assignments: ${failed.length}/6`, failed.length === 0 ? 'green' : 'red');
    
    if (successful.length === 6) {
        const team0 = successful.filter(r => r.team === 0);
        const team1 = successful.filter(r => r.team === 1);
        
        log(`\n✓ Team balance: Team 0 = ${team0.length}, Team 1 = ${team1.length}`, 'green');
        
        // Check for duplicate orders
        const team0Orders = team0.map(r => r.order).sort();
        const team1Orders = team1.map(r => r.order).sort();
        
        const team0Valid = team0Orders.join(',') === '0,1,2';
        const team1Valid = team1Orders.join(',') === '0,1,2';
        
        if (team0Valid && team1Valid) {
            log('✓ Order assignments valid (0,1,2 per team)', 'green');
        } else {
            log('✗ Order assignments INVALID', 'red');
            log(`  Team 0 orders: ${team0Orders.join(',')}`, 'red');
            log(`  Team 1 orders: ${team1Orders.join(',')}`, 'red');
        }
        
        const avgAttempts = successful.reduce((sum, r) => sum + r.attempts, 0) / successful.length;
        const avgElapsed = successful.reduce((sum, r) => sum + r.elapsed, 0) / successful.length;
        
        log(`\n📊 Stats:`, 'blue');
        log(`   Average polling attempts: ${avgAttempts.toFixed(1)}`, 'yellow');
        log(`   Average time to assignment: ${avgElapsed.toFixed(0)}ms`, 'yellow');
        
        log('\n╔═══════════════════════════════════════════════════════════╗', 'green');
        log('║                  ✓ RACE TEST PASSED                       ║', 'green');
        log('╚═══════════════════════════════════════════════════════════╝', 'green');
        
        return true;
    } else {
        log('\n╔═══════════════════════════════════════════════════════════╗', 'red');
        log('║                  ✗ RACE TEST FAILED                       ║', 'red');
        log('╚═══════════════════════════════════════════════════════════╝', 'red');
        
        log('\nFailed players:', 'red');
        failed.forEach(r => log(`  - ${r.playerId}`, 'red'));
        
        return false;
    }
}

async function runTest() {
    try {
        log('\n🔍 Checking server connection...', 'blue');
        await axios.get(BASE_URL);
        log('✓ Server is running\n', 'green');
        
        await testRaceCondition();
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            log('\n✗ Server is not running. Please start the server first.', 'red');
            log('Run: npm start', 'yellow');
        } else {
            log(`\n✗ Test error: ${error.message}`, 'red');
            console.error(error);
        }
    }
}

runTest();
