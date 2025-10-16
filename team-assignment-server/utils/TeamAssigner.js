class TeamAssigner {
    static assignTeams(match) {
        // Build deterministic ordering that prioritizes grouping by lobbyId.
        // Strategy (deterministic & greedy):
        // 1. Group players by lobbyId (players with null/undefined lobbyId go into their own group keyed by playerId)
        // 2. For each lobby group, sort members by playerId to ensure deterministic ordering
        // 3. Sort groups by: (1) decreasing size (so larger lobbies are placed first), (2) then by smallest member playerId for deterministic tie-break
        // 4. Flatten groups into an ordered list and assign teams greedily trying to keep members of the same lobby on the same team.

        const allPlayers = Array.from(match.players.values());

        // Group by lobbyId (use playerId as unique group for null lobbyId)
        const groups = new Map();
        for (const p of allPlayers) {
            const key = p.lobbyId || `__solo__${p.playerId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        }

        // Sort members inside each group by playerId
        for (const [k, arr] of groups) {
            arr.sort((a, b) => a.playerId.localeCompare(b.playerId));
        }

        // Convert groups to array and sort groups by size desc, then by smallest playerId for determinism
        const groupList = Array.from(groups.entries())
            .map(([key, players]) => ({ key, players }))
            .sort((g1, g2) => {
                if (g2.players.length !== g1.players.length) return g2.players.length - g1.players.length;
                const min1 = g1.players[0].playerId;
                const min2 = g2.players[0].playerId;
                return min1.localeCompare(min2);
            });

        // Flatten while attempting to keep group members together. For groups larger than remaining slots in a team,
        // we will split deterministically by playerId order.
        const ordered = [];
        let teamCounts = { 0: 0, 1: 0 };
        const maxPerTeam = 3;

        for (const g of groupList) {
            const members = g.players;
            // If group fits entirely into the team with fewer members, place whole group there
            const targetTeam = teamCounts[0] <= teamCounts[1] ? 0 : 1;
            const spaceInTarget = maxPerTeam - teamCounts[targetTeam];

            if (members.length <= spaceInTarget) {
                // place all members into target team slot in order
                for (const m of members) ordered.push(m);
                teamCounts[targetTeam] += members.length;
            } else {
                // group doesn't fully fit — place as many as possible into target, then remaining to other team
                let placed = 0;
                for (const m of members) {
                    if (teamCounts[targetTeam] < maxPerTeam) {
                        ordered.push(m);
                        teamCounts[targetTeam]++;
                        placed++;
                    } else {
                        ordered.push(m);
                        teamCounts[1 - targetTeam]++;
                        placed++;
                    }
                }
            }
        }

        // If ordered is not full (less than 6) fill remaining slots by deterministic playerId order of unplaced (shouldn't happen here)
        if (ordered.length < allPlayers.length) {
            const placedIds = new Set(ordered.map(p => p.playerId));
            const remaining = allPlayers.filter(p => !placedIds.has(p.playerId)).sort((a, b) => a.playerId.localeCompare(b.playerId));
            for (const r of remaining) ordered.push(r);
        }

        console.log('Assigning teams for players (ordered):', ordered.map(p => p.playerId));

        // Now assign teams alternating but filling to ensure balance while keeping earlier ordering
        const finalTeamCounts = { 0: 0, 1: 0 };
        const players = ordered;
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            // Prefer to put player into the team that already contains their lobby (if any)
            let assigned = null;
            if (player.lobbyId) {
                // check existing assignment for same lobby
                const lobbyMembers = players.filter(p => p.lobbyId === player.lobbyId);
                for (const lm of lobbyMembers) {
                    if (lm.team === 0) assigned = 0;
                    if (lm.team === 1) assigned = lm.team;
                    if (assigned !== null) break;
                }
            }

            // If no lobby-based assignment, choose the team with fewer players (deterministic)
            if (assigned === null) {
                assigned = finalTeamCounts[0] <= finalTeamCounts[1] ? 0 : 1;
            }

            // But enforce maxPerTeam
            if (finalTeamCounts[assigned] >= maxPerTeam) assigned = 1 - assigned;

            player.team = assigned;
            finalTeamCounts[assigned]++;
            console.log(`${player.playerId} → Team ${player.team} (lobbyId=${player.lobbyId})`);
        }
        
        // Verify team balance
        const verifyCounts = { 0: 0, 1: 0 };
        players.forEach(player => verifyCounts[player.team]++);

        console.log(`Team assignment complete - TeamA: ${verifyCounts[0]}, TeamB: ${verifyCounts[1]}`);

        return players;
    }
}

module.exports = TeamAssigner;
