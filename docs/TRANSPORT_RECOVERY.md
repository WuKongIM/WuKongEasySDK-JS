# Transport recovery verification

## Handshake error without close

Current source fixes a stall observed with native Node WebSocket during C#/JS
interoperability testing. An established connection dropped; the first retry's
TCP peer then closed before completing the HTTP upgrade. Native WebSocket emitted
`error` while remaining `CONNECTING`, without a subsequent `close`. The SDK left
its connection promise pending, so the retry chain never scheduled its next attempt.

The minimal public-API regression is:

```bash
npm ci
npm run build
npm run test:integration
INTEROP_TRANSPORT=ws npm run test:integration
```

It authenticates against one owned loopback WebSocket peer, terminates that
connection, ends the next accepted TCP connection before its HTTP handshake,
and requires a third connection to authenticate successfully. It uses the normal
1-second then 2-second SDK retry delays and a 10-second test deadline. Before the
fix it failed after 6.5 seconds with two connection attempts and one error;
after the fix it reconnects after about three seconds. Node 22.12.0 and 24.3.0
exercise native transport in CI; the same real TCP test also covers `ws`.

Fast mock-transport tests separately require an initial handshake error to reject
without retry, a failed automatic retry to advance, and a delayed close callback
from the retired transport to have no additional effect. Existing authentication,
manual disconnect, generation fencing, messaging, and logging tests still apply.

## Transport selection and release scope

Mini-program adapters retain priority. In other environments a global
`WebSocket` constructor takes precedence over the optional Node `ws` fallback.
Node 22/24 therefore normally select their native implementation. The historical
`getPlatform()` enum calls this constructor path `browser`; it does not establish
that the process is a browser. Applications that provide a standard global
constructor must do so before the first SDK connection/platform detection.

Version **2.0.5** includes the handshake fix; `easyjssdk 2.0.4` does not.
The original repaired-source receipt uses commit
`5e5dfb727fb0ea08294939962ae799e998b7ca5c`; it must not be attributed to the older
package. Public-package interoperability receipts are recorded separately in
the [C# SDK suite](https://github.com/WuKongIM/WuKongEasySDK-CSharp/blob/main/docs/interoperability.md).
No TLS verification is disabled by this repair.
