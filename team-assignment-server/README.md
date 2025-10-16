# Team Assignment Server

Simple Node.js/Express server for assigning balanced teams (3v3) for Unity multiplayer matches.

See the project documentation for API endpoints and usage in the parent project description.

Quick start:

```bash
cd team-assignment-server
npm install
npm start
```

Endpoints:
- POST /api/register
- GET /api/teams/:matchId/:playerId
- GET /api/status/:matchId
