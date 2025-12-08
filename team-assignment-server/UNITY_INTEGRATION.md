# Unity Integration Guide - Match Metadata API

## Quick Start (3 Steps)

### Step 1: Set Player Metadata (Before/During Matchmaking)
```csharp
// Call this when player enters matchmaking lobby
POST http://your-server:3000/api/set-metadata
Content-Type: application/json

{
    "playerId": "player_unique_id",
    "name": "PlayerName",
    "level": 10,
    "avatarId": 1
}
```

### Step 2: Register for Match (Existing API - No Changes)
```csharp
// Call this to join a specific match
POST http://your-server:3000/api/register
Content-Type: application/json

{
    "matchId": "match_12345",
    "playerId": "player_unique_id",
    "playerName": "PlayerName",
    "lobbyId": "lobby_alpha"  // optional: null for solo players
}

// Response includes teamsAssigned: true when match is full (6 players)
```

### Step 3: Fetch Match Metadata for UI Display
```csharp
// Call this when teamsAssigned = true (or periodically poll)
GET http://your-server:3000/api/match-metadata/{matchId}

// Returns organized team data with all player info
```

---

## Unity C# Code Example

### 1. Data Models
```csharp
[System.Serializable]
public class PlayerMetadata
{
    public string playerId;
    public string name;
    public int level;
    public int avatarId;
}

[System.Serializable]
public class PlayerInfo
{
    public string playerId;
    public string name;
    public int level;
    public int avatarId;
    public int? team;  // 0 or 1, null if not assigned
    public int? order; // 0, 1, or 2 (spawn order)
    public string lobbyId;
}

[System.Serializable]
public class TeamData
{
    public List<PlayerInfo> team0;
    public List<PlayerInfo> team1;
    public List<PlayerInfo> unassigned;
}

[System.Serializable]
public class MatchMetadataResponse
{
    public bool success;
    public string matchId;
    public bool teamsAssigned;
    public int totalPlayers;
    public int registeredPlayers;
    public int map;  // Random map selection: 1 or 2
    public TeamData teams;
}
```

### 2. API Calls
```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class TeamAssignmentClient : MonoBehaviour
{
    private const string BASE_URL = "http://your-server:3000/api";
    
    // Step 1: Set player metadata
    public IEnumerator SetPlayerMetadata(string playerId, string name, int level, int avatarId)
    {
        var metadata = new PlayerMetadata
        {
            playerId = playerId,
            name = name,
            level = level,
            avatarId = avatarId
        };
        
        string json = JsonUtility.ToJson(metadata);
        
        using (UnityWebRequest request = UnityWebRequest.Post($"{BASE_URL}/set-metadata", json, "application/json"))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("Metadata set successfully");
            }
            else
            {
                Debug.LogError($"Failed to set metadata: {request.error}");
            }
        }
    }
    
    // Step 2: Register for match (existing - unchanged)
    public IEnumerator RegisterPlayer(string matchId, string playerId, string playerName, string lobbyId = null)
    {
        var registration = new
        {
            matchId = matchId,
            playerId = playerId,
            playerName = playerName,
            lobbyId = lobbyId
        };
        
        string json = JsonUtility.ToJson(registration);
        
        using (UnityWebRequest request = UnityWebRequest.Post($"{BASE_URL}/register", json, "application/json"))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonUtility.FromJson<dynamic>(request.downloadHandler.text);
                Debug.Log($"Registered. Teams assigned: {response.teamsAssigned}");
                // If teamsAssigned = true, proceed to fetch match metadata
            }
        }
    }
    
    // Step 3: Get match metadata for UI
    public IEnumerator GetMatchMetadata(string matchId)
    {
        using (UnityWebRequest request = UnityWebRequest.Get($"{BASE_URL}/match-metadata/{matchId}"))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                MatchMetadataResponse data = JsonUtility.FromJson<MatchMetadataResponse>(request.downloadHandler.text);
                
                if (data.success && data.teamsAssigned)
                {
                    DisplayTeams(data.teams);
                }
            }
            else
            {
                Debug.LogError($"Failed to get match metadata: {request.error}");
            }
        }
    }
    
    // Display teams in UI
    private void DisplayTeams(TeamData teams)
    {
        Debug.Log("=== TEAM 0 (Blue) ===");
        foreach (var player in teams.team0)
        {
            Debug.Log($"{player.name} (Lv.{player.level}) - Avatar: {player.avatarId} - Order: {player.order}");
            // Update UI: Show player card with name, level, avatar, spawn position
        }
        
        Debug.Log("=== TEAM 1 (Red) ===");
        foreach (var player in teams.team1)
        {
            Debug.Log($"{player.name} (Lv.{player.level}) - Avatar: {player.avatarId} - Order: {player.order}");
            // Update UI: Show player card with name, level, avatar, spawn position
        }
    }
}
```

### 3. Usage Flow
```csharp
public class MatchmakingManager : MonoBehaviour
{
    private TeamAssignmentClient client;
    private string currentMatchId;
    private string myPlayerId;
    
    void Start()
    {
        client = GetComponent<TeamAssignmentClient>();
        myPlayerId = SystemInfo.deviceUniqueIdentifier; // or your player ID
    }
    
    // Called when player enters matchmaking
    public void OnEnterMatchmaking()
    {
        string playerName = PlayerPrefs.GetString("PlayerName");
        int playerLevel = PlayerPrefs.GetInt("PlayerLevel");
        int avatarId = PlayerPrefs.GetInt("SelectedAvatar");
        
        // Set metadata first
        StartCoroutine(client.SetPlayerMetadata(myPlayerId, playerName, playerLevel, avatarId));
    }
    
    // Called when match is found
    public void OnMatchFound(string matchId, string lobbyId = null)
    {
        currentMatchId = matchId;
        StartCoroutine(RegisterAndWaitForTeams(matchId, lobbyId));
    }
    
    private IEnumerator RegisterAndWaitForTeams(string matchId, string lobbyId)
    {
        // Register for match
        yield return client.RegisterPlayer(matchId, myPlayerId, "PlayerName", lobbyId);
        
        // Poll for team assignment (or use the response from register)
        yield return new WaitForSeconds(0.5f);
        
        // Fetch match metadata for UI display
        yield return client.GetMatchMetadata(matchId);
    }
}
```

---

## API Response Example
```json
{
  "success": true,
  "matchId": "match_12345",
  "teamsAssigned": true,
  "totalPlayers": 6,
  "registeredPlayers": 6,
  "map": 1,
  "teams": {
    "team0": [
      {
        "playerId": "p1",
        "name": "Alice",
        "level": 10,
        "avatarId": 1,
        "team": 0,
        "order": 0,
        "lobbyId": "lobby_alpha"
      },
      {
        "playerId": "p2",
        "name": "Bob",
        "level": 15,
        "avatarId": 2,
        "team": 0,
        "order": 1,
        "lobbyId": "lobby_alpha"
      },
      {
        "playerId": "p5",
        "name": "Eve",
        "level": 12,
        "avatarId": 5,
        "team": 0,
        "order": 2,
        "lobbyId": null
      }
    ],
    "team1": [
      {
        "playerId": "p3",
        "name": "Charlie",
        "level": 8,
        "avatarId": 3,
        "team": 1,
        "order": 0,
        "lobbyId": "lobby_beta"
      },
      {
        "playerId": "p4",
        "name": "David",
        "level": 20,
        "avatarId": 4,
        "team": 1,
        "order": 1,
        "lobbyId": "lobby_beta"
      },
      {
        "playerId": "p6",
        "name": "Frank",
        "level": 18,
        "avatarId": 6,
        "team": 1,
        "order": 2,
        "lobbyId": null
      }
    ],
    "unassigned": []
  }
}
```

---

## Key Points
- **`map`**: Randomly assigned map ID (1 or 2) when match is created - use this to load the correct map scene
- **`order`**: Use this for spawn point positioning (0, 1, 2 within each team)
- **`lobbyId`**: Shows which players came from the same lobby (helps with friend grouping)
- **`team`**: 0 or 1 for team assignment, null if not yet assigned
- **Existing APIs unchanged**: `/api/register` and `/api/teams/:matchId/:playerId` work as before
- **Auto-expiry**: Match data expires after 2 hours (configurable in server)

---

## Testing
Run the metadata test suite:
```bash
npm run test:metadata
```
