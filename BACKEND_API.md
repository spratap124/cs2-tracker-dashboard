# Backend API Documentation

This document outlines the required backend APIs for the multi-user CS2 Price Tracker application.

## Base URL

All endpoints should be prefixed with the base URL (e.g., `http://localhost:3001`)

## User Management APIs

### 1. Create User

**POST** `/user`

Creates a new user with a Discord webhook URL.

**Request Body:**

```json
{
  "discordWebhook": "https://discord.com/api/webhooks/..."
}
```

**Response:**

```json
{
  "userId": "unique-user-id",
  "discordWebhook": "https://discord.com/api/webhooks/...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201 Created` - User created successfully
- `400 Bad Request` - Invalid webhook URL
- `500 Internal Server Error` - Server error

---

### 2. Get User

**GET** `/user/:userId`

Retrieves user information including Discord webhook.

**Response:**

```json
{
  "userId": "unique-user-id",
  "discordWebhook": "https://discord.com/api/webhooks/...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200 OK` - User found
- `404 Not Found` - User does not exist
- `500 Internal Server Error` - Server error

---

### 3. Update User

**PUT** `/user/:userId`

Updates user's Discord webhook URL.

**Request Body:**

```json
{
  "discordWebhook": "https://discord.com/api/webhooks/..."
}
```

**Response:**

```json
{
  "userId": "unique-user-id",
  "discordWebhook": "https://discord.com/api/webhooks/...",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200 OK` - User updated successfully
- `400 Bad Request` - Invalid webhook URL
- `404 Not Found` - User does not exist
- `500 Internal Server Error` - Server error

---

### 4. Recover User Account

**POST** `/user/recover`

Recovers a user account by Discord webhook URL. This allows users to retrieve their userId if they've lost it (e.g., localStorage was cleared).

**Request Body:**

```json
{
  "discordWebhook": "https://discord.com/api/webhooks/..."
}
```

**Response:**

```json
{
  "userId": "unique-user-id",
  "discordWebhook": "https://discord.com/api/webhooks/...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200 OK` - User found and recovered
- `404 Not Found` - No user found with this webhook
- `400 Bad Request` - Invalid webhook URL format
- `500 Internal Server Error` - Server error

**Important:** This endpoint should look up users by their Discord webhook URL. The webhook URL should be indexed in your database for efficient lookups.

---

## Tracker Management APIs

### 5. Get Trackers

**GET** `/track?userId=:userId`

Retrieves all trackers for a specific user.

**Query Parameters:**

- `userId` (required) - The user ID to filter trackers

**Response:**

```json
[
  {
    "_id": "tracker-id",
    "userId": "user-id",
    "skinName": "AK-47 | Redline (Field-Tested)",
    "interest": "sell",
    "targetDown": 1800,
    "targetUp": 2500,
    "lastKnownPrice": 2200,
    "imageUrl": "https://...",
    "iconUrl": "hash-string",
    "downAlertSent": false,
    "upAlertSent": false,
    "lastDownAlertPrice": null,
    "lastUpAlertPrice": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Status Codes:**

- `200 OK` - Success
- `400 Bad Request` - Missing userId parameter
- `500 Internal Server Error` - Server error

---

### 6. Create Tracker

**POST** `/track`

Creates a new price tracker for a user.

**Request Body:**

```json
{
  "userId": "user-id",
  "skinName": "AK-47 | Redline (Field-Tested)",
  "interest": "sell",
  "targetDown": 1800,
  "targetUp": 2500
}
```

**Response:**

```json
{
  "_id": "tracker-id",
  "userId": "user-id",
  "skinName": "AK-47 | Redline (Field-Tested)",
  "interest": "sell",
  "targetDown": 1800,
  "targetUp": 2500,
  "lastKnownPrice": null,
  "downAlertSent": false,
  "upAlertSent": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201 Created` - Tracker created successfully
- `400 Bad Request` - Invalid request data
- `404 Not Found` - User does not exist
- `500 Internal Server Error` - Server error

---

### 7. Delete Tracker

**DELETE** `/track/:trackerId`

Deletes a tracker. The backend should verify that the tracker belongs to the requesting user (you may need to pass userId as a query parameter or in headers for security).

**Query Parameters (recommended for security):**

- `userId` - The user ID to verify ownership

**Status Codes:**

- `200 OK` - Tracker deleted successfully
- `403 Forbidden` - Tracker does not belong to user
- `404 Not Found` - Tracker does not exist
- `500 Internal Server Error` - Server error

---

## Utility APIs

### 8. Search CS2 Skins

**GET** `/search-skins`

Searches for CS2 skins on Steam Community Market. This endpoint proxies requests to Steam's Market API to avoid CORS issues.

**Query Parameters:**

- `query` (required) - Search query string (e.g., "AK-47 Redline")
- `start` (optional) - Starting index for pagination (default: 0)
- `count` (optional) - Number of results to return (default: 50, max: 100)

**Response:**

```json
{
  "results": [
    {
      "name": "AK-47 | Redline (Field-Tested)",
      "hash_name": "AK-47 | Redline (Field-Tested)",
      "sell_listings": 1234,
      "sell_price": 1800,
      "sell_price_text": "$1,800.00",
      "app_icon": "...",
      "app_name": "Counter-Strike 2",
      "asset_description": {...},
      "sale_price_text": "$1,800.00"
    }
  ],
  "total_count": 50
}
```

**Backend Implementation Notes:**

The backend should proxy the request to Steam's Market Search API:

```
GET https://steamcommunity.com/market/search/render/?query={query}&start={start}&count={count}&search_descriptions=0&sort_column=popular&sort_dir=desc&appid=730&norender=1
```

The response from Steam should be parsed and returned in the format above. The `results` array should contain items with at least a `name` field.

**Status Codes:**

- `200 OK` - Search successful
- `400 Bad Request` - Invalid query parameter
- `500 Internal Server Error` - Server error or Steam API unavailable

---

### 9. Get Steam Image

**GET** `/steam-image?url=:encodedUrl`

Fetches the image URL from a Steam market listing page. This is optional and can be used to get skin images.

**Query Parameters:**

- `url` (required) - Encoded Steam market listing URL

**Response:**

```json
{
  "imageUrl": "https://steamcommunity-a.akamaihd.net/economy/image/..."
}
```

**Status Codes:**

- `200 OK` - Image URL retrieved
- `400 Bad Request` - Invalid URL
- `500 Internal Server Error` - Server error

---

## Discord Webhook Integration

The backend should use the stored Discord webhook URLs to send notifications when price targets are reached. This should be handled by a background job/service that:

1. Periodically checks all trackers for price updates
2. Compares current prices with target prices
3. Sends Discord webhook notifications when:
   - Price drops to or below `targetDown` (and `downAlertSent` is false)
   - Price rises to or above `targetUp` (and `upAlertSent` is false)
4. Updates tracker flags (`downAlertSent`, `upAlertSent`, `lastDownAlertPrice`, `lastUpAlertPrice`)

### Discord Webhook Payload Format

When sending notifications, use Discord's webhook format:

```json
{
  "content": "Price Alert!",
  "embeds": [
    {
      "title": "AK-47 | Redline (Field-Tested)",
      "description": "Price has reached your target!",
      "fields": [
        {
          "name": "Current Price",
          "value": "$2,200",
          "inline": true
        },
        {
          "name": "Target",
          "value": "≤ $1,800",
          "inline": true
        },
        {
          "name": "Interest",
          "value": "Sell",
          "inline": true
        }
      ],
      "color": 3066993,
      "url": "https://steamcommunity.com/market/listings/730/..."
    }
  ]
}
```

---

## Security Considerations

1. **User Authentication**: Consider implementing proper authentication (JWT tokens, sessions, etc.) instead of relying solely on userId in requests.

2. **Authorization**: Always verify that trackers belong to the requesting user before allowing modifications or deletions.

3. **Webhook Validation**: Validate Discord webhook URLs before storing them.

4. **Rate Limiting**: Implement rate limiting to prevent abuse.

5. **Input Validation**: Validate all input data (skin names, prices, etc.) before storing.

---

## Database Schema Suggestions

### Users Collection

```javascript
{
  userId: String (unique, indexed),
  discordWebhook: String (indexed for recovery lookups),
  createdAt: Date,
  updatedAt: Date
}
```

**Important:** The `discordWebhook` field should be indexed to enable efficient account recovery lookups via the `/user/recover` endpoint.

### Trackers Collection

```javascript
{
  _id: ObjectId,
  userId: String (indexed),
  skinName: String,
  interest: String ("buy" | "sell"),
  targetDown: Number,
  targetUp: Number,
  lastKnownPrice: Number,
  imageUrl: String,
  iconUrl: String,
  downAlertSent: Boolean,
  upAlertSent: Boolean,
  lastDownAlertPrice: Number,
  lastUpAlertPrice: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Example Implementation Notes

1. **User ID Generation**: You can use UUIDs, MongoDB ObjectIds, or any unique identifier generator.

2. **Price Checking Service**: Implement a background service that:

   - Fetches current prices from Steam Market API
   - Updates `lastKnownPrice` for all trackers
   - Checks if targets are met
   - Sends Discord notifications
   - Updates alert flags

3. **Error Handling**: Handle cases where:

   - Discord webhook is invalid or removed
   - Steam API is unavailable
   - Price data is missing

4. **Webhook Retry Logic**: Implement retry logic for failed Discord webhook calls.
