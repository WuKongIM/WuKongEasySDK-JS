/**
 * EasyJSSDK Event Protocol Example
 * 
 * This example demonstrates how to use the Event protocol to receive
 * custom event notifications from the WuKongIM server.
 */

// Import the SDK (adjust path based on your setup)
// For browser: <script src="../dist/index.js"></script>
// For Node.js: const { WKIM, Event } = require('../dist/index.js');

// Initialize the SDK
const wkim = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'your-auth-token',
    deviceId: 'web-device-001',
    deviceFlag: 2 // 2 = WEB
});

// ============================================
// Event Protocol Listener
// ============================================

/**
 * Listen for custom event notifications from the server
 * 
 * Event notifications have the following structure:
 * {
 *   header: { ... },      // Optional header with message flags
 *   id: "event-uuid",     // Unique event identifier
 *   type: "event.type",   // Event type/category
 *   timestamp: 1234567890, // Event timestamp (milliseconds)
 *   data: { ... }         // Event data (parsed from JSON if applicable)
 * }
 */
wkim.on(WKIM.Event.CustomEvent, (eventNotification) => {
    console.log('📢 Custom Event Received:', eventNotification);
    
    // Access event properties
    const { id, type, timestamp, data, header } = eventNotification;
    
    console.log(`Event ID: ${id}`);
    console.log(`Event Type: ${type}`);
    console.log(`Event Timestamp: ${new Date(timestamp).toISOString()}`);
    console.log(`Event Data:`, data);
    
    if (header) {
        console.log(`Event Header:`, header);
    }
    
    // Handle different event types
    switch (type) {
        case 'user.status.changed':
            handleUserStatusChanged(data);
            break;
        case 'channel.updated':
            handleChannelUpdated(data);
            break;
        case 'notification.received':
            handleNotificationReceived(data);
            break;
        case 'system.announcement':
            handleSystemAnnouncement(data);
            break;
        default:
            console.log(`Unhandled event type: ${type}`);
    }
});

// ============================================
// Event Type Handlers
// ============================================

function handleUserStatusChanged(data) {
    console.log('👤 User Status Changed:', data);
    // Example: { userId: "user456", status: "online", lastSeen: 1234567890 }
    
    // Update UI to show user's new status
    if (data.userId && data.status) {
        updateUserStatusInUI(data.userId, data.status);
    }
}

function handleChannelUpdated(data) {
    console.log('📝 Channel Updated:', data);
    // Example: { channelId: "channel123", channelType: 2, updateType: "name", newValue: "New Channel Name" }
    
    // Refresh channel information
    if (data.channelId) {
        refreshChannelInfo(data.channelId, data.channelType);
    }
}

function handleNotificationReceived(data) {
    console.log('🔔 Notification Received:', data);
    // Example: { title: "New Message", body: "You have a new message", priority: "high" }
    
    // Show browser notification
    if (Notification.permission === 'granted') {
        new Notification(data.title || 'Notification', {
            body: data.body || '',
            icon: '/icon.png'
        });
    }
}

function handleSystemAnnouncement(data) {
    console.log('📣 System Announcement:', data);
    // Example: { message: "System maintenance scheduled", severity: "info", expiresAt: 1234567890 }
    
    // Display system announcement banner
    showAnnouncementBanner(data.message, data.severity);
}

// ============================================
// Other Event Listeners
// ============================================

// Connection established
wkim.on(WKIM.Event.Connect, (result) => {
    console.log('✅ Connected to server:', result);
});

// Disconnected from server
wkim.on(WKIM.Event.Disconnect, (info) => {
    console.log('❌ Disconnected from server:', info);
});

// Error occurred
wkim.on(WKIM.Event.Error, (error) => {
    console.error('⚠️ Error:', error);
});

// Regular message received
wkim.on(WKIM.Event.Message, (message) => {
    console.log('💬 Message received:', message);
});

// Reconnecting
wkim.on(WKIM.Event.Reconnecting, (info) => {
    console.log('🔄 Reconnecting...', info);
});

// ============================================
// Connect to Server
// ============================================

wkim.connect()
    .then(() => {
        console.log('🚀 SDK connected and ready to receive events!');
    })
    .catch((error) => {
        console.error('Failed to connect:', error);
    });

// ============================================
// Helper Functions (UI Integration Examples)
// ============================================

function updateUserStatusInUI(userId, status) {
    // Example implementation
    console.log(`Updating UI: User ${userId} is now ${status}`);
    
    // In a real application, you would update the DOM:
    // const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    // if (userElement) {
    //     userElement.classList.remove('online', 'offline', 'away');
    //     userElement.classList.add(status);
    // }
}

function refreshChannelInfo(channelId, channelType) {
    // Example implementation
    console.log(`Refreshing channel info: ${channelId} (type: ${channelType})`);
    
    // In a real application, you would fetch updated channel data:
    // fetch(`/api/channels/${channelId}`)
    //     .then(response => response.json())
    //     .then(channelData => updateChannelInUI(channelData));
}

function showAnnouncementBanner(message, severity) {
    // Example implementation
    console.log(`Showing announcement: [${severity}] ${message}`);
    
    // In a real application, you would display a banner:
    // const banner = document.createElement('div');
    // banner.className = `announcement-banner ${severity}`;
    // banner.textContent = message;
    // document.body.prepend(banner);
}

// ============================================
// Advanced: Filtering Events by Type
// ============================================

/**
 * Create a type-specific event listener
 */
function onEventType(eventType, callback) {
    wkim.on(WKIM.Event.CustomEvent, (eventNotification) => {
        if (eventNotification.type === eventType) {
            callback(eventNotification);
        }
    });
}

// Usage example:
onEventType('user.status.changed', (event) => {
    console.log('Filtered event handler for user.status.changed:', event);
});

// ============================================
// Cleanup on Page Unload
// ============================================

window.addEventListener('beforeunload', () => {
    wkim.disconnect();
});

