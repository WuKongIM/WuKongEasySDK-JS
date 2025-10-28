// import { v4 as uuidv4 } from 'uuid'; // Remove this line

// --- Environment Detection and WebSocket Initialization ---
let WebSocketImpl: any; // Use 'any' initially to avoid complex type conflicts
if (typeof WebSocket !== 'undefined') {
    // Browser environment
    WebSocketImpl = WebSocket;
} else {
    // Node.js environment (or environment without native WebSocket)
    // Dynamically import 'ws' only if needed
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Ws = require('ws') as typeof import('ws'); // Type the require
        WebSocketImpl = Ws.WebSocket || Ws; // Handle potential default export differences
    } catch (e) {
        throw new Error('WebSocket is not available in this environment. Install \'ws\' package for Node.js.');
    }
}

// --- Enums and Types ---

/**
 * Channel Type Enum based on WuKongIM protocol
 */
export enum ChannelType {
    /** Person channel */
    Person = 1,
    /** Group channel */
    Group = 2,
    /** Customer Service channel (Consider using Visitors channel instead) */
    CustomerService = 3,
    /** Community channel */
    Community = 4,
    /** Community Topic channel */
    CommunityTopic = 5,
    /** Info channel (with concept of temporary subscribers) */
    Info = 6,
    /** Data channel */
    Data = 7,
    /** Temporary channel */
    Temp = 8,
    /** Live channel (does not save recent session data) */
    Live = 9,
    /** Visitors channel (replaces CustomerService for new implementations) */
    Visitors = 10,
}

/**
 * SDK Event Names Enum
 */
export enum Event {
    /** Connection successfully established and authenticated */
    Connect = 'connect',
    /** Disconnected from server */
    Disconnect = 'disconnect',
    /** Received a message */
    Message = 'message',
    /** An error occurred (WebSocket error, connection error, etc.) */
    Error = 'error',
    /** Received acknowledgment for a sent message */
    SendAck = 'sendack',
    /** The SDK is attempting to reconnect */
    Reconnecting = 'reconnecting',
    /** Received a custom event notification from the server */
    CustomEvent = 'customevent',
}

/**
 * Reason codes for operation results and disconnect causes.
 * Mirrors the server-side ReasonCode (Go) values; do not reorder to preserve numeric mapping.
 */
export enum ReasonCode {
    /** Unknown error */
    Unknown = 0,
    /** Success */
    Success = 1,
    /** Authentication failed */
    AuthFail = 2,
    /** Subscriber does not exist in the channel */
    SubscriberNotExist = 3,
    /** In blacklist */
    InBlacklist = 4,
    /** Channel does not exist */
    ChannelNotExist = 5,
    /** User not on node */
    UserNotOnNode = 6,
    /** Sender is offline; message cannot be delivered */
    SenderOffline = 7,
    /** Message key error; the message is invalid */
    MsgKeyError = 8,
    /** Payload decode failed */
    PayloadDecodeError = 9,
    /** Forwarding send packet failed */
    ForwardSendPacketError = 10,
    /** Not allowed to send */
    NotAllowSend = 11,
    /** Connection kicked */
    ConnectKick = 12,
    /** Not in whitelist */
    NotInWhitelist = 13,
    /** Failed to query user token */
    QueryTokenError = 14,
    /** System error */
    SystemError = 15,
    /** Invalid channel ID */
    ChannelIDError = 16,
    /** Node matching error */
    NodeMatchError = 17,
    /** Node not matched */
    NodeNotMatch = 18,
    /** Channel is banned */
    Ban = 19,
    /** Unsupported header */
    NotSupportHeader = 20,
    /** clientKey is empty */
    ClientKeyIsEmpty = 21,
    /** Rate limit */
    RateLimit = 22,
    /** Unsupported channel type */
    NotSupportChannelType = 23,
    /** Channel disbanded */
    Disband = 24,
    /** Sending is banned */
    SendBan = 25,
}


interface AuthOptions {
    uid: string;
    token: string;
    deviceId?: string;
    deviceFlag?: number; // 1:APP, 2:WEB etc.
}

interface ConnectResult {
    serverKey: string;
    salt: string;
    timeDiff: number;
    reasonCode: ReasonCode;
    serverVersion?: number;
    nodeId?: number;
}

interface SendResult {
    messageId: string;
    messageSeq: number;
    reasonCode: ReasonCode;
}

export interface Header {
    noPersist?: boolean;
    redDot?: boolean;
    syncOnce?: boolean;
    dup?: boolean;
}

export interface RecvMessage {
    header: Header;
    messageId: string;
    messageSeq: number;
    timestamp: number;
    channelId: string;
    channelType: number;
    fromUid: string;
    payload: any; // Business-defined payload
    // Optional fields based on protocol version/settings
    clientMsgNo?: string;
    streamNo?: string;
    streamId?: string;
    streamFlag?: number;
    topic?: string;
}

/**
 * Event Notification Interface
 * Represents a custom event notification from the server
 */
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

interface ErrorObject {
    code: number;
    message: string;
    data?: any;
}

interface JsonRpcRequest {
    method: string;
    params: any;
    id: string; // Request ID
}

interface JsonRpcResponse {
    result?: any;
    error?: ErrorObject;
    id: string; // Corresponds to Request ID
}

interface JsonRpcNotification {
    method: string;
    params: any;
}

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutTimer: NodeJS.Timeout;
};

type EventHandler = (...args: any[]) => void;

// --- WKIM Class ---

export class WKIM {
    private static globalInstance: WKIM | null = null;

    private ws: WebSocket | null = null;
    private url: string;
    private auth: AuthOptions;
    public isConnected: boolean = false;
    private connectionPromise: { resolve: (value: void | PromiseLike<void>) => void; reject: (reason?: any) => void; } | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private pingTimeout: NodeJS.Timeout | null = null;
    private PING_INTERVAL_MS = 25 * 1000; // Send ping every 25 seconds
    private PONG_TIMEOUT_MS = 10 * 1000; // Expect pong within 10 seconds

    private pendingRequests: Map<string, PendingRequest> = new Map();
    private eventListeners: Map<Event, EventHandler[]> = new Map();

    // Reconnection properties
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private initialReconnectDelay: number = 1000;
    private isReconnecting: boolean = false;
    private manualDisconnect: boolean = false;
    private sessionId: string;
    private beforeUnloadHandler: (() => void) | null = null;

    private constructor(url: string, auth: AuthOptions) {
        this.url = url;
        this.auth = auth || {};
        this.sessionId = this.generateUUID(); // Unique session identifier

        // Ensure unique deviceId for each session
        if (!this.auth.deviceId || this.auth.deviceId === '') {
            this.auth.deviceId = `web_${this.sessionId.slice(0, 8)}_${Date.now()}`;
        }
        // Ensure Event enum values are used for internal map keys
        Object.values(Event).forEach(event => this.eventListeners.set(event, []));

        // Setup beforeunload handler to cleanup connection on page refresh/close
        this.setupBeforeUnloadHandler();
    }

    /**
     * Initializes the WKIM instance.
     * @param url WebSocket server URL (e.g., "ws://localhost:5100")
     * @param auth Authentication options { uid, token, ... }
     * @param options Configuration options { singleton: boolean }
     * @returns A WKIM instance
     */
    public static init(url: string, auth: AuthOptions, options: { singleton?: boolean } = {}): WKIM {
        if (!url || !auth || !auth.uid || !auth.token) {
            throw new Error("URL, uid, and token are required for initialization.");
        }

        // If singleton mode is enabled and there's an existing instance, disconnect it first
        if (options.singleton && WKIM.globalInstance) {
            console.log("Destroying previous global instance...");
            WKIM.globalInstance.destroy();
        }

        const instance = new WKIM(url, auth);

        if (options.singleton !== false) {
            WKIM.globalInstance = instance;
        }

        return instance;
    }

    /**
     * Establishes connection and authenticates with the server.
     * Returns a Promise that resolves on successful connection/authentication,
     * or rejects on failure.
     */
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
             if (this.isConnected || this.ws?.readyState === WebSocket.CONNECTING) {
                console.warn("Connection already established or in progress.");
                // If already connected, resolve immediately. If connecting, wait for existing promise.
                if (this.isConnected) {
                    resolve();
                } else if (this.connectionPromise) {
                    this.connectionPromise.resolve = resolve; // Chain the promises
                    this.connectionPromise.reject = reject;
                } else {
                     reject(new Error("Already connecting, but no connection promise found."));
                }
                return;
            }

            // On a new connect call, reset manual disconnect flag
            this.manualDisconnect = false;

            this.connectionPromise = { resolve, reject };

            try {
                console.log(`Connecting to ${this.url}...`);
                this.ws = new WebSocketImpl(this.url) as WebSocket;

                this.ws.onopen = () => {
                    console.log("WebSocket connection opened. Authenticating...");
                    this.sendConnectRequest();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (event: any) => {
                    const errorMessage = event.message || (event.error ? event.error.message : 'WebSocket error');
                    console.error("WebSocket error:", errorMessage, event);
                    this.emit(Event.Error, event.error || new Error(errorMessage));
                    // The 'onclose' event will be fired next, which will handle cleanup and reconnection logic.
                };

                this.ws.onclose = (event) => {
                    const wasConnected = this.isConnected;
                    console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);

                    if (this.connectionPromise && !this.isConnected) { // Reject connect promise if closed before connect ack
                        this.connectionPromise.reject(new Error(`Connection closed before authentication (Code: ${event.code})`));
                    }

                    this.cleanupConnection(); // Clean up state like intervals, pending requests.
                    this.emit(Event.Disconnect, { code: event.code, reason: event.reason });

                    // Only try to reconnect if we were previously connected and it wasn't a manual disconnect.
                    if (wasConnected && !this.manualDisconnect) {
                        this.tryReconnect();
                    }
                };
            } catch (error) {
                console.error("Failed to create WebSocket:", error);
                this.emit(Event.Error, error);
                 if (this.connectionPromise) {
                     this.connectionPromise.reject(error);
                     this.connectionPromise = null;
                 }
                this.cleanupConnection();
            }
        });
    }

    /**
     * Disconnects from the server.
     */
    public disconnect(): void {
        console.log("Manual disconnect initiated.");
        this.manualDisconnect = true;
        this.isReconnecting = false; // Stop any ongoing reconnection attempts
        this.cleanupBeforeUnloadHandler(); // Remove page unload listeners
        this.handleDisconnect(true, "Manual disconnection");
    }

    /**
     * Completely destroys the SDK instance, cleaning up all resources.
     * Call this when you no longer need the SDK instance.
     */
    public destroy(): void {
        console.log("Destroying SDK instance...");
        this.disconnect();
        this.eventListeners.clear();
        this.pendingRequests.clear();

        // Clear global instance if this is it
        if (WKIM.globalInstance === this) {
            WKIM.globalInstance = null;
        }
    }

    /**
     * Sends a message to a specific channel.
     * @param channelId Target channel ID
     * @param channelType Target channel type (e.g., WKIM.ChannelType.Person)
     * @param payload Message payload (must be a JSON-serializable object)
     * @param options Optional: { clientMsgNo, header, setting, msgKey, expire, topic }
     * @returns Promise resolving with { messageId, messageSeq } on server ack, or rejecting on error.
     */
    public send(
        channelId: string,
        channelType: ChannelType | number,
        payload: object,
        options: {
            clientMsgNo?: string;
            header?: Header; // Define Header type based on protocol if needed
            setting?: any; // Define SettingFlags type based on protocol if needed
            topic?: string;
        } = {}
    ): Promise<SendResult> {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error("Not connected. Call connect() first."));
        }
        if (typeof payload !== 'object' || payload === null) {
             return Promise.reject(new Error("Payload must be a non-null object."));
        }

        const header = options.header || {};
        header.redDot = true


        const clientMsgNo = options.clientMsgNo || this.generateUUID(); // Generate a unique message ID if not provided
        const params = {
            clientMsgNo: clientMsgNo,
            channelId: channelId,
            channelType: channelType,
            payload: payload,
            header: header,
            topic: options.topic,
            setting: options.setting,
        };

        return this.sendRequest<SendResult>('send', params);
    }

    /**
     * Registers an event listener.
     * @param eventName The event to listen for (e.g., WKIM.Event.Message)
     * @param callback The function to call when the event occurs
     */
    public on(eventName: Event, callback: EventHandler): void {
        if (this.eventListeners.has(eventName)) {
            this.eventListeners.get(eventName)?.push(callback);
        } else {
            console.warn(`Attempted to register listener for unknown event: ${eventName}`);
        }
    }

     /**
     * Removes an event listener.
     * @param eventName The event to stop listening for
     * @param callback The specific callback function to remove
     */
    public off(eventName: Event, callback: EventHandler): void {
         if (this.eventListeners.has(eventName)) {
            const listeners = this.eventListeners.get(eventName);
            if (listeners) {
                 const index = listeners.indexOf(callback);
                 if (index > -1) {
                     listeners.splice(index, 1);
                 }
            }
        }
    }

    // --- Private Methods ---

    private emit(eventName: Event, ...args: any[]): void {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private sendConnectRequest(): void {
        const params = {
            uid: this.auth.uid,
            token: this.auth.token,
            deviceId: this.auth.deviceId,
            deviceFlag: this.auth.deviceFlag || 2, // Default to WEB
            clientTimestamp: Date.now(),
            // Add version, clientKey if needed
        };
        this.sendRequest<ConnectResult>('connect', params, 5000) // 5s timeout for connect
            .then(result => {
                console.log("Authentication successful:", result);
                this.isConnected = true;

                // Reset reconnection state on successful connect
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                this.manualDisconnect = false;

                this.startPing();
                this.emit(Event.Connect, result);
                 if (this.connectionPromise) {
                    this.connectionPromise.resolve();
                    this.connectionPromise = null;
                }
            })
            .catch(error => {
                console.error("Authentication failed:", error);
                this.emit(Event.Error, new Error(`Authentication failed: ${error.message || JSON.stringify(error)}`));
                 if (this.connectionPromise) {
                    this.connectionPromise.reject(error);
                    this.connectionPromise = null;
                }
                // Don't start reconnection on auth failure, it's a permanent error.
                this.handleDisconnect(false, "Authentication failed"); // Close connection on auth failure
                this.cleanupConnection(); // Ensure ws is closed
            });
    }

    private sendRequest<T>(method: string, params: any, timeoutMs = 15000): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error("WebSocket is not open."));
            }

            const requestId = this.generateUUID(); // Generate a unique request ID
            const request: JsonRpcRequest = {
                method: method,
                params: params,
                id: requestId
            };

            const timeoutTimer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout for method ${method} (id: ${requestId})`));
            }, timeoutMs);

            this.pendingRequests.set(requestId, { resolve, reject, timeoutTimer });

            try {
                 console.debug(`--> Sending request (id: ${requestId}):`, JSON.stringify(request));
                this.ws.send(JSON.stringify(request));
            } catch (error) {
                 clearTimeout(timeoutTimer);
                 this.pendingRequests.delete(requestId);
                console.error(`Error sending request (id: ${requestId}):`, error);
                reject(error);
            }
        });
    }

     private sendNotification(method: string, params: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("Cannot send notification, WebSocket is not open.");
            return;
        }

        const notification: JsonRpcNotification = {
            method: method,
            params: params
        };
         console.debug(`--> Sending notification:`, JSON.stringify(notification));
        try {
            this.ws.send(JSON.stringify(notification));
        } catch (error) {
            console.error(`Error sending notification (${method}):`, error);
            this.emit(Event.Error, new Error(`Failed to send notification ${method}: ${error}`));
        }
    }

    private handleMessage(data: any): void {
         console.debug("<-- Received raw:", data);
        let message: JsonRpcResponse | JsonRpcNotification;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            console.error("Failed to parse incoming message:", error, data);
            this.emit(Event.Error, new Error(`Failed to parse message: ${error}`));
            return;
        }

        if ('id' in message) { // It's a Response
            this.handleResponse(message as JsonRpcResponse);
        } else if ('method' in message) { // It's a Notification
            this.handleNotification(message as JsonRpcNotification);
        } else {
            console.warn("Received unknown message format:", message);
        }
    }

    private handleResponse(response: JsonRpcResponse): void {
         console.debug(`<-- Handling response (id: ${response.id}):`, response);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
            clearTimeout(pending.timeoutTimer);
            this.pendingRequests.delete(response.id);
            if (response.error) {
                pending.reject(response.error);
            } else {
                pending.resolve(response.result);
            }
        } else {
            console.warn(`Received response for unknown request ID: ${response.id}`);
        }
    }

    private handleNotification(notification: JsonRpcNotification): void {
         console.debug(`<-- Handling notification (${notification.method}):`, notification.params);
        switch (notification.method) {
            case 'recv':
                const messageData = notification.params as RecvMessage;
                this.emit(Event.Message, messageData);
                // Automatically acknowledge receipt
                this.sendRecvAck(messageData.header, messageData.messageId, messageData.messageSeq);
                break;
            case 'pong':
                 this.handlePong();
                 break;
            case 'disconnect':
                 console.warn('Server initiated disconnect:', notification.params);
                 this.emit(Event.Disconnect, notification.params); // Emit server reason
                 this.handleDisconnect(false, `Server disconnected: ${notification.params?.reason || notification.params?.reasonCode}`); // Close locally
                 break;
            case 'event':
                 this.handleEventNotification(notification.params);
                 break;
            // Handle other notifications if needed
            default:
                console.warn(`Received unhandled notification method: ${notification.method}`);
        }
    }

    private sendRecvAck(header: Header, messageId: string, messageSeq: number): void {
        // Per protocol, recvack is a request, but usually doesn't need a response processed
        // Sending as a notification might be simpler if the server allows it,
        // but sticking to the doc: send as request, ignore response.
        const params = { header,messageId, messageSeq };
        this.sendNotification('recvack', params);

        // Alternative: Send as notification if server supports it (non-standard)
        // this.sendNotification('recvack', params);
    }

    /**
     * Handles incoming event notifications from the server
     * @param params Event notification parameters
     */
    private handleEventNotification(params: any): void {
        try {
            const eventData: EventNotification = {
                header: params.header,
                id: params.id,
                type: params.type,
                timestamp: params.timestamp,
                data: params.data
            };

            // Validate required fields
            if (!eventData.id || !eventData.type) {
                console.error('Invalid event notification: missing required fields', params);
                this.emit(Event.Error, new Error('Invalid event notification: missing required fields'));
                return;
            }

            // Try to parse data if it's a JSON string
            if (typeof eventData.data === 'string') {
                try {
                    eventData.data = JSON.parse(eventData.data);
                } catch (e) {
                    // Keep as string if not valid JSON
                    console.debug('Event data is not JSON, keeping as string');
                }
            }

            console.log(`Event notification received: type=${eventData.type}, id=${eventData.id}`);

            // Emit the custom event to registered listeners
            this.emit(Event.CustomEvent, eventData);
        } catch (error) {
            console.error('Error handling event notification:', error);
            this.emit(Event.Error, new Error(`Failed to handle event notification: ${error}`));
        }
    }

     private startPing(): void {
        this.stopPing(); // Clear existing timers
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendRequest('ping', {}, this.PONG_TIMEOUT_MS)
                    .then(this.handlePong.bind(this)) // Technically pong is a notification, but use req/res for timeout
                    .catch(err => {
                        console.error("Ping failed or timed out:", err);
                        this.emit(Event.Error, new Error("Ping timeout"));
                        this.tryReconnect(); // Initiate reconnection on ping timeout
                    });
            } else {
                 this.stopPing(); // Stop if WS is not open
            }
        }, this.PING_INTERVAL_MS);
         console.log(`Ping interval started (${this.PING_INTERVAL_MS}ms).`);
    }

     private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
             console.log("Ping interval stopped.");
        }
         if (this.pingTimeout) {
             clearTimeout(this.pingTimeout);
             this.pingTimeout = null;
         }
    }

     private handlePong(): void {
         // console.debug("Pong received.");
         // Reset pong timeout if using one (mainly handled by sendRequest timeout now)
     }

     private handleDisconnect(graceful: boolean, reason: string): void {
         console.log(`Handling disconnect. Graceful: ${graceful}, Reason: ${reason}`);
        if (this.ws) {
            this.stopPing();
            if (graceful && this.ws.readyState === WebSocket.OPEN) {
                // Use standard close codes: 1000 (normal), 3000-4999 (custom)
                this.ws.close(1000, "Client disconnected"); // Normal closure
            } else if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
                 // Force close with custom code for abnormal situations
                this.ws.close(3001, reason.substring(0, 123)); // Custom code, limit reason length
            }
        }
        this.cleanupConnection(); // Clean up state regardless of how close happened
    }

    private cleanupConnection(): void {
        console.log("Cleaning up connection resources.");
        this.isConnected = false;
        this.stopPing();

        // Reject any pending requests
        this.pendingRequests.forEach((pending) => {
            clearTimeout(pending.timeoutTimer);
            pending.reject(new Error("Connection closed"));
        });
        this.pendingRequests.clear();

         // Clear connection promise if it exists and hasn't resolved/rejected
         if (this.connectionPromise) {
             // Only reject if we're not in a reconnection loop that will try again.
             if(!this.isReconnecting && !this.isConnected) {
                this.connectionPromise.reject(new Error("Connection closed during operation"));
             }
             this.connectionPromise = null;
         }

        // Don't nullify ws immediately if onclose handler needs it, but ensure no further ops
        if (this.ws) {
            // Remove listeners to prevent potential memory leaks and duplicate handling
             this.ws.onopen = null;
             this.ws.onmessage = null;
             this.ws.onerror = null;
             this.ws.onclose = null;
             // Consider setting this.ws = null here or after a short delay if needed
        }
        // Do NOT clear eventListeners here, user might want to reconnect.
    }

    // --- Reconnection Methods ---

    private setupBeforeUnloadHandler(): void {
        // Only setup in browser environment
        if (typeof window !== 'undefined') {
            this.beforeUnloadHandler = () => {
                console.log('Page unloading, closing WebSocket connection...');
                this.manualDisconnect = true;
                this.isReconnecting = false;
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close(1000, 'Page unloaded');
                }
            };
            window.addEventListener('beforeunload', this.beforeUnloadHandler);
            window.addEventListener('pagehide', this.beforeUnloadHandler);
        }
    }

    private cleanupBeforeUnloadHandler(): void {
        if (typeof window !== 'undefined' && this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            window.removeEventListener('pagehide', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
    }

    private tryReconnect(): void {
        if (this.isReconnecting || this.manualDisconnect) {
            return;
        }

        // The onclose event handler should have already called cleanupConnection.
        this.isReconnecting = true;
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnect attempts reached. Giving up.");
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.emit(Event.Error, new Error("Reconnection failed."));
            return;
        }

        const delay = this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`Will attempt to reconnect in ${delay / 1000}s (Attempt ${this.reconnectAttempts}).`);
        this.emit(Event.Reconnecting, { attempt: this.reconnectAttempts, delay });

        setTimeout(() => {
            // Check if a manual disconnect happened while waiting
            if (!this.isReconnecting) {
                console.log("Reconnection aborted.");
                return;
            }
            this.connect().catch(() => {
                // connect() rejects if it fails. Schedule the next attempt.
                if(this.isReconnecting) {
                    this.scheduleReconnect();
                }
            });
        }, delay);
    }

}

// Export ChannelType and Event enums alongside the class for easier use
export { ChannelType as WKIMChannelType, Event as WKIMEvent };