# Event Protocol Flow Diagram

## Overview

This document illustrates the flow of event notifications through the EasyJSSDK Event Protocol implementation.

## Event Notification Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WuKongIM Server                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Event Source (e.g., User Status Change, System Event)     │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Create Event Notification                                  │   │
│  │  {                                                          │   │
│  │    "jsonrpc": "2.0",                                       │   │
│  │    "method": "event",                                      │   │
│  │    "params": {                                             │   │
│  │      "id": "uuid",                                         │   │
│  │      "type": "user.status.changed",                        │   │
│  │      "timestamp": 1704067200000,                           │   │
│  │      "data": "{...}"                                       │   │
│  │    }                                                        │   │
│  │  }                                                          │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Send via WebSocket                                         │   │
│  └────────────────────┬───────────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────────────┘
                        │
                        │ WebSocket Message
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EasyJSSDK Client                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  WebSocket.onmessage                                        │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  handleMessage(data)                                        │   │
│  │  - Parse JSON                                               │   │
│  │  - Identify message type                                    │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  handleNotification(notification)                           │   │
│  │  - Check method === "event"                                 │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  handleEventNotification(params)                            │   │
│  │  1. Extract fields (id, type, timestamp, data)             │   │
│  │  2. Validate required fields                               │   │
│  │  3. Parse JSON data if string                              │   │
│  │  4. Create EventNotification object                        │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  emit(Event.CustomEvent, eventData)                        │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Registered Event Listeners                                 │   │
│  │  wkim.on(Event.CustomEvent, callback)                      │   │
│  └────────────────────┬───────────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Application Code                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Event Handler Callback                                     │   │
│  │  (event: EventNotification) => {                           │   │
│  │    console.log(event.type);                                │   │
│  │    console.log(event.data);                                │   │
│  │                                                             │   │
│  │    switch (event.type) {                                   │   │
│  │      case 'user.status.changed':                           │   │
│  │        updateUserStatus(event.data);                       │   │
│  │        break;                                               │   │
│  │      case 'system.announcement':                           │   │
│  │        showAnnouncement(event.data);                       │   │
│  │        break;                                               │   │
│  │    }                                                        │   │
│  │  }                                                          │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  UI Update / Business Logic                                 │   │
│  │  - Update user status indicator                            │   │
│  │  - Show notification banner                                │   │
│  │  - Refresh data                                            │   │
│  │  - Trigger other actions                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Invalid Event Notification                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  handleEventNotification(params)                            │   │
│  │  - Missing required field (id, type, timestamp, or data)   │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Validation Failed                                          │   │
│  │  - Log error message                                        │   │
│  │  - Create error object                                      │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  emit(Event.Error, error)                                  │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Error Event Listeners                                      │   │
│  │  wkim.on(Event.Error, callback)                            │   │
│  └────────────────────┬───────────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Application Code                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Error Handler                                              │   │
│  │  (error) => {                                              │   │
│  │    if (error.message.includes('event notification')) {    │   │
│  │      console.error('Invalid event:', error);              │   │
│  │      // Handle error appropriately                        │   │
│  │    }                                                        │   │
│  │  }                                                          │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Parsing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Event Data Parsing                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Receive event.data                                         │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Check: typeof data === 'string'?                          │   │
│  └────────────┬───────────────────────────────┬───────────────┘   │
│               │ YES                            │ NO                 │
│               ▼                                ▼                    │
│  ┌────────────────────────────┐  ┌────────────────────────────┐   │
│  │  Try JSON.parse(data)      │  │  Use data as-is (object)   │   │
│  └────────────┬───────────────┘  └────────────┬───────────────┘   │
│               │                                │                    │
│               ▼                                │                    │
│  ┌────────────────────────────┐               │                    │
│  │  Parse successful?         │               │                    │
│  └────────┬───────────┬───────┘               │                    │
│           │ YES       │ NO                     │                    │
│           ▼           ▼                        │                    │
│  ┌────────────┐  ┌────────────┐               │                    │
│  │ Use parsed │  │ Keep as    │               │                    │
│  │ object     │  │ string     │               │                    │
│  └────────┬───┘  └────────┬───┘               │                    │
│           │               │                    │                    │
│           └───────────────┴────────────────────┘                    │
│                           │                                         │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Emit event with processed data                            │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Event Type Routing Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Event Routing                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  wkim.on(Event.CustomEvent, (event) => { ... })           │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Check event.type                                           │   │
│  └────────────────────┬───────────────────────────────────────┘   │
│                       │                                             │
│         ┌─────────────┼─────────────┬─────────────┐                │
│         │             │             │             │                │
│         ▼             ▼             ▼             ▼                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  user.*  │  │ channel.*│  │ system.* │  │  other   │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │             │                  │
│       ▼             ▼             ▼             ▼                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Handle   │  │ Handle   │  │ Handle   │  │ Log      │          │
│  │ user     │  │ channel  │  │ system   │  │ unknown  │          │
│  │ events   │  │ events   │  │ events   │  │ event    │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Complete Integration Example

```javascript
// 1. Initialize SDK
const wkim = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'auth-token'
});

// 2. Setup event handlers
const eventHandlers = {
    'user.status.changed': (data) => {
        updateUserStatus(data.userId, data.status);
    },
    'channel.updated': (data) => {
        refreshChannel(data.channelId);
    },
    'system.announcement': (data) => {
        showNotification(data.message);
    }
};

// 3. Register event listener
wkim.on(WKIM.Event.CustomEvent, (event) => {
    const handler = eventHandlers[event.type];
    if (handler) {
        try {
            handler(event.data);
        } catch (error) {
            console.error('Error handling event:', error);
        }
    }
});

// 4. Register error handler
wkim.on(WKIM.Event.Error, (error) => {
    console.error('SDK Error:', error);
});

// 5. Connect
await wkim.connect();

// Now the SDK will automatically:
// - Receive event notifications from server
// - Parse and validate them
// - Emit CustomEvent with parsed data
// - Your handlers will process the events
```

## Sequence Diagram

```
Server          WebSocket       SDK              Application
  |                |             |                    |
  |-- Event ------>|             |                    |
  |                |-- Data ---->|                    |
  |                |             |-- Parse ---------->|
  |                |             |                    |
  |                |             |-- Validate ------->|
  |                |             |                    |
  |                |             |-- Parse JSON ----->|
  |                |             |                    |
  |                |             |-- Emit Event ----->|
  |                |             |                    |
  |                |             |                    |-- Handle
  |                |             |                    |
  |                |             |                    |-- Update UI
  |                |             |                    |
```

## Summary

The Event Protocol implementation provides:

1. **Automatic Processing** - Events are automatically received and parsed
2. **Type Safety** - Full TypeScript support with proper types
3. **Error Handling** - Invalid events trigger error events
4. **Flexible Routing** - Easy to route events by type
5. **JSON Parsing** - Automatic parsing of JSON data strings
6. **Validation** - Required fields are validated before emission

This architecture ensures reliable, type-safe event handling while maintaining simplicity for developers.

