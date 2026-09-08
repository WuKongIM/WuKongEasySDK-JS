// Real Node WebSocket regression: one failed upgrade must not strand reconnect.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const { WebSocketServer } = require('ws');
const transport = process.env.INTEROP_TRANSPORT || 'native';
assert.ok(['native', 'ws'].includes(transport));
if (transport === 'ws') globalThis.WebSocket = require('ws');
const { WKIM, WKIMEvent } = require('../dist/cjs/index.js');

test(`${transport} WebSocket reconnects after the first retry loses its HTTP handshake`, { timeout: 10000 }, async () => {
  assert.equal(typeof globalThis.WebSocket, 'function');
  const sockets = new Set();
  const httpServer = http.createServer();
  const websocketServer = new WebSocketServer({ noServer: true });
  let attempts = 0, connections = 0, errors = 0;
  httpServer.on('upgrade', (request, socket, head) => {
    websocketServer.handleUpgrade(request, socket, head, peer => {
      peer.on('message', bytes => {
        const request = JSON.parse(bytes.toString());
        peer.send(JSON.stringify({ id: request.id, result: { reasonCode: 1 } }));
      });
    });
  });
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    if (++attempts === 2) socket.end();
    else httpServer.emit('connection', socket);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const im = WKIM.init(`ws://127.0.0.1:${server.address().port}`, {
    uid: 'fixture', token: 'fixture-token', deviceFlag: 2,
  }, { singleton: false });
  im.on(WKIMEvent.Connect, () => connections++);
  im.on(WKIMEvent.Error, () => errors++);
  try {
    await im.connect();
    for (const peer of websocketServer.clients) peer.terminate();
    const deadline = Date.now() + 6500;
    while (connections < 2 && Date.now() < deadline) await delay(25);
    assert.equal(connections, 2, `stalled: attempts=${attempts}, errors=${errors}`);
    assert.equal(attempts, 3);
  } finally {
    im.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    websocketServer.close();
    httpServer.close();
  }
});
