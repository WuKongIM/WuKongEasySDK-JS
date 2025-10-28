# EasyJSSDK

[中文 README](README_zh.md)

A simple and easy-to-use communication SDK for WuKongIM, based on its JSON-RPC protocol.

## Installation

```bash
npm install easyjssdk
```

## Usage

```typescript
// ... existing code ...
import { WKIM, WKIMChannelType, WKIMEvent } from 'easyjssdk';

// 1. Initialization
const im = WKIM.init("ws://your-wukongim-server.com:5200", {
    uid: "your_user_id",        // Your user ID
    token: "your_auth_token"    // Your authentication token
    // deviceId: "optional_device_id", // Optional device ID
    // deviceFlag: 2 // Optional device flag (1:APP, 2:WEB, default is 2)
});

// 2. Receive messages
im.on(WKIMEvent.Message, (message) => {
    console.log("Received message:", message);
    // Process received message (message.payload, message.fromUid, etc.)
});

// 2.1 Receive custom event notifications (NEW!)
im.on(WKIMEvent.CustomEvent, (event) => {
    console.log("Received event:", event);
    // Handle custom events from server
    // event = { id, type, timestamp, data }
});

// For more events, check the documentation
https://github.com/WuKongIM/EasyJSSDK/blob/main/example/app.js#L132

// 3. Connect to the server
await im.connect()

// 4. Example: Send a message after successful connection
const targetChannelID = "friend_user_id"; // Target user ID
const messagePayload = { type: 1, content: "Hello from EasyJSSDK!" }; // Your custom message payload
const sendResult = await im.send(targetChannelID, WKIMChannelType.Person, messagePayload);
// sendResult.reasonCode
```

## Features

- ✅ **WebSocket Communication** - Real-time bidirectional communication with WuKongIM server
- ✅ **Message Sending & Receiving** - Send and receive messages with automatic acknowledgment
- ✅ **Event Protocol** - Receive custom event notifications from the server (NEW!)
- ✅ **Auto Reconnection** - Automatic reconnection with exponential backoff
- ✅ **TypeScript Support** - Full TypeScript type definitions included
- ✅ **Browser & Node.js** - Works in both browser and Node.js environments
- ✅ **Singleton Mode** - Optional singleton pattern for global instance management

## Event Protocol

The SDK now supports the Event Protocol, allowing you to receive custom event notifications from the server:

```javascript
// Listen for custom events
im.on(WKIMEvent.CustomEvent, (event) => {
    console.log('Event Type:', event.type);
    console.log('Event Data:', event.data);

    // Handle different event types
    switch (event.type) {
        case 'user.status.changed':
            updateUserStatus(event.data);
            break;
        case 'system.announcement':
            showAnnouncement(event.data);
            break;
    }
});
```

**Event Structure:**
- `id` - Unique event identifier
- `type` - Event type (e.g., "user.status.changed")
- `timestamp` - Event timestamp in milliseconds
- `data` - Event payload (automatically parsed from JSON)

📖 **Learn More:**
- [Event Protocol Quick Start](./docs/EVENT_PROTOCOL_QUICKSTART.md)
- [Complete Event Protocol Documentation](./docs/EVENT_PROTOCOL.md)
- [Event Protocol Example](./example/event-example.js)
- [Interactive Event Test Page](./example/event-test.html)

## Example:

![Example](./docs/example.png)

## Development

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run build` to compile TypeScript to JavaScript.

## Running the Example

This repository includes a simple HTML/JS example to test the SDK.

1.  **Build the SDK:** Make sure you have built the library first:
    ```bash
    npm run build
    ```
2.  **Start a Local Server:** Navigate to the root directory of this project (`EasyJSSDK`) in your terminal. You need to serve the files using a local web server because the example uses ES Modules. A simple way is using `http-server`:
    ```bash
    # If you don't have http-server, install it globally:
    # npm install -g http-server

    # Run the server from the EasyJSSDK directory:
    http-server .
    ```
    Alternatively, use the VS Code "Live Server" extension or any other local server, ensuring it serves from the project root directory (`EasyJSSDK`).

3.  **Open the Example:** Open your web browser and navigate to the example page, typically:
    `http://localhost:8080/example/`
    (Adjust the port number if your server uses a different one).

4.  **Test:** Enter your WuKongIM server details (URL, UID, Token) and use the buttons to connect, disconnect, and send messages. 

