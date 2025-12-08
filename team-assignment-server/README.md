# Team Assignment Server

Simple Node.js/Express server for assigning balanced teams (3v3) for Unity multiplayer matches.

Uses Redis for caching match data, enabling horizontal scaling and persistent state across server restarts.

## Setup

1. Install dependencies:
```bash
cd team-assignment-server
npm install
```

2. Configure Redis connection in `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_USERNAME=
PORT=3000
```

3. Start the server:
```bash
npm start
```

## Endpoints

### Match Registration & Team Assignment
- **POST /api/register** - Register a player for a match
- **GET /api/teams/:matchId/:playerId** - Get team assignment for a specific player
- **GET /api/status/:matchId** - Get match status and registered players

### Player Metadata (New)
- **POST /api/set-metadata** - Set player metadata (name, level, avatarId)
  ```json
  {
    "playerId": "player123",
    "name": "Alice",
    "level": 10,
    "avatarId": 1
  }
  ```
- **GET /api/match-metadata/:matchId** - Get full match metadata with all players' info and team assignments
  - Returns organized teams (team0, team1, unassigned) with player details
  - Includes: map (1 or 2), name, level, avatarId, team, order, lobbyId

## Features

- Redis-backed caching for match state
- Automatic match expiration (2-hour TTL)
- Deterministic team assignment algorithm
- Lobby-aware team grouping
- Graceful shutdown handling
