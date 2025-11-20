
# Twitter/X Direct Message API — Mock API Assessment

## 1. Objective
Create a **Mock Twitter Direct Message (DM) API** that fully mimics the behavior of the real Twitter/X DM v2 API endpoints, so developers can build UI and backend logic **without needing paid access** to Twitter’s real API.

This mock environment enables:
- Offline development
- Predictable responses
- Reproducible test data
- Isolation from Twitter rate limits & permission issues

---

## 2. API Features to Simulate
The mock API must support the 3 main DM features:

### ✔ 1. List Direct Message Conversations  
**Endpoint:**  
`GET /2/dm_conversations`

**Purpose:**  
Return all DM conversations for the user.

---

### ✔ 2. Get Messages Inside a Conversation  
**Endpoint:**  
`GET /2/dm_conversations/:conversation_id/messages`

**Purpose:**  
Retrieve the message history of a specific DM conversation.

---

### ✔ 3. Send Message (Text / Media)  
Two sending flows must be supported:

#### A. Send inside an existing conversation  
`POST /2/dm_conversations/:conversation_id/messages`

#### B. Send DM directly to participant  
`POST /2/dm_conversations/:participant_id/messages`

---

## 3. Mock Responses (Twitter-Compatible JSON)

### ### 3.1 Conversation List Response Example
```json
{
  "data": [
    {
      "id": "1759836251982377832",
      "type": "dm_conversation",
      "participants": ["123", "456"],
      "last_message": {
        "id": "1759836279182368821",
        "text": "Hey, are you available?",
        "sender_id": "123",
        "created_at": "2024-07-02T12:13:00.000Z"
      }
    }
  ]
}
```

---

### 3.2 Messages Inside Conversation
```json
{
  "data": [
    {
      "id": "1759836279182368821",
      "text": "Hey, are you available?",
      "sender_id": "123",
      "created_at": "2024-07-02T12:13:00.000Z"
    },
    {
      "id": "1759836291232870012",
      "text": "Yes, what's up?",
      "sender_id": "456",
      "created_at": "2024-07-02T12:13:18.000Z"
    }
  ]
}
```

---

## 3.3 DM With Text + Media
```json
{
  "message": {
    "text": "Check this out 👇",
    "media_id": "1783456728912345678"
  }
}
```

Response:
```json
{
  "data": {
    "dm_event_id": "1760023455987612345",
    "conversation_id": "1759836251982377832",
    "message": {
      "id": "1760023455987612345",
      "text": "Check this out 👇",
      "media": {
        "media_id": "1783456728912345678",
        "media_url": "https://mock.api/media/1783456728912345678"
      },
      "sender_id": "mock-user"
    }
  }
}
```

---

## 4. Required Mock Endpoints

| Endpoint | Method | Description |
|---------|--------|-------------|
| `/2/dm_conversations` | GET | List conversations |
| `/2/dm_conversations/:id/messages` | GET | List messages inside conversation |
| `/2/dm_conversations/:id/messages` | POST | Send DM inside existing conversation |
| `/2/dm_conversations/:participant_id/messages` | POST | Send DM to a user (start new conversation) |
| `/upload/media` | POST | Return mock `media_id` |

---

## 5. Data Structure for the Mock

### Conversations
```json
{
  "id": "1759836251982377832",
  "participants": ["mock-user", "456"],
  "last_message_id": "1759836279182368821"
}
```

### Messages
```json
{
  "id": "1759836279182368821",
  "conversation_id": "1759836251982377832",
  "sender_id": "mock-user",
  "text": "Sample message",
  "media_id": null
}
```

---

## 6. Mock API Deployment Options (Free)
| Platform | Cost | Notes |
|----------|------|-------|
| Railways (free tier) | Free | Node.js supported |
| Render | Free | Good for mock APIs |
| Fly.io | Free | Good for small services |
| Local Docker | Free | For internal testing |

---

## 7. Recommended Development Workflow

1. Developers point API base URL to mock server  
2. Build all UI and data flows against mock API  
3. Later switch to real Twitter API when subscription available  
4. Only update API base URL → no code change required  

---

## 8. Conclusion
This mock API enables your engineering team to develop and test Twitter DM functionality **without any dependency on Twitter Developer paid plans**, while keeping the API response structure identical to the real Twitter/X DM API.

---