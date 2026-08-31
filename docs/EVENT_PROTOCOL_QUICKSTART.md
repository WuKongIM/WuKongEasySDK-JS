# Event Protocol Quick Start Guide

## What is the Event Protocol?

The Event Protocol allows the WuKongIM server to send custom event notifications to connected clients in real-time. This enables your application to react to various server-side events such as:

- User status changes (online/offline)
- Channel updates (name changes, member additions)
- System announcements
- Custom application events

## Quick Example

```javascript
// Initialize SDK
const wkim = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'your-auth-token'
});

// Listen for custom events
wkim.on(WKIM.Event.CustomEvent, (event) => {
    console.log('Custom event received');
    // event = {
    //   id: "event-uuid",
    //   type: "user.status.changed",
    //   timestamp: 1704067200000,
    //   data: { userId: "user456", status: "online" }
    // }
});

// Connect to server
await wkim.connect();
```

## Event Structure

Every event notification contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event identifier (UUID) |
| `type` | string | Event type (e.g., "user.status.changed") |
| `timestamp` | number | Event timestamp in milliseconds |
| `data` | object | Event payload (automatically parsed from JSON) |
| `header` | object | Optional message flags |

## Common Event Types

### User Events
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'user.status.changed') {
        const { userId, status } = event.data;
        updateUserStatus(userId, status);
    }
});
```

### Channel Events
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'channel.updated') {
        const { channelId, updateType, newValue } = event.data;
        updateChannelInUI(channelId, updateType, newValue);
    }
});
```

### System Events
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'system.announcement') {
        const { message, severity } = event.data;
        showNotification(message, severity);
    }
});
```

## Type-Specific Handlers

Create filtered handlers for specific event types:

```javascript
function onEventType(eventType, callback) {
    wkim.on(WKIM.Event.CustomEvent, (event) => {
        if (event.type === eventType) {
            callback(event);
        }
    });
}

// Usage
onEventType('user.status.changed', (event) => {
    updateUserUI(event.data);
});

onEventType('system.announcement', (event) => {
    showBanner(event.data.message);
});
```

## Complete Example

```javascript
// Initialize
const wkim = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'your-token'
});

// Event handler map
const eventHandlers = {
    'user.status.changed': (data) => {
        updateUserStatus(data.userId, data.status);
    },
    
    'channel.updated': (data) => {
        refreshChannel(data.channelId);
    },
    
    'system.announcement': (data) => {
        showNotification(data.message, data.severity);
    },
    
    'notification.received': (data) => {
        if (Notification.permission === 'granted') {
            new Notification(data.title, { body: data.body });
        }
    }
};

// Register event listener
wkim.on(WKIM.Event.CustomEvent, (event) => {
    console.log('Custom event received');
    
    const handler = eventHandlers[event.type];
    if (handler) {
        try {
            handler(event.data);
        } catch (_) {
            console.error('Event handling failed');
        }
    } else {
        console.log('Unhandled custom event');
    }
});

// Other event listeners
wkim.on(WKIM.Event.Connect, () => {
    console.log('Connected to server');
});

wkim.on(WKIM.Event.Disconnect, () => {
    console.log('Disconnected from server');
});

wkim.on(WKIM.Event.Error, () => {
    console.error('SDK operation failed');
});

// Connect
wkim.connect()
    .then(() => console.log('Ready to receive events'))
    .catch(() => console.error('Connection failed'));
```

## Testing

### Interactive Test Page

Open `example/event-test.html` in your browser to test the Event protocol with a visual interface.

### Manual Testing

```javascript
// Simulate receiving an event (for testing)
const mockEvent = {
    id: 'test-event-123',
    type: 'user.status.changed',
    timestamp: Date.now(),
    data: {
        userId: 'user456',
        status: 'online',
        lastSeen: Date.now()
    }
};

// Your event handler will process this
handleEvent(mockEvent);
```

## Best Practices

### 1. Always Validate Event Data
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    const { userId, status } = event.data || {};
    
    if (!userId || !status) {
        console.error('Invalid event data');
        return;
    }
    
    updateUserStatus(userId, status);
});
```

### 2. Use Try-Catch for Error Handling
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    try {
        handleEvent(event);
    } catch (_) {
        console.error('Event handling failed');
    }
});
```

### 3. Prevent Duplicate Processing
```javascript
const processedEvents = new Set();

wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (processedEvents.has(event.id)) {
        return; // Already processed
    }
    
    handleEvent(event);
    processedEvents.add(event.id);
});
```

### 4. Use Consistent Event Type Naming
```
✅ Good: user.status.changed, channel.message.deleted
❌ Bad: userStatusChanged, DeleteChannelMessage
```

## TypeScript Support

The SDK includes full TypeScript definitions:

```typescript
import { WKIM, Event, EventNotification } from 'easyjssdk';

const wkim = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'token'
});

wkim.on(Event.CustomEvent, (event: EventNotification) => {
    console.log('Custom event received');
    routeEventToTrustedUI(event);
});
```

## Troubleshooting

### Events Not Received

1. Check connection status:
```javascript
console.log('Connected:', wkim.isConnected);
```

2. Verify event listener is registered:
```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    console.log('Custom event received');
    handleEvent(event);
});
```

3. Check for errors:
```javascript
wkim.on(WKIM.Event.Error, () => {
    console.error('SDK operation failed');
});
```

### Invalid Event Data

The SDK validates event notifications and emits errors for invalid data:

```javascript
wkim.on(WKIM.Event.Error, () => {
    console.error('SDK operation failed');
});
```

## Next Steps

- 📖 Read the [complete Event Protocol documentation](./EVENT_PROTOCOL.md)
- 🧪 Try the [interactive test page](../example/event-test.html)
- 💻 Check out the [complete example](../example/event-example.js)
- 📋 Review the [JSON-RPC schema](./wukongim_rpc_schema.json)

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review the [schema documentation](./wukongim_rpc_schema.json)
- Open an issue on GitHub
