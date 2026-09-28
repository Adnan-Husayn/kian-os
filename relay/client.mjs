// Kian OS relay client — runs on the VM, bridges the Cloudflare relay
// Worker to the local Next.js server.
//
//  Worker (wss)  <── VM socket ──>  this client  ── http ──>  localhost:3000
//
// Reads RELAY_SECRET from env or ops/relay-secret.txt. Reconnects with
// backoff. Run under the keepalive supervisor (ops/keepalive.sh).
import http from "node:http";
import { readFileSync } from "node:fs";

const RELAY_URL = process.env.RELAY_URL || "wss://kian-os.johaaanlibert.workers.dev/relay";
const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 3000;

function loadSecret() {
  if (process.env.RELAY_SECRET) return process.env.RELAY_SECRET.trim();
  return readFileSync("/home/hatch/workspace/kian-os/ops/relay-secret.txt", "utf8").trim();
}
const SECRET = loadSecret();
if (!SECRET) {
  console.error("relay: no secret configured");
  process.exit(1);
}

function upstreamRequest(msg) {
  return new Promise((resolve, reject) => {
    const headers = {};
    for (const [k, v] of Object.entries(msg.headers || {})) headers[k] = v;
    headers["host"] = msg.host; // present the public host (app CSRF check)
    // Force identity: the edge adds accept-encoding for its own pipeline, but
    // this relay passes bytes through opaquely, so upstream must not compress.
    headers["accept-encoding"] = "identity";
    headers["connection"] = "close";
    const req = http.request(
      { host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: msg.path, method: msg.method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const hpairs = [];
          for (const [k, v] of Object.entries(res.headers)) {
            if (v === undefined) continue;
            const lk = k.toLowerCase();
            if (["content-length", "content-encoding", "transfer-encoding", "connection", "keep-alive"].includes(lk)) continue;
            if (Array.isArray(v)) v.forEach((x) => hpairs.push([k, x]));
            else hpairs.push([k, v]);
          }
          resolve({ status: res.statusCode || 200, headers: hpairs, body: Buffer.concat(chunks) });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("upstream timeout")));
    if (msg.body) req.write(Buffer.from(msg.body, "base64"));
    req.end();
  });
}

let backoffMs = 2000;

function connect() {
  const ws = new WebSocket(`${RELAY_URL}?secret=${encodeURIComponent(SECRET)}`);
  let alive = true;
  let lastPong = Date.now();

  const pingTimer = setInterval(() => {
    if (!alive) return;
    if (Date.now() - lastPong > 60000) {
      console.log("relay: pong timeout, reconnecting");
      try { ws.close(); } catch {}
      return;
    }
    try { ws.send(JSON.stringify({ t: "ping" })); } catch {}
  }, 20000);

  ws.addEventListener("open", () => {
    console.log("relay: connected");
    backoffMs = 2000;
    lastPong = Date.now();
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.t === "pong") { lastPong = Date.now(); return; }
    if (msg.t !== "req") return;
    upstreamRequest(msg).then(
      ({ status, headers, body }) => {
        if (!alive) return;
        ws.send(JSON.stringify({
          t: "res", id: msg.id, status, headers,
          body: body.length ? body.toString("base64") : null,
        }));
      },
      (err) => {
        if (!alive) return;
        console.log("relay: upstream error:", err.message);
        ws.send(JSON.stringify({
          t: "res", id: msg.id, status: 502,
          headers: [["content-type", "text/plain; charset=utf-8"]],
          body: Buffer.from("relay: app server unreachable").toString("base64"),
        }));
      }
    );
  });

  const schedule = () => {
    if (!alive) return;
    alive = false;
    clearInterval(pingTimer);
    try { ws.close(); } catch {}
    console.log(`relay: reconnecting in ${backoffMs}ms`);
    setTimeout(connect, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 30000);
  };
  ws.addEventListener("close", schedule);
  ws.addEventListener("error", () => {});
}

connect();
