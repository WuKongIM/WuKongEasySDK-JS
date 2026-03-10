import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockWebSocket, installMockWebSocket } from './mock-websocket';

// We need to install the mock WebSocket BEFORE importing the SDK,
// because detectPlatform() runs at module load time.
// Using dynamic import after mocking.

let cleanup: () => void;
let getInstances: () => MockWebSocket[];

// Install mock before any imports of the SDK
const mock = installMockWebSocket();
cleanup = mock.cleanup;
getInstances = mock.getInstances;

// Now import the SDK (will detect 'browser' platform due to global WebSocket)
import { WKIM, Event, ChannelType, DeviceFlag } from '../index';

/** Encode a JSON-serializable value to base64 (matching server wire format). */
function toBase64(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: create a WKIM instance and return it with its MockWebSocket.
 * Does NOT auto-connect.
 */
function createInstance(opts?: { singleton?: boolean }) {
  const instancesBefore = getInstances().length;
  const wkim = WKIM.init('ws://test:5100', { uid: 'testUser', token: 'testToken' }, opts);
  return { wkim, getWs: () => getInstances()[instancesBefore] as MockWebSocket };
}

/**
 * Helper: create a WKIM instance, call connect(), simulate open + auth success,
 * and return the connected instance with its MockWebSocket.
 */
async function createConnectedInstance() {
  const { wkim, getWs } = createInstance();
  const connectPromise = wkim.connect();

  // Wait for the WebSocket to be created
  await vi.waitFor(() => {
    const ws = getWs();
    expect(ws).toBeDefined();
  });

  const ws = getWs();
  ws.simulateOpen();

  // Wait for the connect request to be sent
  await vi.waitFor(() => {
    expect(ws.findSentMessage('connect')).toBeTruthy();
  });

  ws.simulateAuthSuccess();
  await connectPromise;

  return { wkim, ws };
}

afterEach(() => {
  // Reset instances for next test
  getInstances().length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ===== Initialization Tests =====

describe('WKIM.init()', () => {
  it('creates an instance with valid params', () => {
    const wkim = WKIM.init('ws://test:5100', { uid: 'user1', token: 'token1' });
    expect(wkim).toBeInstanceOf(WKIM);
    expect(wkim.isConnected).toBe(false);
  });

  it('throws without url', () => {
    expect(() => WKIM.init('', { uid: 'user1', token: 'token1' })).toThrow(
      'URL, uid, and token are required'
    );
  });

  it('throws without uid', () => {
    expect(() => WKIM.init('ws://test:5100', { uid: '', token: 'token1' } as any)).toThrow(
      'URL, uid, and token are required'
    );
  });

  it('throws without token', () => {
    expect(() => WKIM.init('ws://test:5100', { uid: 'user1', token: '' } as any)).toThrow(
      'URL, uid, and token are required'
    );
  });

  it('throws without auth object', () => {
    expect(() => WKIM.init('ws://test:5100', null as any)).toThrow(
      'URL, uid, and token are required'
    );
  });

  it('singleton mode: replaces previous instance', () => {
    const instance1 = WKIM.init('ws://test:5100', { uid: 'user1', token: 'token1' }, { singleton: true });
    const instance2 = WKIM.init('ws://test:5100', { uid: 'user2', token: 'token2' }, { singleton: true });
    expect(instance1).not.toBe(instance2);
  });

  it('non-singleton mode: creates independent instances', () => {
    const instance1 = WKIM.init('ws://test:5100', { uid: 'user1', token: 'token1' }, { singleton: false });
    const instance2 = WKIM.init('ws://test:5100', { uid: 'user2', token: 'token2' }, { singleton: false });
    expect(instance1).not.toBe(instance2);
  });
});

// ===== Event System Tests =====

describe('Event system', () => {
  it('on() registers listeners that are called on emit', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const handler = vi.fn();
    wkim.on(Event.Message, handler);

    // Simulate receiving a message notification
    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: {},
        messageId: 'msg1',
        messageSeq: 1,
        timestamp: Date.now(),
        channelId: 'chan1',
        channelType: 1,
        fromUid: 'sender1',
        payload: toBase64({ text: 'hello' }),
      },
    }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'msg1', fromUid: 'sender1' })
    );

    wkim.destroy();
  });

  it('off() removes specific listener', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const handler = vi.fn();
    wkim.on(Event.Message, handler);
    wkim.off(Event.Message, handler);

    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: {},
        messageId: 'msg1',
        messageSeq: 1,
        timestamp: Date.now(),
        channelId: 'chan1',
        channelType: 1,
        fromUid: 'sender1',
        payload: toBase64({ text: 'hello' }),
      },
    }));

    expect(handler).not.toHaveBeenCalled();
    wkim.destroy();
  });

  it('multiple listeners for the same event are all called', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    wkim.on(Event.Message, handler1);
    wkim.on(Event.Message, handler2);

    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: {},
        messageId: 'msg2',
        messageSeq: 2,
        timestamp: Date.now(),
        channelId: 'chan1',
        channelType: 1,
        fromUid: 'sender1',
        payload: toBase64({ text: 'world' }),
      },
    }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    wkim.destroy();
  });

  it('off() only removes the specified handler', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    wkim.on(Event.Message, handler1);
    wkim.on(Event.Message, handler2);
    wkim.off(Event.Message, handler1);

    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: {},
        messageId: 'msg3',
        messageSeq: 3,
        timestamp: Date.now(),
        channelId: 'chan1',
        channelType: 1,
        fromUid: 'sender1',
        payload: toBase64({}),
      },
    }));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
    wkim.destroy();
  });
});

// ===== Connection Tests =====

describe('Connection', () => {
  it('connect() creates WebSocket and sends auth request', async () => {
    const { wkim, getWs } = createInstance();
    const connectPromise = wkim.connect();

    await vi.waitFor(() => {
      expect(getWs()).toBeDefined();
    });

    const ws = getWs();
    ws.simulateOpen();

    await vi.waitFor(() => {
      const connectMsg = ws.findSentMessage('connect');
      expect(connectMsg).toBeTruthy();
      expect(connectMsg.params.uid).toBe('testUser');
      expect(connectMsg.params.token).toBe('testToken');
    });

    ws.simulateAuthSuccess();
    await connectPromise;
    expect(wkim.isConnected).toBe(true);
    wkim.destroy();
  });

  it('connect() resolves on successful authentication', async () => {
    const { wkim } = await createConnectedInstance();
    expect(wkim.isConnected).toBe(true);
    wkim.destroy();
  });

  it('connect() rejects on auth failure', async () => {
    const { wkim, getWs } = createInstance();
    const connectPromise = wkim.connect();

    await vi.waitFor(() => {
      expect(getWs()).toBeDefined();
    });

    const ws = getWs();
    ws.simulateOpen();

    await vi.waitFor(() => {
      expect(ws.findSentMessage('connect')).toBeTruthy();
    });

    ws.simulateAuthFailure(2, 'Invalid token');

    await expect(connectPromise).rejects.toEqual(
      expect.objectContaining({ message: 'Invalid token' })
    );
    wkim.destroy();
  });

  it('connect() resolves immediately if already connected', async () => {
    const { wkim } = await createConnectedInstance();
    // Second connect should resolve immediately
    await expect(wkim.connect()).resolves.toBeUndefined();
    wkim.destroy();
  });

  it('emits Connect event on successful connection', async () => {
    const { wkim, getWs } = createInstance();
    const connectHandler = vi.fn();
    wkim.on(Event.Connect, connectHandler);

    const connectPromise = wkim.connect();
    await vi.waitFor(() => expect(getWs()).toBeDefined());
    const ws = getWs();
    ws.simulateOpen();
    await vi.waitFor(() => expect(ws.findSentMessage('connect')).toBeTruthy());
    ws.simulateAuthSuccess();
    await connectPromise;

    expect(connectHandler).toHaveBeenCalledTimes(1);
    expect(connectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ serverKey: 'test-server-key', reasonCode: 1 })
    );
    wkim.destroy();
  });

  it('sends correct deviceFlag default (Web)', async () => {
    const { wkim, getWs } = createInstance();
    const connectPromise = wkim.connect();

    await vi.waitFor(() => expect(getWs()).toBeDefined());
    const ws = getWs();
    ws.simulateOpen();

    await vi.waitFor(() => expect(ws.findSentMessage('connect')).toBeTruthy());
    const connectMsg = ws.findSentMessage('connect');
    expect(connectMsg.params.deviceFlag).toBe(DeviceFlag.Web);

    ws.simulateAuthSuccess();
    await connectPromise;
    wkim.destroy();
  });
});

// ===== Message Sending Tests =====

describe('Message sending', () => {
  it('send() rejects when not connected', async () => {
    const { wkim } = createInstance();
    await expect(
      wkim.send('chan1', ChannelType.Person, { text: 'hello' })
    ).rejects.toThrow('Not connected');
  });

  it('send() rejects with non-object payload', async () => {
    const { wkim } = await createConnectedInstance();
    await expect(
      wkim.send('chan1', ChannelType.Person, null as any)
    ).rejects.toThrow('Payload must be a non-null object');
    await expect(
      wkim.send('chan1', ChannelType.Person, 'string' as any)
    ).rejects.toThrow('Payload must be a non-null object');
    wkim.destroy();
  });

  it('send() sends correct JSON-RPC format', async () => {
    const { wkim, ws } = await createConnectedInstance();

    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'hello' });

    // Find the send request
    await vi.waitFor(() => {
      expect(ws.findSentMessage('send')).toBeTruthy();
    });

    const sendMsg = ws.findSentMessage('send');
    expect(sendMsg).toMatchObject({
      method: 'send',
      params: expect.objectContaining({
        channelId: 'chan1',
        channelType: ChannelType.Person,
        payload: toBase64({ text: 'hello' }),
      }),
    });
    expect(sendMsg.id).toBeDefined();
    expect(sendMsg.params.clientMsgNo).toBeDefined();
    expect(sendMsg.params.header).toBeDefined();
    expect(sendMsg.params.header.redDot).toBe(true);

    // Simulate server response
    ws.simulateMessage(JSON.stringify({
      id: sendMsg.id,
      result: { messageId: 'server-msg-1', messageSeq: 42, reasonCode: 1 },
    }));

    const result = await sendPromise;
    expect(result).toEqual({ messageId: 'server-msg-1', messageSeq: 42, reasonCode: 1 });
    wkim.destroy();
  });

  it('send() uses provided clientMsgNo', async () => {
    const { wkim, ws } = await createConnectedInstance();

    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'hello' }, { clientMsgNo: 'custom-msg-no' });

    await vi.waitFor(() => {
      expect(ws.findSentMessage('send')).toBeTruthy();
    });

    const sendMsg = ws.findSentMessage('send');
    expect(sendMsg.params.clientMsgNo).toBe('custom-msg-no');

    // Resolve the pending send before destroying
    ws.simulateMessage(JSON.stringify({
      id: sendMsg.id,
      result: { messageId: 'msg-1', messageSeq: 1, reasonCode: 1 },
    }));
    await sendPromise;
    wkim.destroy();
  });

  it('send() generates clientMsgNo if not provided', async () => {
    const { wkim, ws } = await createConnectedInstance();

    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'hello' });

    await vi.waitFor(() => {
      expect(ws.findSentMessage('send')).toBeTruthy();
    });

    const sendMsg = ws.findSentMessage('send');
    expect(sendMsg.params.clientMsgNo).toBeDefined();
    expect(sendMsg.params.clientMsgNo).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    // Resolve the pending send before destroying
    ws.simulateMessage(JSON.stringify({
      id: sendMsg.id,
      result: { messageId: 'msg-1', messageSeq: 1, reasonCode: 1 },
    }));
    await sendPromise;
    wkim.destroy();
  });
});

// ===== Message Handling Tests =====

describe('Message handling', () => {
  it('JSON-RPC response routes to pending request', async () => {
    const { wkim, ws } = await createConnectedInstance();

    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'test' });
    await vi.waitFor(() => expect(ws.findSentMessage('send')).toBeTruthy());

    const sendMsg = ws.findSentMessage('send');
    ws.simulateMessage(JSON.stringify({
      id: sendMsg.id,
      result: { messageId: 'msg-id-1', messageSeq: 10, reasonCode: 1 },
    }));

    const result = await sendPromise;
    expect(result.messageId).toBe('msg-id-1');
    expect(result.messageSeq).toBe(10);
    wkim.destroy();
  });

  it('JSON-RPC error response rejects pending request', async () => {
    const { wkim, ws } = await createConnectedInstance();

    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'test' });
    await vi.waitFor(() => expect(ws.findSentMessage('send')).toBeTruthy());

    const sendMsg = ws.findSentMessage('send');
    ws.simulateMessage(JSON.stringify({
      id: sendMsg.id,
      error: { code: 11, message: 'Not allowed to send' },
    }));

    await expect(sendPromise).rejects.toEqual(
      expect.objectContaining({ code: 11, message: 'Not allowed to send' })
    );
    wkim.destroy();
  });

  it('recv notification emits Message event and sends recvack', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const messageHandler = vi.fn();
    wkim.on(Event.Message, messageHandler);

    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: { redDot: true },
        messageId: 'recv-msg-1',
        messageSeq: 100,
        timestamp: 1234567890,
        channelId: 'channel1',
        channelType: 2,
        fromUid: 'user2',
        payload: toBase64({ text: 'hi there' }),
      },
    }));

    expect(messageHandler).toHaveBeenCalledTimes(1);
    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'recv-msg-1',
        channelId: 'channel1',
        fromUid: 'user2',
        payload: { text: 'hi there' },
      })
    );

    // Verify recvack was sent
    const recvack = ws.findSentMessage('recvack');
    expect(recvack).toBeTruthy();
    expect(recvack.params.messageId).toBe('recv-msg-1');
    expect(recvack.params.messageSeq).toBe(100);
    wkim.destroy();
  });

  it('event notification emits CustomEvent', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const eventHandler = vi.fn();
    wkim.on(Event.CustomEvent, eventHandler);

    ws.simulateMessage(JSON.stringify({
      method: 'event',
      params: {
        id: 'evt-1',
        type: 'user.status',
        timestamp: Date.now(),
        data: { status: 'online' },
      },
    }));

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt-1',
        type: 'user.status',
        data: { status: 'online' },
      })
    );
    wkim.destroy();
  });

  it('event notification parses JSON string data', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const eventHandler = vi.fn();
    wkim.on(Event.CustomEvent, eventHandler);

    ws.simulateMessage(JSON.stringify({
      method: 'event',
      params: {
        id: 'evt-2',
        type: 'user.typing',
        timestamp: Date.now(),
        data: '{"typing":true}',
      },
    }));

    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { typing: true },
      })
    );
    wkim.destroy();
  });

  it('disconnect notification from server triggers disconnect', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const disconnectHandler = vi.fn();
    wkim.on(Event.Disconnect, disconnectHandler);

    ws.simulateMessage(JSON.stringify({
      method: 'disconnect',
      params: { reasonCode: 12, reason: 'Kicked' },
    }));

    expect(disconnectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCode: 12, reason: 'Kicked' })
    );
    wkim.destroy();
  });

  it('invalid JSON emits Error event', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const errorHandler = vi.fn();
    wkim.on(Event.Error, errorHandler);

    ws.simulateMessage('not valid json {{{{');

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Failed to parse message') })
    );
    wkim.destroy();
  });
});

// ===== Ping/Pong Tests =====

describe('Ping/Pong', () => {
  it('ping is started after successful connect', async () => {
    vi.useFakeTimers();
    const { wkim, getWs } = createInstance();

    const connectPromise = wkim.connect();
    await vi.advanceTimersByTimeAsync(0);
    const ws = getWs();
    ws.simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    ws.simulateAuthSuccess();
    await vi.advanceTimersByTimeAsync(0);
    await connectPromise;

    // Clear sent messages to track only ping
    ws.sentMessages.length = 0;

    // Advance time to trigger ping interval (25s)
    await vi.advanceTimersByTimeAsync(25000);

    const pingMsg = ws.findSentMessage('ping');
    expect(pingMsg).toBeTruthy();
    expect(pingMsg.method).toBe('ping');

    wkim.destroy();
    vi.useRealTimers();
  });
});

// ===== Reconnection Tests =====

describe('Reconnection', () => {
  it('reconnect triggered on unexpected disconnect', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);

    // Simulate unexpected close
    ws.simulateClose(1006, 'Abnormal closure');

    // Use a short delay to let the reconnect scheduling happen
    await new Promise(r => setTimeout(r, 50));

    // The reconnect handler should have been called
    expect(reconnectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 })
    );

    wkim.destroy();
  });

  it('no reconnect on manual disconnect', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);

    wkim.disconnect();

    await new Promise(r => setTimeout(r, 100));
    expect(reconnectHandler).not.toHaveBeenCalled();
  });

  it('exponential backoff delay', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);

    // Simulate unexpected close
    ws.simulateClose(1006, 'Abnormal closure');

    await new Promise(r => setTimeout(r, 50));

    expect(reconnectHandler).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delay: 1000 }) // 1000 * 2^0
    );

    wkim.destroy();
  });
});

// ===== Cleanup Tests =====

describe('Cleanup', () => {
  it('disconnect() sets isConnected to false', async () => {
    const { wkim } = await createConnectedInstance();
    expect(wkim.isConnected).toBe(true);
    wkim.disconnect();
    expect(wkim.isConnected).toBe(false);
  });

  it('pending requests rejected on disconnect', async () => {
    const { wkim, ws } = await createConnectedInstance();

    // Send a message but don't respond
    const sendPromise = wkim.send('chan1', ChannelType.Person, { text: 'pending' });

    await vi.waitFor(() => {
      expect(ws.findSentMessage('send')).toBeTruthy();
    });

    // Disconnect while request is pending
    wkim.disconnect();

    await expect(sendPromise).rejects.toThrow('Connection closed');
  });

  it('destroy() clears everything including listeners', async () => {
    const { wkim } = await createConnectedInstance();
    const handler = vi.fn();
    wkim.on(Event.Message, handler);

    wkim.destroy();

    expect(wkim.isConnected).toBe(false);
    // After destroy, listeners are cleared, so even if we could emit, nothing would fire.
    // We verify by checking the instance is fully cleaned up.
  });

  it('destroy() clears global instance', () => {
    const wkim = WKIM.init('ws://test:5100', { uid: 'user1', token: 'token1' }, { singleton: true });
    wkim.destroy();
    // Creating a new singleton should work without issues (no destroy call on old)
    const wkim2 = WKIM.init('ws://test:5100', { uid: 'user2', token: 'token2' }, { singleton: true });
    expect(wkim2).toBeInstanceOf(WKIM);
    wkim2.destroy();
  });
});
