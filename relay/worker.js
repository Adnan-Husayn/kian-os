// Kian OS relay — public ingress for the Kian OS Next.js app.
//
// Browser traffic hits this Worker (https://kian-os.<subdomain>.workers.dev)
// and is forwarded, request by request, over a single authenticated WebSocket
// held by the VM relay client (relay/client.mjs). The client performs each
// request against the local Next.js server and posts the response back.
// A Durable Object holds the VM socket so every isolate routes consistently.

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "content-length",
]);

/**
 * Constant-time string comparison so a wrong secret isn't distinguishable
 * by response timing. (Length mismatch returns early — the scheme prefix
 * length isn't sensitive.)
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export class Relay {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.vm = null; // VM control WebSocket
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.seq = 0;
  }

  /** The relay secret travels in an Authorization header, never in the URL
   *  (query params end up in logs). Compared in constant time. */
  isAuthorized(req) {
    const expected = this.env.RELAY_SECRET || "";
    if (!expected) return false; // fail closed when no secret is configured
    const auth = req.headers.get("authorization") || "";
    return timingSafeEqual(auth, `Bearer ${expected}`);
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/relay") return this.handleVmSocket(req);
    if (url.pathname === "/_status") {
      if (!this.isAuthorized(req)) {
        return new Response("forbidden", { status: 403 });
      }
      return Response.json({ vmConnected: !!this.vm, pending: this.pending.size });
    }
    return this.handleBrowser(req, url);
  }

  async handleVmSocket(req) {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 400 });
    }
    if (!this.isAuthorized(req)) {
      return new Response("forbidden", { status: 403 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.vm) {
      try { this.vm.close(4000, "replaced"); } catch {}
    }
    this.vm = server;
    server.accept();
    server.addEventListener("message", (ev) => this.onVmMessage(ev.data));
    const gone = () => {
      if (this.vm === server) this.vm = null;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error("vm disconnected"));
      }
      this.pending.clear();
    };
    server.addEventListener("close", gone);
    server.addEventListener("error", gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  onVmMessage(data) {
    let msg;
    try {
      msg = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch { return; }
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "ping") {
      try { this.vm && this.vm.send(JSON.stringify({ t: "pong" })); } catch {}
      return;
    }
    if (msg.t === "res") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      p.resolve(msg);
    }
  }

  async handleBrowser(req, url) {
    if (!this.vm) {
      return new Response(
        "Kian OS is starting up — the app server is not connected yet. Wait a few seconds and refresh.",
        { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    const id = `${Date.now().toString(36)}-${++this.seq}-${Math.random().toString(36).slice(2, 8)}`;
    const headers = {};
    req.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk) || lk === "host" || lk.startsWith("cf-")) return;
      headers[lk] = v;
    });
    const clientIp = req.headers.get("cf-connecting-ip");
    if (clientIp) headers["x-forwarded-for"] = clientIp;
    headers["x-forwarded-proto"] = "https";
    headers["x-forwarded-host"] = url.host;

    let bodyB64 = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 8 * 1024 * 1024) {
        return new Response("request body too large", { status: 413 });
      }
      if (buf.byteLength > 0) bodyB64 = b64encode(buf);
    }

    const frame = {
      t: "req", id,
      method: req.method,
      path: url.pathname + url.search,
      host: url.host, // VM must present this as the Host header (CSRF check)
      headers, body: bodyB64,
    };

    let res;
    try {
      res = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error("vm timeout"));
        }, 25000);
        this.pending.set(id, { resolve, reject, timer });
        try {
          this.vm.send(JSON.stringify(frame));
        } catch (e) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(e);
        }
      });
    } catch (e) {
      return new Response(`relay error: ${e.message}`, { status: 502 });
    }

    const outHeaders = new Headers();
    for (const [k, v] of res.headers || []) {
      const lk = String(k).toLowerCase();
      if (HOP_BY_HOP.has(lk)) continue;
      try { outHeaders.append(k, v); } catch {}
    }
    let body = null;
    if (res.body) body = b64decode(res.body);
    return new Response(body, { status: res.status || 200, headers: outHeaders });
  }
}

export default {
  async fetch(req, env) {
    const id = env.RELAY.idFromName("kian-os-relay");
    const stub = env.RELAY.get(id);
    return stub.fetch(req);
  },
};
