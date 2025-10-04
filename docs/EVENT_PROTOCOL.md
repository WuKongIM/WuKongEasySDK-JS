# Event Protocol Documentation

## Overview

The Event Protocol is part of the WuKongIM JSON-RPC 2.0 specification that allows the server to send custom event notifications to connected clients. This enables real-time event-driven communication for various use cases such as user status updates, system announcements, channel modifications, and more.

## Table of Contents

- [Event Notification Structure](#event-notification-structure)
- [Event Types](#event-types)
- [Implementation](#implementation)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)

## Event Notification Structure

Event notifications are sent from the server to the client using the JSON-RPC 2.0 notification format (no response required).

### JSON-RPC Format

```json
{
  "jsonrpc": "2.0",
  "method": "event",
  "params": {
    "header": {
      "noPersist": false,
      "redDot": true,
      "syncOnce": false,
      "dup": false
    },
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "user.status.changed",
    "timestamp": 1704067200000,
    "data": "{\"userId\":\"user123\",\"status\":\"online\"}"
  }
}
```

### TypeScript Interface

```typescript
export interface EventNotification {
    /** Optional header with message flags */
    header?: Header;
    /** Unique event identifier */
    id: string;
    /** Event type/category */
    type: string;
    /** Event timestamp (milliseconds) */
    timestamp: number;
    /** Event data payload (JSON string or object) */
    data: string | any;
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `header` | `Header` | No | Optional header containing message flags (noPersist, redDot, syncOnce, dup) |
| `id` | `string` | Yes | Unique identifier for this event (typically UUID) |
| `type` | `string` | Yes | Event type/category (e.g., "user.status.changed") |
| `timestamp` | `number` | Yes | Event timestamp in milliseconds (Unix epoch) |
| `data` | `string` or `object` | Yes | Event payload data (automatically parsed from JSON if string) |

## Event Types

Event types are application-specific and should follow a hierarchical naming convention using dot notation.

### Recommended Event Type Patterns

```
<domain>.<entity>.<action>
```

### Common Event Type Examples

| Event Type | Description | Example Data |
|------------|-------------|--------------|
| `user.status.changed` | User online/offline status changed | `{ userId, status, lastSeen }` |
| `user.profile.updated` | User profile information updated | `{ userId, fields: [...] }` |
| `channel.created` | New channel created | `{ channelId, channelType, name }` |
| `channel.updated` | Channel information updated | `{ channelId, updateType, newValue }` |
| `channel.deleted` | Channel deleted | `{ channelId, channelType }` |
| `message.deleted` | Message deleted | `{ messageId, channelId }` |
| `message.recalled` | Message recalled by sender | `{ messageId, channelId }` |
| `notification.received` | System notification | `{ title, body, priority }` |
| `system.announcement` | System-wide announcement | `{ message, severity, expiresAt }` |
| `system.maintenance` | Maintenance notification | `{ startTime, endTime, message }` |

## Implementation

### Listening for Events

The SDK provides a dedicated event type for custom event notifications:

```javascript
wkim.on(WKIM.Event.CustomEvent, (eventNotification) => {
    console.log('Event received:', eventNotification);
    
    const { id, type, timestamp, data, header } = eventNotification;
    
    // Handle the event based on type
    switch (type) {
        case 'user.status.changed':
            handleUserStatusChanged(data);
            break;
        case 'system.announcement':
            handleSystemAnnouncement(data);
            break;
        // ... more handlers
    }
});
```

### Data Parsing

The SDK automatically attempts to parse the `data` field if it's a JSON string:

```javascript
// Server sends: data: "{\"userId\":\"123\",\"status\":\"online\"}"
// SDK parses to: data: { userId: "123", status: "online" }

wkim.on(WKIM.Event.CustomEvent, (event) => {
    // data is already parsed as an object
    console.log(event.data.userId);  // "123"
    console.log(event.data.status);  // "online"
});
```

If the data is not valid JSON, it remains as a string.

### Type-Specific Event Handlers

Create filtered event handlers for specific event types:

```javascript
function onEventType(eventType, callback) {
    wkim.on(WKIM.Event.CustomEvent, (eventNotification) => {
        if (eventNotification.type === eventType) {
            callback(eventNotification);
        }
    });
}

// Usage
onEventType('user.status.changed', (event) => {
    console.log('User status changed:', event.data);
});

onEventType('system.announcement', (event) => {
    showNotification(event.data.message);
});
```

## Usage Examples

### Example 1: User Status Updates

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'user.status.changed') {
        const { userId, status, lastSeen } = event.data;
        
        // Update UI
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.classList.remove('online', 'offline', 'away');
            userElement.classList.add(status);
            
            if (status === 'offline' && lastSeen) {
                userElement.setAttribute('title', `Last seen: ${new Date(lastSeen).toLocaleString()}`);
            }
        }
    }
});
```

### Example 2: System Announcements

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'system.announcement') {
        const { message, severity, expiresAt } = event.data;
        
        // Show banner notification
        const banner = document.createElement('div');
        banner.className = `announcement-banner ${severity}`;
        banner.textContent = message;
        document.body.prepend(banner);
        
        // Auto-hide after expiration
        if (expiresAt) {
            const timeout = expiresAt - Date.now();
            setTimeout(() => banner.remove(), timeout);
        }
    }
});
```

### Example 3: Channel Updates

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'channel.updated') {
        const { channelId, channelType, updateType, newValue } = event.data;
        
        // Fetch updated channel information
        fetch(`/api/channels/${channelId}`)
            .then(response => response.json())
            .then(channelData => {
                updateChannelInUI(channelData);
            });
    }
});
```

### Example 4: Real-time Notifications

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'notification.received') {
        const { title, body, icon, priority } = event.data;
        
        // Show browser notification
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: icon || '/default-icon.png',
                tag: event.id,
                requireInteraction: priority === 'high'
            });
        }
    }
});
```

## Best Practices

### 1. Use Consistent Event Type Naming

Follow a hierarchical naming convention:
- ✅ Good: `user.status.changed`, `channel.message.deleted`
- ❌ Bad: `userStatusChanged`, `DeleteChannelMessage`

### 2. Include Relevant Context in Event Data

Provide enough information for the client to handle the event without additional requests:

```javascript
// ✅ Good: Includes all necessary information
{
    type: "user.status.changed",
    data: {
        userId: "user123",
        status: "online",
        lastSeen: 1704067200000,
        deviceType: "mobile"
    }
}

// ❌ Bad: Requires additional request to get details
{
    type: "user.status.changed",
    data: {
        userId: "user123"
    }
}
```

### 3. Handle Unknown Event Types Gracefully

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    const handler = eventHandlers[event.type];
    
    if (handler) {
        handler(event.data);
    } else {
        console.log(`Unhandled event type: ${event.type}`);
        // Don't throw errors for unknown event types
    }
});
```

### 4. Validate Event Data

Always validate event data before using it:

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    if (event.type === 'user.status.changed') {
        const { userId, status } = event.data || {};
        
        if (!userId || !status) {
            console.error('Invalid user status event data:', event.data);
            return;
        }
        
        updateUserStatus(userId, status);
    }
});
```

### 5. Use Event IDs for Deduplication

Store processed event IDs to prevent duplicate handling:

```javascript
const processedEvents = new Set();

wkim.on(WKIM.Event.CustomEvent, (event) => {
    // Check if already processed
    if (processedEvents.has(event.id)) {
        console.log('Duplicate event ignored:', event.id);
        return;
    }
    
    // Process event
    handleEvent(event);
    
    // Mark as processed
    processedEvents.add(event.id);
    
    // Clean up old IDs (keep last 1000)
    if (processedEvents.size > 1000) {
        const firstId = processedEvents.values().next().value;
        processedEvents.delete(firstId);
    }
});
```

## Error Handling

### SDK Error Events

The SDK emits error events for invalid event notifications:

```javascript
wkim.on(WKIM.Event.Error, (error) => {
    console.error('SDK Error:', error);
    
    // Check if it's an event-related error
    if (error.message.includes('event notification')) {
        // Handle event processing errors
        notifyUser('Failed to process server event');
    }
});
```

### Try-Catch in Event Handlers

Wrap event handlers in try-catch to prevent crashes:

```javascript
wkim.on(WKIM.Event.CustomEvent, (event) => {
    try {
        handleEvent(event);
    } catch (error) {
        console.error('Error handling event:', error);
        // Report error to monitoring service
        reportError(error, { eventType: event.type, eventId: event.id });
    }
});
```

## Complete Example

See [example/event-example.js](../example/event-example.js) for a complete working example demonstrating all Event protocol features.

## Related Documentation

- [WuKongIM RPC Schema](./wukongim_rpc_schema.json) - Complete protocol specification
- [Main README](../README.md) - SDK overview and getting started guide

