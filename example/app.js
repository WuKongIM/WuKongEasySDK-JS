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

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(message);
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

    log("Initializing WKIM");
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
            .catch(() => {
                log('Connection attempt failed');
                updateUI(false);
                connectBtn.textContent = 'Connect';
            });

    } catch (_) {
        log('Initialization failed');
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
    } catch (_) {
        log('Message payload validation failed');
        return;
    }

    log("Sending message...");
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    im.send(targetId, WKIMChannelType.Person, payload) // Assuming Person type for simplicity
        .then(ack => {
            log(`Message sent successfully (sequence: ${ack.messageSeq})`);
        })
        .catch(() => {
            log('Message send failed');
        })
        .finally(() => {
             sendBtn.disabled = false;
             sendBtn.textContent = 'Send Message';
        });
}

function setupEventListeners() {
    if (!im) return;

    im.on(WKIMEvent.Connect, () => {
        log("Event: Connected!");
        updateUI(true);
        connectBtn.textContent = 'Connect'; // Reset button text
    });

    im.on(WKIMEvent.Disconnect, (reason) => {
        log(`Event: Disconnected (code: ${reason?.code ?? 'unknown'})`);
        updateUI(false);
        connectBtn.textContent = 'Connect'; // Reset button text
    });

    im.on(WKIMEvent.Message, (message) => {
        log(`Event: Message received (sequence: ${message.messageSeq}, channelType: ${message.channelType})`);
        // Render message.payload in the chat UI; do not write it to production logs.
    });

    im.on(WKIMEvent.Error, () => {
        log('Event: SDK operation failed');
        // Optionally update UI based on error type (e.g., if it forces disconnect)
    });

    // Example of adding a second listener for the same event
    im.on(WKIMEvent.Message, (message) => {
        console.log(`Second listener received message sequence ${message.messageSeq}`);
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
