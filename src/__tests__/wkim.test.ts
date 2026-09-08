import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
  it('exposes enums through the documented WKIM namespace', () => {
    expect(WKIM.Event).toBe(Event);
    expect(WKIM.ChannelType).toBe(ChannelType);
    expect(WKIM.DeviceFlag).toBe(DeviceFlag);
  });

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

// ===== Logging Security Tests =====

describe('Logging security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps CONNECT tokens and SEND/RECV payloads out of console output when debug logging is disabled', async () => {
    const tokenCanary = 'TOKEN_CANARY_7f8262b4';
    const outboundCanary = 'OUTBOUND_PAYLOAD_CANARY_90c10dd3';
    const inboundCanary = 'INBOUND_PAYLOAD_CANARY_42e02c79';
    const outboundWirePayload = toBase64({ content: outboundCanary });
    const inboundWirePayload = toBase64({ content: inboundCanary });
    const captured: string[] = [];

    for (const method of ['debug', 'log', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        captured.push(args.map((arg) => {
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }).join(' '));
      });
    }

    const instancesBefore = getInstances().length;
    const wkim = WKIM.init(
      'ws://test:5100',
      { uid: 'security-user', token: tokenCanary },
      { singleton: false, debugLogging: false },
    );
    const connectPromise = wkim.connect();

    await vi.waitFor(() => expect(getInstances()[instancesBefore]).toBeDefined());
    const ws = getInstances()[instancesBefore];
    ws.simulateOpen();
    await vi.waitFor(() => expect(ws.findSentMessage('connect')).toBeTruthy());

    const connectRequest = ws.findSentMessage('connect');
    expect(JSON.stringify(connectRequest)).toContain(tokenCanary);
    ws.simulateAuthSuccess();
    await connectPromise;

    const sendPromise = wkim.send('recipient', ChannelType.Person, { content: outboundCanary });
    await vi.waitFor(() => expect(ws.findSentMessage('send')).toBeTruthy());
    const sendRequest = ws.findSentMessage('send');
    expect(sendRequest.params.payload).toBe(outboundWirePayload);
    ws.simulateMessage(JSON.stringify({
      id: sendRequest.id,
      result: { messageId: 'sent-1', messageSeq: 1, reasonCode: 1 },
    }));
    await sendPromise;

    ws.simulateMessage(JSON.stringify({
      method: 'recv',
      params: {
        header: {},
        messageId: 'recv-1',
        messageSeq: 2,
        timestamp: Date.now(),
        channelId: 'security-user',
        channelType: ChannelType.Person,
        fromUid: 'recipient',
        payload: inboundWirePayload,
      },
    }));
    ws.simulateMessage(JSON.stringify({ unexpected: inboundCanary }));
    ws.simulateMessage(`malformed-${outboundCanary}`);
    ws.simulateError(`transport-${tokenCanary}`);
    wkim.destroy();

    const transcript = captured.join('\n');
    expect(transcript).not.toContain(tokenCanary);
    expect(transcript).not.toContain(outboundCanary);
    expect(transcript).not.toContain(outboundWirePayload);
    expect(transcript).not.toContain(inboundCanary);
    expect(transcript).not.toContain(inboundWirePayload);
    expect(captured).toEqual([]);
  });

  it('emits only sanitized operational metadata when debug logging is enabled', async () => {
    const tokenCanary = 'TOKEN_CANARY_DEBUG_2add165d';
    const payloadCanary = 'PAYLOAD_CANARY_DEBUG_07928f3f';
    const wirePayload = toBase64({ content: payloadCanary });
    const captured: string[] = [];

    for (const method of ['debug', 'log', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        captured.push(args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '));
      });
    }

    const instancesBefore = getInstances().length;
    const wkim = WKIM.init(
      'ws://test:5100',
      { uid: 'debug-user', token: tokenCanary },
      { singleton: false, debugLogging: true },
    );
    const connectPromise = wkim.connect();

    await vi.waitFor(() => expect(getInstances()[instancesBefore]).toBeDefined());
    const ws = getInstances()[instancesBefore];
    ws.simulateOpen();
    await vi.waitFor(() => expect(ws.findSentMessage('connect')).toBeTruthy());
    const connectRequest = ws.findSentMessage('connect');
    ws.simulateAuthSuccess();
    await connectPromise;

    const sendPromise = wkim.send('recipient', ChannelType.Person, { content: payloadCanary });
    await vi.waitFor(() => expect(ws.findSentMessage('send')).toBeTruthy());
    const sendRequest = ws.findSentMessage('send');
    ws.simulateMessage(JSON.stringify({
      id: sendRequest.id,
      result: { messageId: 'sent-2', messageSeq: 3, reasonCode: 1 },
    }));
    await sendPromise;

    ws.simulateMessage(JSON.stringify({ unexpected: payloadCanary }));
    ws.simulateMessage(JSON.stringify({ id: payloadCanary, result: {} }));
    ws.simulateMessage(`malformed-${payloadCanary}`);
    ws.simulateError(`transport-${tokenCanary}`);

    let failedRequestId = '';
    vi.spyOn(ws, 'send').mockImplementation((data: string) => {
      const request = JSON.parse(data);
      failedRequestId = request.id;
      throw new Error('forced transport send failure');
    });
    await expect(
      wkim.send('recipient', ChannelType.Person, { content: payloadCanary }),
    ).rejects.toThrow('forced transport send failure');

    wkim.destroy();

    const transcript = captured.join('\n');
    expect(transcript).toContain('[WKIM]');
    expect(transcript).not.toContain(tokenCanary);
    expect(transcript).not.toContain(payloadCanary);
    expect(transcript).not.toContain(wirePayload);
    expect(transcript).not.toContain(connectRequest.id);
    expect(transcript).not.toContain(sendRequest.id);
    expect(failedRequestId).not.toBe('');
    expect(transcript).not.toContain(failedRequestId);
    expect(transcript).toContain('Sending connect request (id=present)');
    expect(transcript).toContain('Sending send request (id=present)');
    expect(transcript).toContain('Failed to send send request (id=present)');
  });

  it('shipped examples and documentation do not log raw event or error values', () => {
    const collectFiles = (path: string): string[] => {
      if (!statSync(path).isDirectory()) return [path];
      return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
    };
    const files = [
      ...collectFiles('example'),
      ...collectFiles('docs'),
      'IMPLEMENTATION_SUMMARY.md',
    ].filter((path) => /\.(?:js|html|md)$/.test(path));
    const unsafeLogArguments = [
      /(?:console\.(?:log|debug|warn|error)|addLog)\s*\(\s*(?:error|event|eventNotification|params|data|mockEvent)\b/,
      /(?:console\.(?:log|debug|warn|error)|addLog)\s*\([^\n]*,\s*(?:error|event|eventNotification|params|data|userId|channelId|messageId)\b/,
      /(?:console\.(?:log|debug|warn|error)|addLog)\s*\([^\n]*\$\{\s*(?:error|event|eventNotification|params|data|userId|channelId|messageId)\b/,
      /(?:console\.(?:log|debug|warn|error)|addLog)\s*\([^\n]*(?:error\.message|event\.data|event\.id|eventNotification\.data|eventNotification\.id)/,
    ];

    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of unsafeLogArguments) {
        expect(source, `${path} contains unsafe diagnostic ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('shipped examples reference SDK entrypoints produced by the build', () => {
    const appSource = readFileSync('example/app.js', 'utf8');
    const eventExampleSource = readFileSync('example/event-example.js', 'utf8');
    const eventTestSource = readFileSync('example/event-test.html', 'utf8');
    const documentationSources = [
      readFileSync('IMPLEMENTATION_SUMMARY.md', 'utf8'),
      readFileSync('docs/EVENT_PROTOCOL_FLOW.md', 'utf8'),
      readFileSync('docs/EVENT_PROTOCOL_IMPLEMENTATION.md', 'utf8'),
      readFileSync('docs/EVENT_PROTOCOL_QUICKSTART.md', 'utf8'),
    ];

    expect(appSource).toContain("from '../dist/esm/index.js'");
    expect(eventExampleSource).toMatch(
      /^import \{ WKIM, Event \} from '\.\.\/dist\/esm\/index\.js';$/m,
    );
    expect(eventExampleSource).toContain("require('../dist/cjs/index.js')");
    expect(eventTestSource).toContain('<script type="module">');
    expect(eventTestSource).toContain("from '../dist/esm/index.js'");

    for (const source of [eventExampleSource, eventTestSource, ...documentationSources]) {
      expect(source).not.toContain('ws://localhost:5100');
    }

    for (const source of [appSource, eventExampleSource, eventTestSource, ...documentationSources]) {
      expect(source).not.toMatch(/dist\/index\.(?:js|js\.map|d\.ts)/);
    }
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

  it('disconnect during authentication cannot close a replacement connection', async () => {
    const instancesBefore = getInstances().length;
    const wkim = WKIM.init(
      'ws://test:5200',
      { uid: 'testUser', token: 'testToken' },
      { singleton: false },
    );

    const firstConnect = wkim.connect();
    const firstOutcome = firstConnect.catch((error) => error);
    const firstSocket = getInstances()[instancesBefore];
    firstSocket.simulateOpen();
    await vi.waitFor(() => expect(firstSocket.findSentMessage('connect')).toBeTruthy());

    wkim.disconnect();

    const secondConnect = wkim.connect();
    const secondOutcome = secondConnect.then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error }),
    );
    const secondSocket = getInstances()[instancesBefore + 1];
    secondSocket.simulateOpen();
    await vi.waitFor(() => expect(secondSocket.findSentMessage('connect')).toBeTruthy());

    await firstOutcome;
    await Promise.resolve();
    await Promise.resolve();

    expect(secondSocket.readyState).toBe(MockWebSocket.OPEN);
    secondSocket.simulateAuthSuccess();
    expect(await secondOutcome).toEqual({ ok: true });
    expect(wkim.isConnected).toBe(true);
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

  it('rejects event notifications missing timestamp or data', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const eventHandler = vi.fn();
    const errorHandler = vi.fn();
    wkim.on(Event.CustomEvent, eventHandler);
    wkim.on(Event.Error, errorHandler);

    ws.simulateMessage(JSON.stringify({
      method: 'event',
      params: { id: 'evt-missing-time', type: 'user.status', data: 'online' },
    }));
    ws.simulateMessage(JSON.stringify({
      method: 'event',
      params: { id: 'evt-missing-data', type: 'user.status', timestamp: Date.now() },
    }));

    expect(eventHandler).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledTimes(2);
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('missing required fields') })
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

  it('continues reconnecting when a retry closes before authentication', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);
    vi.useFakeTimers();

    ws.simulateClose(1006, 'Initial connection lost');
    expect(reconnectHandler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ attempt: 1, delay: 1000 }),
    );

    await vi.advanceTimersByTimeAsync(1000);
    const retrySocket = getInstances()[getInstances().length - 1];
    expect(retrySocket).not.toBe(ws);

    retrySocket.simulateClose(1006, 'Retry failed before authentication');
    await vi.advanceTimersByTimeAsync(0);

    expect(reconnectHandler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attempt: 2, delay: 2000 }),
    );

    wkim.destroy();
  });

  it('continues reconnecting when a handshake emits error without close', async () => {
    const { wkim, ws } = await createConnectedInstance();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);
    vi.useFakeTimers();
    try {
      ws.simulateClose(1006, 'Initial connection lost');
      await vi.advanceTimersByTimeAsync(1000);
      const retry = getInstances().at(-1)!;
      const lateClose = retry.onclose;
      retry.simulateError('Handshake failed without a close event');
      lateClose?.({ code: 1006, reason: 'Delayed close from the failed transport' });
      await vi.advanceTimersByTimeAsync(0);
      expect(reconnectHandler).toHaveBeenCalledTimes(2);
      expect(reconnectHandler).toHaveBeenNthCalledWith(
        2, expect.objectContaining({ attempt: 2, delay: 2000 }),
      );
      await vi.advanceTimersByTimeAsync(2000);
      const replacement = getInstances().at(-1)!;
      expect(replacement).not.toBe(retry);
      replacement.simulateOpen();
      replacement.simulateAuthSuccess();
      await vi.advanceTimersByTimeAsync(0);
      expect(wkim.isConnected).toBe(true);
    } finally {
      wkim.destroy();
    }
  });

  it('rejects initial handshake error without retrying or waiting for close', async () => {
    const { wkim, getWs } = createInstance();
    vi.useFakeTimers();
    const reconnectHandler = vi.fn();
    wkim.on(Event.Reconnecting, reconnectHandler);
    const rejected = expect(wkim.connect()).rejects.toThrow('Connection closed before authentication');
    getWs().simulateError('Handshake failed');
    await vi.advanceTimersByTimeAsync(0);
    await rejected;
    expect(reconnectHandler).not.toHaveBeenCalled();
    expect(wkim.isConnected).toBe(false);
    wkim.destroy();
  });
});

// ===== Cleanup Tests =====

describe('Cleanup', () => {
  it('manual disconnect emits Disconnect exactly once', async () => {
    const { wkim } = await createConnectedInstance();
    const disconnectHandler = vi.fn();
    wkim.on(Event.Disconnect, disconnectHandler);

    wkim.disconnect();

    await vi.waitFor(() => expect(disconnectHandler).toHaveBeenCalledTimes(1));
    expect(disconnectHandler).toHaveBeenCalledWith({
      code: 1000,
      reason: 'Client disconnected',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(disconnectHandler).toHaveBeenCalledTimes(1);
  });

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
