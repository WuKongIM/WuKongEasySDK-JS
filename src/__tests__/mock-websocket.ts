import { vi } from 'vitest';

/**
 * Mock WebSocket that implements the IWebSocketAdapter interface.
 * Simulates WebSocket behavior for testing without a real server.
 */
export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;

  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  // Track sent messages for assertions
  sentMessages: string[] = [];

  // Auto-open behavior
  private autoOpen: boolean;

  constructor(url: string, autoOpen = true) {
    this.url = url;
    this.autoOpen = autoOpen;

    if (this.autoOpen) {
      // Simulate async open
      setTimeout(() => this.simulateOpen(), 0);
    }
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED || this.readyState === MockWebSocket.CLOSING) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    // Simulate async close
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ code: code || 1000, reason: reason || '' });
      }
    }, 0);
  }

  // --- Simulation helpers for tests ---

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen({});
    }
  }

  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  simulateError(message = 'WebSocket error'): void {
    if (this.onerror) {
      this.onerror({ message, error: new Error(message) });
    }
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  /**
   * Get the last sent message as parsed JSON
   */
  getLastSentMessage(): any {
    if (this.sentMessages.length === 0) return null;
    return JSON.parse(this.sentMessages[this.sentMessages.length - 1]);
  }

  /**
   * Find a sent message by method name
   */
  findSentMessage(method: string): any | null {
    for (const msg of this.sentMessages) {
      const parsed = JSON.parse(msg);
      if (parsed.method === method) return parsed;
    }
    return null;
  }

  /**
   * Simulate a successful connect auth response.
   * Looks at sent messages for a connect request and responds with success.
   */
  simulateAuthSuccess(): void {
    const connectMsg = this.findSentMessage('connect');
    if (connectMsg) {
      this.simulateMessage(JSON.stringify({
        id: connectMsg.id,
        result: {
          serverKey: 'test-server-key',
          salt: 'test-salt',
          timeDiff: 0,
          reasonCode: 1, // ReasonCode.Success
        },
      }));
    }
  }

  /**
   * Simulate a failed connect auth response.
   */
  simulateAuthFailure(code = 2, message = 'Auth failed'): void {
    const connectMsg = this.findSentMessage('connect');
    if (connectMsg) {
      this.simulateMessage(JSON.stringify({
        id: connectMsg.id,
        error: { code, message },
      }));
    }
  }
}

/**
 * Install MockWebSocket as global WebSocket so that the SDK's
 * detectPlatform() returns 'browser' and createWebSocket() uses it.
 *
 * Returns a cleanup function.
 */
export function installMockWebSocket(): { cleanup: () => void; getInstances: () => MockWebSocket[] } {
  const instances: MockWebSocket[] = [];
  const originalWebSocket = (globalThis as any).WebSocket;

  (globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url, false); // Don't auto-open; tests control timing
      instances.push(this);
    }
  };

  return {
    cleanup: () => {
      (globalThis as any).WebSocket = originalWebSocket;
    },
    getInstances: () => instances,
  };
}
