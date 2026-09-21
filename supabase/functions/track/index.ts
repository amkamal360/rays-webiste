// Cookieless website analytics. Receives batched events via navigator.sendBeacon (text/plain, no preflight).
// Stores no IP address: visitors are counted with sha256(salt + date + ip + user agent), which changes daily.
import { db, originOf, originAllowed, sha256, clientIp, underLimit, mask, str } from "../_shared/common.ts";

const SALT = Deno.env.get("ANALYTICS_SALT") ?? (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").slice(-24);
const TYPES = new Set(["pv", "click", "outbound", "search", "ask", "ask_feedback", "ask_unanswered", "form", "404"]);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios/i;
const noContent = () => new Response(null, { status: 204 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return noContent();
  if (!originAllowed(originOf(req))) return noContent();
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return noContent();
  const text = await req.text();
  if (text.length > 16_000) return noContent();
  let body: any; try { body = JSON.parse(text); } catch { return noContent(); }

  const ip = clientIp(req);
  if (!(await underLimit("track:" + (await sha256("rays:" + ip)), 240, 3600))) return noContent();

  const day = new Date().toISOString().slice(0, 10);
  const visitor = (await sha256(`${SALT}|${day}|${ip}|${ua}`)).slice(0, 24);
  const device = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone/i.test(ua) ? "Phone" : "Computer";
  let ref = ""; try { ref = body.r ? new URL(String(body.r)).hostname.replace(/^www\./, "") : ""; } catch { /* ignore */ }

  const rows = (Array.isArray(body.e) ? body.e : []).slice(0, 50).filter((e: any) => TYPES.has(e?.t)).map((e: any) => ({
    type: e.t,
    path: str(e.p, 200).replace(/[?#].*$/, ""),
    label: ["search", "ask", "ask_feedback", "ask_unanswered"].includes(e.t) ? mask(str(e.l, 200)) : str(e.l, 200),
    ref: e.t === "pv" ? ref : "",
    device, visitor,
  }));
  if (rows.length) { const { error } = await db.from("events").insert(rows); if (error) console.error(error.message); }
  if (Math.random() < 0.002) await db.rpc("prune_analytics");
  return noContent();
});
