// Shared helpers for the Rays website Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
export const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

export const originOf = (req: Request) => {
  const o = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  if (o) return o;
  try { return new URL(req.headers.get("referer") ?? "").origin; } catch { return ""; }
};
export const originAllowed = (origin: string) => ORIGINS.includes(origin);

export const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": originAllowed(origin) ? origin : (ORIGINS[0] ?? "null"),
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
export const json = (status: number, body: unknown, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const clientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? ((req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown");

/** true while under the limit; fails closed if the counter is unavailable */
export async function underLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await db.rpc("hit_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) { console.error("rate limit:", error.message); return false; }
  return data === true;
}

/** remove things that look like account, phone, card or ID numbers, and email addresses */
export const mask = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/(?:\d[\s-]?){6,}/g, "[number]");
export const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
