// import { v4 as uuidv4 } from 'uuid'; // Remove this line

// --- TypeScript Global Declarations for Mini Program Environments ---
declare const wx: WeChatMiniProgram.Wx | undefined;
declare const my: AlipayMiniProgram.My | undefined;
declare const uni: UniApp.Uni | undefined;

// WeChat Mini Program types
declare namespace WeChatMiniProgram {
    interface Wx {
        connectSocket(options: ConnectSocketOptions): SocketTask;
        arrayBufferToBase64(buffer: ArrayBuffer): string;
        base64ToArrayBuffer(base64: string): ArrayBuffer;
    }
    interface ConnectSocketOptions {
        url: string;
        header?: Record<string, string>;
        protocols?: string[];
        success?: (res: any) => void;
        fail?: (res: any) => void;
        complete?: (res: any) => void;
    }
    interface SocketTask {
        send(options: { data: string | ArrayBuffer; success?: () => void; fail?: (err: any) => void }): void;
        close(options?: { code?: number; reason?: string; success?: () => void; fail?: (err: any) => void }): void;
        onOpen(callback: (res: { header: Record<string, string> }) => void): void;
        onClose(callback: (res: { code: number; reason: string }) => void): void;
        onError(callback: (res: { errMsg: string }) => void): void;
        onMessage(callback: (res: { data: string | ArrayBuffer }) => void): void;
    }
}

// Alipay Mini Program types
declare namespace AlipayMiniProgram {
    interface My {
        connectSocket(options: ConnectSocketOptions): void;
        onSocketOpen(callback: (res: any) => void): void;
        onSocketClose(callback: (res: any) => void): void;
        onSocketError(callback: (res: { errorMessage: string }) => void): void;
        onSocketMessage(callback: (res: { data: string | ArrayBuffer }) => void): void;
        sendSocketMessage(options: { data: string; success?: () => void; fail?: (err: any) => void }): void;
        closeSocket(options?: { code?: number; reason?: string; success?: () => void; fail?: (err: any) => void }): void;
        offSocketOpen(callback?: ((res: any) => void) | null): void;
        offSocketClose(callback?: ((res: any) => void) | null): void;
        offSocketError(callback?: ((res: any) => void) | null): void;
        offSocketMessage(callback?: ((res: any) => void) | null): void;
    }
    interface ConnectSocketOptions {
        url: string;
        header?: Record<string, string>;
        success?: (res: any) => void;
        fail?: (res: any) => void;
        complete?: (res: any) => void;
    }
}

// UniApp types
declare namespace UniApp {
    interface Uni {
        connectSocket(options: ConnectSocketOptions): SocketTask;
    }
    interface ConnectSocketOptions {
        url: string;
        header?: Record<string, string>;
        protocols?: string[];
        success?: (res: any) => void;
        fail?: (res: any) => void;
        complete?: (res: any) => void;
    }
    interface SocketTask {
        send(options: { data: string | ArrayBuffer; success?: () => void; fail?: (err: any) => void }): void;
        close(options?: { code?: number; reason?: string; success?: () => void; fail?: (err: any) => void }): void;
        onOpen(callback: (res: { header: Record<string, string> }) => void): void;
        onClose(callback: (res: { code: number; reason: string }) => void): void;
        onError(callback: (res: { errMsg: string }) => void): void;
        onMessage(callback: (res: { data: string | ArrayBuffer }) => void): void;
    }
}

// --- WebSocket Adapter Interface ---
/**
 * Unified WebSocket adapter interface for cross-platform compatibility.
 * All platform-specific adapters must implement this interface.
 */
interface IWebSocketAdapter {
    readonly readyState: number;
    onopen: ((event: any) => void) | null;
    onmessage: ((event: { data: any }) => void) | null;
    onerror: ((event: any) => void) | null;
    onclose: ((event: { code: number; reason: string }) => void) | null;
    send(data: string): void;
    close(code?: number, reason?: string): void;
}

// WebSocket readyState constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

interface SDKLogger {
    debug(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

const silentLogger: SDKLogger = {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function createLogger(enabled: boolean): SDKLogger {
    if (!enabled) {
        return silentLogger;
    }

    // Log operational metadata only. Tokens, payloads, raw frames, server
    // responses, and platform error objects must never cross this boundary.
    return {
        debug: (message) => console.debug(`[WKIM] ${message}`),
        warn: (message) => console.warn(`[WKIM] ${message}`),
        error: (message) => console.error(`[WKIM] ${message}`),
    };
}

// --- Platform Type Enum ---
enum PlatformType {
    Browser = 'browser',
    NodeJS = 'nodejs',
    WeChat = 'wechat',
    Alipay = 'alipay',
    UniApp = 'uniapp'
}

// --- WeChat Mini Program WebSocket Adapter ---
class WeChatWebSocketAdapter implements IWebSocketAdapter {
    private socketTask: WeChatMiniProgram.SocketTask | null = null;
    private _readyState: number = WS_CONNECTING;
    
    onopen: ((event: any) => void) | null = null;
    onmessage: ((event: { data: any }) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;

    constructor(url: string, private readonly logger: SDKLogger) {
        if (typeof wx === 'undefined') {
            throw new Error('WeChat Mini Program environment not detected');
        }
        
        this.socketTask = wx.connectSocket({
            url: url,
            success: () => {
                this.logger.debug('WeChat WebSocket connecting');
            },
            fail: (err) => {
                this.logger.error('WeChat WebSocket connection failed');
                this._readyState = WS_CLOSED;
                if (this.onerror) {
                    this.onerror({ message: err.errMsg || 'Connection failed' });
                }
            }
        });

        this.socketTask.onOpen((res) => {
            this._readyState = WS_OPEN;
            if (this.onopen) {
                this.onopen(res);
            }
        });

        this.socketTask.onMessage((res) => {
            if (this.onmessage) {
                const data = res.data instanceof ArrayBuffer 
                    ? new TextDecoder().decode(res.data) 
                    : res.data;
                this.onmessage({ data });
            }
        });

        this.socketTask.onError((res) => {
            this.logger.error('WeChat WebSocket transport error');
            if (this.onerror) {
                this.onerror({ message: res.errMsg || 'WebSocket error' });
            }
        });

        this.socketTask.onClose((res) => {
            this._readyState = WS_CLOSED;
            if (this.onclose) {
                this.onclose({ code: res.code || 1000, reason: res.reason || '' });
            }
        });
    }

    get readyState(): number {
        return this._readyState;
    }

    send(data: string): void {
        if (this._readyState !== WS_OPEN || !this.socketTask) {
            throw new Error('WebSocket is not open');
        }
        this.socketTask.send({
            data: data,
            fail: (err) => {
                this.logger.error('WeChat WebSocket send failed');
                if (this.onerror) {
                    this.onerror({ message: 'Send failed' });
                }
            }
        });
    }

    close(code?: number, reason?: string): void {
        if (this._readyState === WS_CLOSED || this._readyState === WS_CLOSING) {
            return;
        }
        this._readyState = WS_CLOSING;
        if (this.socketTask) {
            this.socketTask.close({
                code: code || 1000,
                reason: reason || '',
                fail: () => {
                    this.logger.error('WeChat WebSocket close failed');
                }
            });
        }
    }
}

// --- Alipay Mini Program WebSocket Adapter ---
class AlipayWebSocketAdapter implements IWebSocketAdapter {
    private _readyState: number = WS_CONNECTING;
    private boundOnOpen: ((res: any) => void) | null = null;
    private boundOnMessage: ((res: any) => void) | null = null;
    private boundOnError: ((res: any) => void) | null = null;
    private boundOnClose: ((res: any) => void) | null = null;
    
    onopen: ((event: any) => void) | null = null;
    onmessage: ((event: { data: any }) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;

    constructor(url: string, private readonly logger: SDKLogger) {
        if (typeof my === 'undefined') {
            throw new Error('Alipay Mini Program environment not detected');
        }

        // Bind event handlers
        this.boundOnOpen = (res: any) => {
            this._readyState = WS_OPEN;
            if (this.onopen) {
                this.onopen(res);
            }
        };

        this.boundOnMessage = (res: any) => {
            if (this.onmessage) {
                const data = res.data instanceof ArrayBuffer 
                    ? new TextDecoder().decode(res.data) 
                    : res.data;
                this.onmessage({ data });
            }
        };

        this.boundOnError = (res: any) => {
            this.logger.error('Alipay WebSocket transport error');
            if (this.onerror) {
                this.onerror({ message: res.errorMessage || 'WebSocket error' });
            }
        };

        this.boundOnClose = (res: any) => {
            this._readyState = WS_CLOSED;
            this.cleanup();
            if (this.onclose) {
                this.onclose({ code: res.code || 1000, reason: res.reason || '' });
            }
        };

        // Register global event listeners
        my.onSocketOpen(this.boundOnOpen);
        my.onSocketMessage(this.boundOnMessage);
        my.onSocketError(this.boundOnError);
        my.onSocketClose(this.boundOnClose);

        // Connect
        my.connectSocket({
            url: url,
            success: () => {
                this.logger.debug('Alipay WebSocket connecting');
            },
            fail: (err) => {
                this.logger.error('Alipay WebSocket connection failed');
                this._readyState = WS_CLOSED;
                this.cleanup();
                if (this.onerror) {
                    this.onerror({ message: err.errorMessage || 'Connection failed' });
                }
            }
        });
    }

    get readyState(): number {
        return this._readyState;
    }

    send(data: string): void {
        if (typeof my === 'undefined') {
            throw new Error('Alipay Mini Program environment not detected');
        }
        if (this._readyState !== WS_OPEN) {
            throw new Error('WebSocket is not open');
        }
        my.sendSocketMessage({
            data: data,
            fail: (err) => {
                this.logger.error('Alipay WebSocket send failed');
                if (this.onerror) {
                    this.onerror({ message: 'Send failed' });
                }
            }
        });
    }

    close(code?: number, reason?: string): void {
        if (typeof my === 'undefined') {
            return;
        }
        if (this._readyState === WS_CLOSED || this._readyState === WS_CLOSING) {
            return;
        }
        this._readyState = WS_CLOSING;
        my.closeSocket({
            code: code || 1000,
            reason: reason || '',
            fail: () => {
                this.logger.error('Alipay WebSocket close failed');
            }
        });
    }

    private cleanup(): void {
        if (typeof my !== 'undefined') {
            my.offSocketOpen(this.boundOnOpen);
            my.offSocketMessage(this.boundOnMessage);
            my.offSocketError(this.boundOnError);
            my.offSocketClose(this.boundOnClose);
            this.boundOnOpen = null;
            this.boundOnMessage = null;
            this.boundOnError = null;
            this.boundOnClose = null;
        }
    }
}

// --- UniApp WebSocket Adapter ---
class UniAppWebSocketAdapter implements IWebSocketAdapter {
    private socketTask: UniApp.SocketTask | null = null;
    private _readyState: number = WS_CONNECTING;
    
    onopen: ((event: any) => void) | null = null;
    onmessage: ((event: { data: any }) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;

    constructor(url: string, private readonly logger: SDKLogger) {
        if (typeof uni === 'undefined') {
            throw new Error('UniApp environment not detected');
        }
        
        this.socketTask = uni.connectSocket({
            url: url,
            success: () => {
                this.logger.debug('UniApp WebSocket connecting');
            },
            fail: (err) => {
                this.logger.error('UniApp WebSocket connection failed');
                this._readyState = WS_CLOSED;
                if (this.onerror) {
                    this.onerror({ message: err.errMsg || 'Connection failed' });
                }
            }
        });

        this.socketTask.onOpen((res) => {
            this._readyState = WS_OPEN;
            if (this.onopen) {
                this.onopen(res);
            }
        });

        this.socketTask.onMessage((res) => {
            if (this.onmessage) {
                const data = res.data instanceof ArrayBuffer 
                    ? new TextDecoder().decode(res.data) 
                    : res.data;
                this.onmessage({ data });
            }
        });

        this.socketTask.onError((res) => {
            this.logger.error('UniApp WebSocket transport error');
            if (this.onerror) {
                this.onerror({ message: res.errMsg || 'WebSocket error' });
            }
        });

        this.socketTask.onClose((res) => {
            this._readyState = WS_CLOSED;
            if (this.onclose) {
                this.onclose({ code: res.code || 1000, reason: res.reason || '' });
            }
        });
    }

    get readyState(): number {
        return this._readyState;
    }

    send(data: string): void {
        if (this._readyState !== WS_OPEN || !this.socketTask) {
            throw new Error('WebSocket is not open');
        }
        this.socketTask.send({
            data: data,
            fail: (err) => {
                this.logger.error('UniApp WebSocket send failed');
                if (this.onerror) {
                    this.onerror({ message: 'Send failed' });
                }
            }
        });
    }

    close(code?: number, reason?: string): void {
        if (this._readyState === WS_CLOSED || this._readyState === WS_CLOSING) {
            return;
        }
        this._readyState = WS_CLOSING;
        if (this.socketTask) {
            this.socketTask.close({
                code: code || 1000,
                reason: reason || '',
                fail: () => {
                    this.logger.error('UniApp WebSocket close failed');
                }
            });
        }
    }
}

// --- Platform Detection and WebSocket Factory ---
function detectPlatform(): PlatformType {
    // Check for UniApp first (it may also have wx defined in WeChat mini program mode)
    if (typeof uni !== 'undefined' && typeof uni.connectSocket === 'function') {
        return PlatformType.UniApp;
    }
    // Check for WeChat Mini Program
    if (typeof wx !== 'undefined' && typeof wx.connectSocket === 'function') {
        return PlatformType.WeChat;
    }
    // Check for Alipay Mini Program
    if (typeof my !== 'undefined' && typeof my.connectSocket === 'function') {
        return PlatformType.Alipay;
    }
    // Check for browser WebSocket
if (typeof WebSocket !== 'undefined') {
        return PlatformType.Browser;
    }
    // Fallback to Node.js
    return PlatformType.NodeJS;
}

let currentPlatform: PlatformType | undefined;

function getPlatform(): PlatformType {
    if (currentPlatform === undefined) {
        currentPlatform = detectPlatform();
    }
    return currentPlatform;
}

// Factory function to create platform-appropriate WebSocket
function createWebSocket(url: string, logger: SDKLogger): IWebSocketAdapter {
    switch (getPlatform()) {
        case PlatformType.UniApp:
            return new UniAppWebSocketAdapter(url, logger);
        case PlatformType.WeChat:
            return new WeChatWebSocketAdapter(url, logger);
        case PlatformType.Alipay:
            return new AlipayWebSocketAdapter(url, logger);
        case PlatformType.Browser:
            return new WebSocket(url) as unknown as IWebSocketAdapter;
        case PlatformType.NodeJS:
        default:
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
                const dynamicRequire = new Function('mod', 'return require(mod)') as NodeRequire;
                const Ws = dynamicRequire('ws') as typeof import('ws');
                const WsImpl = Ws.WebSocket || Ws;
                return new WsImpl(url) as unknown as IWebSocketAdapter;
    } catch (e) {
        throw new Error('WebSocket is not available in this environment. Install \'ws\' package for Node.js.');
            }
    }
}

// Export platform info for debugging
export { PlatformType, getPlatform, currentPlatform }

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

/** Device categories and their wire values in the WuKongIM protocol. */
export enum DeviceFlag {
    /** APP client (protocol value: 0) */
    App = 0,
    /** Web client (protocol value: 1) */
    Web = 1,
    /** PC / desktop client (protocol value: 2) */
    Desktop = 2,
}

interface AuthOptions {
    uid: string;
    token: string;
    deviceId?: string;
    deviceFlag?: DeviceFlag | number; // 0:APP, 1:WEB, 2:PC/Desktop
}

/** SDK initialization options. Debug logging is disabled by default. */
export interface WKIMOptions {
    /** Register the instance in the global instance slot unless set to false. */
    singleton?: boolean;
    /** Emit sanitized operational metadata. Tokens, payloads, and raw frames are never logged. */
    debugLogging?: boolean;
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


/**
 * Message settings for a received message.
 * Consolidates flags previously provided as separate fields.
 */
export interface MessageSetting {
    /** Request delivery/read receipts */
    receipt?: boolean;
    /** Indicates a signaling/control message */
    signal?: boolean;
    /** Message is part of a stream */
    stream?: boolean;
    /** Message relates to a topic */
    topic?: boolean;
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
    /** Message settings consolidating stream/topic/flags */
    setting?: MessageSetting;
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

    /** Event names, also exported separately as `Event` and `WKIMEvent`. */
    public static readonly Event = Event;
    /** Channel types, also exported separately as `ChannelType` and `WKIMChannelType`. */
    public static readonly ChannelType = ChannelType;
    /** Device flags, also exported separately as `DeviceFlag` and `WKIMDeviceFlag`. */
    public static readonly DeviceFlag = DeviceFlag;

    private ws: IWebSocketAdapter | null = null;
    private url: string;
    private auth: AuthOptions;
    private readonly logger: SDKLogger;
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

    private constructor(url: string, auth: AuthOptions, options: WKIMOptions) {
        this.url = url;
        this.auth = auth || {};
        this.logger = createLogger(options.debugLogging === true);
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
     * @param options Configuration options. Debug logging is disabled by default.
     * @returns A WKIM instance
     */
    public static init(url: string, auth: AuthOptions, options: WKIMOptions = {}): WKIM {
        if (!url || !auth || !auth.uid || !auth.token) {
            throw new Error("URL, uid, and token are required for initialization.");
        }

        // If singleton mode is enabled and there's an existing instance, disconnect it first
        if (options.singleton && WKIM.globalInstance) {
            WKIM.globalInstance.destroy();
        }

        const instance = new WKIM(url, auth, options);

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
             if (this.isConnected || this.ws?.readyState === WS_CONNECTING) {
                this.logger.warn("Connection already established or in progress");
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
                this.logger.debug(`Connecting WebSocket (platform: ${getPlatform()})`);
                this.ws = createWebSocket(this.url, this.logger);

                this.ws.onopen = () => {
                    this.logger.debug("WebSocket connection opened; authenticating");
                    this.sendConnectRequest();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (event: any) => {
                    const errorMessage = event.message || (event.error ? event.error.message : 'WebSocket error');
                    this.logger.error("WebSocket transport error");
                    this.emit(Event.Error, event.error || new Error(errorMessage));
                    // The 'onclose' event will be fired next, which will handle cleanup and reconnection logic.
                };

                this.ws.onclose = (event) => {
                    const wasConnected = this.isConnected;
                    this.logger.debug(`WebSocket connection closed (code: ${event.code})`);

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
                this.logger.error("Failed to create WebSocket");
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
        this.logger.debug("Manual disconnect initiated");
        const wasActive = this.isConnected ||
            this.ws?.readyState === WS_CONNECTING ||
            this.ws?.readyState === WS_OPEN;
        this.manualDisconnect = true;
        this.isReconnecting = false; // Stop any ongoing reconnection attempts
        this.cleanupBeforeUnloadHandler(); // Remove page unload listeners
        this.handleDisconnect(true, "Manual disconnection");

        // cleanupConnection removes the transport close handler, so a manual
        // close cannot rely on the later onclose callback to notify clients.
        // Emit the lifecycle event synchronously and only for an active socket.
        if (wasActive) {
            this.emit(Event.Disconnect, {
                code: 1000,
                reason: "Client disconnected",
            });
        }
    }

    /**
     * Completely destroys the SDK instance, cleaning up all resources.
     * Call this when you no longer need the SDK instance.
     */
    public destroy(): void {
        this.logger.debug("Destroying SDK instance");
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
        if (!this.isConnected || !this.ws || this.ws.readyState !== WS_OPEN) {
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
            payload: this._encodePayloadToBase64(payload),
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
            this.logger.warn("Attempted to register listener for an unknown event");
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
                    this.logger.error("Event listener threw an error");
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
            deviceFlag: this.auth.deviceFlag ?? DeviceFlag.Web, // Default to WEB
            clientTimestamp: Date.now(),
            // Add version, clientKey if needed
        };
        this.sendRequest<ConnectResult>('connect', params, 5000) // 5s timeout for connect
            .then(result => {
                this.logger.debug("Authentication successful");
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
                this.logger.error("Authentication failed");
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
            if (!this.ws || this.ws.readyState !== WS_OPEN) {
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
                this.logger.debug(`Sending ${method} request (id=present)`);
                this.ws.send(JSON.stringify(request));
            } catch (error) {
                 clearTimeout(timeoutTimer);
                 this.pendingRequests.delete(requestId);
                this.logger.error(`Failed to send ${method} request (id=present)`);
                reject(error);
            }
        });
    }

     private sendNotification(method: string, params: any): void {
        if (!this.ws || this.ws.readyState !== WS_OPEN) {
            this.logger.error("Cannot send notification because WebSocket is not open");
            return;
        }

        const notification: JsonRpcNotification = {
            method: method,
            params: params
        };
        this.logger.debug(`Sending ${method} notification`);
        try {
            this.ws.send(JSON.stringify(notification));
        } catch (error) {
            this.logger.error(`Failed to send ${method} notification`);
            this.emit(Event.Error, new Error(`Failed to send notification ${method}: ${error}`));
        }
    }

    private handleMessage(data: any): void {
        this.logger.debug("Received WebSocket frame");
        let message: JsonRpcResponse | JsonRpcNotification;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            this.logger.error("Failed to parse incoming message");
            this.emit(Event.Error, new Error(`Failed to parse message: ${error}`));
            return;
        }

        if ('id' in message) { // It's a Response
            this.handleResponse(message as JsonRpcResponse);
        } else if ('method' in message) { // It's a Notification
            this.handleNotification(message as JsonRpcNotification);
        } else {
            this.logger.warn("Received unknown message format");
        }
    }

    private handleResponse(response: JsonRpcResponse): void {
        this.logger.debug("Handling response");
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
            this.logger.warn("Received response for unknown request ID");
        }
    }

    private handleNotification(notification: JsonRpcNotification): void {
        this.logger.debug("Handling notification");
        switch (notification.method) {
            case 'recv':
                const messageData = notification.params as RecvMessage;
                if (typeof messageData.payload === 'string') {
                    try {
                        messageData.payload = JSON.parse(this._decodeBase64ToStr(messageData.payload));
                    } catch (e) {
                        // Keep original string if decode/parse fails
                    }
                }
                this.emit(Event.Message, messageData);
                // Automatically acknowledge receipt
                this.sendRecvAck(messageData.header, messageData.messageId, messageData.messageSeq);
                break;
            case 'pong':
                 this.handlePong();
                 break;
            case 'disconnect':
                 this.logger.warn('Server initiated disconnect');
                 this.emit(Event.Disconnect, notification.params); // Emit server reason
                 this.handleDisconnect(false, `Server disconnected: ${notification.params?.reason || notification.params?.reasonCode}`); // Close locally
                 break;
            case 'event':
                 this.handleEventNotification(notification.params);
                 break;
            // Handle other notifications if needed
            default:
                this.logger.warn("Received unhandled notification method");
        }
    }

    /**
     * Encode payload object to base64 string.
     * WuKongIM server expects payload as []byte (base64 in JSON).
     */
    private _encodePayloadToBase64(payload: object): string {
        const json = JSON.stringify(payload);

        // Browser environment
        if (typeof TextEncoder !== 'undefined' && typeof btoa !== 'undefined') {
            const bytes = new TextEncoder().encode(json);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }

        // Node.js environment
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(json, 'utf-8').toString('base64');
        }

        // WeChat Mini Program environment
        if (typeof wx !== 'undefined' && wx?.arrayBufferToBase64) {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(json);
            return wx.arrayBufferToBase64(bytes.buffer);
        }

        throw new Error('No base64 encoding method available');
    }

    /**
     * Decode base64 string to UTF-8 string.
     */
    private _decodeBase64ToStr(base64Str: string): string {
        // Browser environment
        if (typeof atob !== 'undefined' && typeof TextDecoder !== 'undefined') {
            const binary = atob(base64Str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        }

        // Node.js environment
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(base64Str, 'base64').toString('utf-8');
        }

        // WeChat Mini Program environment
        if (typeof wx !== 'undefined' && wx?.base64ToArrayBuffer) {
            const buf = wx.base64ToArrayBuffer(base64Str);
            return new TextDecoder().decode(new Uint8Array(buf));
        }

        throw new Error('No base64 decoding method available');
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
                this.logger.error('Invalid event notification: missing required fields');
                this.emit(Event.Error, new Error('Invalid event notification: missing required fields'));
                return;
            }

            // Try to parse data if it's a JSON string
            if (typeof eventData.data === 'string') {
                try {
                    eventData.data = JSON.parse(eventData.data);
                } catch (e) {
                    // Keep as string if not valid JSON
                    this.logger.debug('Event data is not JSON; keeping it as a string');
                }
            }

            this.logger.debug('Event notification received');

            // Emit the custom event to registered listeners
            this.emit(Event.CustomEvent, eventData);
        } catch (error) {
            this.logger.error('Failed to handle event notification');
            this.emit(Event.Error, new Error(`Failed to handle event notification: ${error}`));
        }
    }

     private startPing(): void {
        this.stopPing(); // Clear existing timers
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WS_OPEN) {
                this.sendRequest('ping', {}, this.PONG_TIMEOUT_MS)
                    .then(this.handlePong.bind(this)) // Technically pong is a notification, but use req/res for timeout
                    .catch(err => {
                        this.logger.error("Ping failed or timed out");
                        this.emit(Event.Error, new Error(`Ping timeout: ${err?.message || err}`));
                        // Treat ping timeout as an unhealthy connection: close and reconnect
                        if (!this.manualDisconnect) {
                            this.handleDisconnect(false, "Ping timeout");
                            this.tryReconnect();
                        }
                    });
            } else {
                 this.stopPing(); // Stop if WS is not open
            }
        }, this.PING_INTERVAL_MS);
         this.logger.debug(`Ping interval started (${this.PING_INTERVAL_MS}ms)`);
    }

     private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
             this.logger.debug("Ping interval stopped");
        }
         if (this.pingTimeout) {
             clearTimeout(this.pingTimeout);
             this.pingTimeout = null;
         }
    }

     private handlePong(): void {
         // Reset pong timeout if using one (mainly handled by sendRequest timeout now)
     }

     private handleDisconnect(graceful: boolean, reason: string): void {
         this.logger.debug(`Handling disconnect (graceful: ${graceful})`);
        if (this.ws) {
            this.stopPing();
            if (graceful && this.ws.readyState === WS_OPEN) {
                // Use standard close codes: 1000 (normal), 3000-4999 (custom)
                this.ws.close(1000, "Client disconnected"); // Normal closure
            } else if (this.ws.readyState === WS_CONNECTING || this.ws.readyState === WS_OPEN) {
                 // Force close with custom code for abnormal situations
                this.ws.close(3001, reason.substring(0, 123)); // Custom code, limit reason length
            }
        }
        this.cleanupConnection(); // Clean up state regardless of how close happened
    }

    private cleanupConnection(): void {
        this.logger.debug("Cleaning up connection resources");
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

        // Detach the transport so reconnects cannot be affected by a stale socket.
        if (this.ws) {
            // Remove listeners to prevent potential memory leaks and duplicate handling.
             this.ws.onopen = null;
             this.ws.onmessage = null;
             this.ws.onerror = null;
             this.ws.onclose = null;
             this.ws = null;
        }
        // Do NOT clear eventListeners here, user might want to reconnect.
    }

    // --- Reconnection Methods ---

    private setupBeforeUnloadHandler(): void {
        // Only setup in browser environment
        if (typeof window !== 'undefined') {
            this.beforeUnloadHandler = () => {
                this.logger.debug('Page unloading; closing WebSocket connection');
                this.manualDisconnect = true;
                this.isReconnecting = false;
                if (this.ws && this.ws.readyState === WS_OPEN) {
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
            this.logger.error("Max reconnect attempts reached");
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.emit(Event.Error, new Error("Reconnection failed."));
            return;
        }

        const delay = this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        this.logger.debug(`Will reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
        this.emit(Event.Reconnecting, { attempt: this.reconnectAttempts, delay });

        setTimeout(() => {
            // Check if a manual disconnect happened while waiting
            if (!this.isReconnecting) {
                this.logger.debug("Reconnection aborted");
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
export { ChannelType as WKIMChannelType, Event as WKIMEvent, DeviceFlag as WKIMDeviceFlag };
