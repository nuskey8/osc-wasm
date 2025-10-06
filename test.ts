import { osc } from "./src/main.ts";

// Simple end-to-end test:
// - start a local WebSocket server on 8081
// - server decodes incoming OSC (WASM) and replies with an encoded OSC message
// - client (osc.WebSocketPort) connects, sends an OSC message and awaits reply

const PORT = 8081;
const url = `ws://localhost:${PORT}`;

// Start HTTP server that upgrades to WebSocket and handles OSC binary frames
const ac = new AbortController();
function handler(req: Request) {
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const port = osc.WebSocketPort({ url, socket });

    port.on("message", (msg) => {
      try {
        if (msg.address != "/test") return;
        console.log("[server] received message:", msg);

        port.send({
          address: "/reply",
          args: [{ type: "s", value: "ok" }],
        });
        console.log("[server] sent reply");
      } catch (err) {
        console.error("[server] message handler error:", err);
      }
    });

    socket.onclose = () => console.log("[server] socket closed");
    socket.onerror = (ev) => console.error("[server] socket error", ev);

    return response;
  } catch (err) {
    console.error("[server] upgrade error:", err);
    return new Response("not a websocket", { status: 400 });
  }
}

// Start server in background
Deno.serve({ port: PORT, signal: ac.signal }, handler);
console.log(`[server] listening ${url}`);

// Create client
const oscPort = osc.WebSocketPort({
  url,
});

oscPort.open();

// Promise that resolves when we get a reply from server
const gotReply = new Promise<unknown>((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("timeout waiting for reply")),
    5000,
  );

  oscPort.on("message", (oscMsg) => {
    clearTimeout(timeout);
    console.log("[client] received message:", oscMsg);
    resolve(oscMsg);
  });

  oscPort.on("ready", () => {
    console.log("[client] ready, sending OSC message");
    oscPort.send({ address: "/test", args: [{ type: "f", value: 440 }] });
  });
});

try {
  await gotReply;
  console.log("Test succeeded: received reply from server");
  ac.abort();
  // small delay to let sockets close gracefully
  await new Promise((r) => setTimeout(r, 100));
  Deno.exit(0);
} catch (err) {
  console.error("Test failed:", err);
  ac.abort();
  Deno.exit(1);
}
