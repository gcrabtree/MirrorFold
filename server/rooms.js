/* The meeting point for Fly together. It runs on Cloudflare Workers (see README.md in this folder), not on the page.
   Two browsers that want to talk straight to each other first have to swap a description of how each can be reached.
   This passes those two descriptions across and nothing else: no places, no music, no names. Once the browsers are
   joined they do not use it again.

   A room is a code of letters the host's page makes up. The host keeps one connection to the room open while the
   invitation stands. A guest opens one, sends its description, is sent the host's back, and is cut off.
   A phone stops a page that is not in front, and a host has to leave the page to send the link. Its connection then
   looks open and hears nothing. So when the host's page comes back and takes its room again, every guest still
   waiting is told ("h") and may send its description once more.
   Nothing is kept: when the host goes, the room is gone.

   What keeps it small and safe to leave running:
   - only pages from the addresses in ORIGINS may use it;
   - one address may open at most PER_MINUTE connections a minute (a rough count, kept per copy of this script);
   - a guest has GUEST_MS to finish, may send one message (and one more each time the host comes back), and at most GUESTS wait in a room at once;
   - a room lasts at most HOST_MS; no message may be longer than MAX letters. */
import { DurableObject } from "cloudflare:workers";

const MAX = 12000;
const GUESTS = 6;
const GUEST_MS = 180 * 1000;
const HOST_MS = 12 * 60 * 60 * 1000;
const PER_MINUTE = 30;
const ROOM = /^\/room\/([a-z2-9]{6,12})$/;
const KEY = /^[a-z2-9]{8,32}$/;

/* how many connections each address has opened in the present minute */
let minute = 0;
const opened = new Map();
function tooMany(ip) {
  const now = Math.floor(Date.now() / 60000);
  if (now !== minute) { minute = now; opened.clear(); }
  const n = (opened.get(ip) || 0) + 1;
  opened.set(ip, n);
  return n > PER_MINUTE;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = ROOM.exec(url.pathname);
    if (!m) return new Response("The meeting point for MirrorFold's Fly together.\n", { status: url.pathname === "/" ? 200 : 404 });
    const allowed = String(env.ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(req.headers.get("Origin") || "")) return new Response("This page may not use the meeting point.\n", { status: 403 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("A websocket is expected.\n", { status: 426 });
    const role = url.searchParams.get("role");
    if (role !== "host" && role !== "guest") return new Response("No role.\n", { status: 400 });
    if (role === "host" && !KEY.test(url.searchParams.get("key") || "")) return new Response("No key.\n", { status: 400 });
    if (tooMany(req.headers.get("CF-Connecting-IP") || "?")) return new Response("Too many connections. Wait a minute.\n", { status: 429 });
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  },
};

/* One room. Its connections sleep between messages, so an open invitation costs nothing while nobody joins.
   Each connection carries a note: r its role, id a guest's name within the room, key the host's secret, at when it
   opened, sent whether a guest has had its one message.
   Closing codes the page understands: 4404 no host here, 4408 took too long, 4409 the room has another host,
   4429 too many waiting, 4400 a message that is not allowed. */
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /* the page says "p" now and then to keep its connection alive; "q" is said back without waking the room */
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("p", "q"));
  }

  async fetch(req) {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    const hosts = this.ctx.getWebSockets("host");
    const now = Date.now();
    let refuse = 0;
    if (role === "host") {
      const key = url.searchParams.get("key");
      for (const h of hosts) {
        /* the same host coming back after its connection broke takes its room again; anyone else is turned away */
        if ((h.deserializeAttachment() || {}).key === key) { try { h.close(4409, "replaced"); } catch (_) {} }
        else refuse = 4409;
      }
      if (!refuse) {
        this.ctx.acceptWebSocket(server, ["host"]);
        server.serializeAttachment({ r: "host", key: key, at: now });
        /* what a waiting guest sent may have gone to a connection that was not listening: each may send again */
        for (const g of this.ctx.getWebSockets("guest")) {
          const a = g.deserializeAttachment() || {};
          a.sent = false; g.serializeAttachment(a);
          try { g.send('{"t":"h"}'); } catch (_) {}
        }
      }
    } else {
      if (!hosts.length) refuse = 4404;
      else if (this.ctx.getWebSockets("guest").length >= GUESTS) refuse = 4429;
      else {
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
        this.ctx.acceptWebSocket(server, ["guest", "g:" + id]);
        server.serializeAttachment({ r: "guest", id: id, at: now, sent: false });
      }
    }
    if (refuse) { server.accept(); server.close(refuse, "refused"); }
    else await this.arm();
    return new Response(null, { status: 101, webSocket: client });
  }

  /* wake when the next connection has had its time */
  async arm() {
    let next = Infinity;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      next = Math.min(next, (a.at || 0) + (a.r === "host" ? HOST_MS : GUEST_MS));
    }
    if (next === Infinity) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next + 500));
  }

  async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      if (now >= (a.at || 0) + (a.r === "host" ? HOST_MS : GUEST_MS)) { try { ws.close(4408, "time"); } catch (_) {} }
    }
    await this.arm();
  }

  async webSocketMessage(ws, text) {
    const a = ws.deserializeAttachment() || {};
    let m = null;
    if (typeof text === "string" && text.length <= MAX) { try { m = JSON.parse(text); } catch (_) {} }
    if (!m || typeof m !== "object") { ws.close(4400, "not allowed"); return; }
    if (a.r === "guest") {
      /* a guest's one message: its description, passed to the host with the guest's name in the room */
      const host = this.ctx.getWebSockets("host")[0];
      if (a.sent || m.t !== "o" || typeof m.s !== "string") { ws.close(4400, "not allowed"); return; }
      if (!host) { ws.close(4404, "no host"); return; }
      a.sent = true; ws.serializeAttachment(a);
      host.send(JSON.stringify({ t: "o", g: a.id, s: m.s }));
      return;
    }
    /* the host's answer to one guest ("a", with its description) or its refusal ("n": no room left); either way that guest is done here */
    if ((m.t !== "a" && m.t !== "n") || typeof m.g !== "string" || (m.t === "a" && typeof m.s !== "string")) { ws.close(4400, "not allowed"); return; }
    for (const g of this.ctx.getWebSockets("g:" + m.g)) {
      try { g.send(JSON.stringify(m.t === "a" ? { t: "a", s: m.s } : { t: "n" })); g.close(1000, "done"); } catch (_) {}
    }
  }

  async webSocketClose(ws, code) {
    const a = ws.deserializeAttachment() || {};
    /* the host has gone, and no other has taken its place: those still waiting are told the invitation has ended ("e") */
    if (a.r === "host" && !this.ctx.getWebSockets("host").some((h) => h !== ws && h.readyState === 1)) {
      for (const g of this.ctx.getWebSockets("guest")) { try { g.send('{"t":"e"}'); g.close(4404, "no host"); } catch (_) {} }
    }
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, "closed"); } catch (_) {}
    await this.arm();
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011);
  }
}
