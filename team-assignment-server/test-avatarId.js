const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_MATCH_ID = 'avatar-test-' + Date.now();

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

async function testAvatarIdPersistence() {
    log('\n=== Testing AvatarId Persistence Issue ===', 'blue');
    
    const testPlayerId = 'pPsuEg3YxD5hoyODJ39Ustt9t7xt';
    
    // Step 1: Set metadata with avatarId 202
    log('\n1. Setting metadata with avatarId: 202', 'yellow');
    try {
        const metadataResponse = await axios.post(`${BASE_URL}/api/set-metadata`, {
            playerId: testPlayerId,
            name: 'dadadadadadash',
            level: 1,
            avatarId: 202,
            rank: 'bronze'
        });
        
        log('Response:', 'green');
        console.log(JSON.stringify(metadataResponse.data, null, 2));
        
        if (metadataResponse.data.metadata.avatarId === 202) {
            log('✓ AvatarId 202 confirmed in response', 'green');
        } else {
            log(`✗ AvatarId mismatch! Expected 202, got ${metadataResponse.data.metadata.avatarId}`, 'red');
        }
    } catch (error) {
        log(`✗ Failed to set metadata: ${error.message}`, 'red');
        return;
    }
    
    // Step 2: Register player for a match
    log('\n2. Registering player for match', 'yellow');
    try {
        const registerResponse = await axios.post(`${BASE_URL}/api/register`, {
            matchId: TEST_MATCH_ID,
            playerId: testPlayerId,
            playerName: 'dadadadadadash',
            lobbyId: null
        });
        
        log(`✓ Player registered (${registerResponse.data.registeredPlayers}/6 players)`, 'green');
    } catch (error) {
        log(`✗ Failed to register: ${error.message}`, 'red');
        return;
    }
    
    // Step 3: Get match metadata and verify avatarId
    log('\n3. Fetching match metadata to verify avatarId', 'yellow');
    try {
        const metadataResponse = await axios.get(`${BASE_URL}/api/match-metadata/${TEST_MATCH_ID}`);
        
        log('Match Metadata Response:', 'green');
        console.log(JSON.stringify(metadataResponse.data, null, 2));
        
        const allPlayers = [
            ...metadataResponse.data.teams.team0,
            ...metadataResponse.data.teams.team1,
            ...metadataResponse.data.teams.unassigned
        ];
        
        const player = allPlayers.find(p => p.playerId === testPlayerId);
        
        if (player) {
            log(`\nPlayer found in match metadata:`, 'blue');
            log(`  Name: ${player.name}`, 'yellow');
            log(`  Level: ${player.level}`, 'yellow');
            log(`  AvatarId: ${player.avatarId}`, 'yellow');
            log(`  Rank: ${player.rank}`, 'yellow');
            
            if (player.avatarId === 202) {
                log('\n✓✓✓ SUCCESS! AvatarId 202 is correctly stored and retrieved!', 'green');
            } else {
                log(`\n✗✗✗ FAILED! AvatarId is ${player.avatarId}, expected 202`, 'red');
            }
        } else {
            log('✗ Player not found in match metadata', 'red');
        }
    } catch (error) {
        log(`✗ Failed to get match metadata: ${error.message}`, 'red');
    }
}

// Run test
axios.get(`${BASE_URL}/`)
    .then(() => {
        testAvatarIdPersistence();
    })
    .catch((error) => {
        log('✗ Server is not running! Start the server first: npm start', 'red');
        log(`Error: ${error.message}`, 'red');
        process.exit(1);
    });
