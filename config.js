// Local fallback config. On Vercel, prefer Environment Variables instead:
//   SUPABASE_URL, SUPABASE_ANON_KEY, ADOBE_FONTS_KIT, SITE_URL
// The anon key is safe to publish: it can only do what supabase/schema.sql permits.
window.RAYS_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  mediaBucket: "media",
  adobeFontsKit: "",
  turnstileSiteKey: ""   // Cloudflare Turnstile site key (public). Prefer the TURNSTILE_SITE_KEY env var on Vercel.
};
