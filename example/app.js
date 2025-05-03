// Assuming you have built the SDK using `npm run build`
// Adjust the path if your structure or build output differs
import { WKIM, WKIMChannelType, WKIMEvent } from '../dist/index.js';

// UI Elements
const serverUrlInput = document.getElementById('server-url');
const userIdInput = document.getElementById('user-id');
const tokenInput = document.getElementById('token');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const messageControls = document.querySelector('.message-controls');
const targetIdInput = document.getElementById('target-id');
const messagePayloadInput = document.getElementById('message-payload');
const sendBtn = document.getElementById('send-btn');
const logArea = document.getElementById('log-area');
const clearLogBtn = document.getElementById('clear-log-btn');

let im = null; // WKIM instance

// --- Helper Functions ---

function log(message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}${args.length > 0 ? ': ' + JSON.stringify(args, null, 2) : ''}\n`;
    console.log(message, ...args);
    if (logArea) {
        logArea.textContent += logEntry;
        logArea.scrollTop = logArea.scrollHeight; // Auto-scroll
    }
}

function updateUI(isConnected) {
    if (connectBtn) connectBtn.disabled = isConnected;
    if (disconnectBtn) disconnectBtn.disabled = !isConnected;
    if (serverUrlInput) serverUrlInput.disabled = isConnected;
    if (userIdInput) userIdInput.disabled = isConnected;
    if (tokenInput) tokenInput.disabled = isConnected;
    if (messageControls) messageControls.style.display = isConnected ? 'block' : 'none';
    if (!isConnected) {
        im = null; // Clear instance on disconnect
    }
}

// --- Event Handlers ---

function handleConnect() {
    const url = serverUrlInput.value.trim();
    const uid = userIdInput.value.trim();
    const token = tokenInput.value.trim();

    if (!url || !uid || !token) {
        log("Error: Server URL, User ID, and Token are required.");
        return;
    }

    log(`Initializing WKIM with URL: ${url}, UID: ${uid}`);
    try {
        im = WKIM.init(url, { uid, token });
        setupEventListeners();
        log("Attempting to connect...");
        updateUI(true); // Optimistically disable connect btn
        connectBtn.textContent = 'Connecting...';

        im.connect()
            .then(() => {
                log("Connection process initiated successfully (waiting for Connect event).");
                // Actual connected state confirmed by WKIMEvent.Connect
            })
            .catch(error => {
                log("Error during connection attempt:", error);
                updateUI(false);
                connectBtn.textContent = 'Connect';
            });

    } catch (error) {
        log("Initialization Error:", error);
        updateUI(false);
        connectBtn.textContent = 'Connect';
    }
}

function handleDisconnect() {
    if (im) {
        log("Disconnecting...");
        im.disconnect();
        // UI update will happen via the Disconnect event listener
    }
}

function handleSendMessage() {
    if (!im) {
        log("Error: Not connected.");
        return;
    }

    const targetId = targetIdInput.value.trim();
    const payloadStr = messagePayloadInput.value.trim();

    if (!targetId || !payloadStr) {
        log("Error: Target User ID and Message Payload are required.");
        return;
    }

    let payload;
    try {
        payload = JSON.parse(payloadStr);
        if (typeof payload !== 'object' || payload === null) {
            throw new Error("Payload must be a JSON object.");
        }
    } catch (error) {
        log("Error parsing message payload JSON:", error.message);
        return;
    }

    log(`Sending message to ${targetId}...`, payload);
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    im.send(targetId, WKIMChannelType.Person, payload) // Assuming Person type for simplicity
        .then(ack => {
            log("Message sent successfully. Ack:", ack);
        })
        .catch(error => {
            log("Error sending message:", error);
        })
        .finally(() => {
             sendBtn.disabled = false;
             sendBtn.textContent = 'Send Message';
        });
}

function setupEventListeners() {
    if (!im) return;

    im.on(WKIMEvent.Connect, (result) => {
        log("Event: Connected!", result);
        updateUI(true);
        connectBtn.textContent = 'Connect'; // Reset button text
    });

    im.on(WKIMEvent.Disconnect, (reason) => {
        log("Event: Disconnected.", reason);
        updateUI(false);
        connectBtn.textContent = 'Connect'; // Reset button text
    });

    im.on(WKIMEvent.Message, (message) => {
        log("Event: Message Received", message);
    });

    im.on(WKIMEvent.Error, (error) => {
        log("Event: Error Occurred", error.message || error);
        // Optionally update UI based on error type (e.g., if it forces disconnect)
    });

     // Example of adding a second listener for the same event
    im.on(WKIMEvent.Message, (message) => {
        console.log("Second listener also received message:", message.messageId);
        // You can add different logic here
    });
}

// --- Attach Listeners to UI --- B

if (connectBtn) connectBtn.addEventListener('click', handleConnect);
if (disconnectBtn) disconnectBtn.addEventListener('click', handleDisconnect);
if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
        if (logArea) {
            logArea.textContent = '';
            console.log("Log cleared.");
        }
    });
}

// Initial UI state
updateUI(false);
log("Example loaded. Enter connection details and click Connect."); 