// Rays website build: minifies and fingerprints assets, then prerenders every page to
// static HTML (content + data embedded), so phones get a complete page in the first response.
//
// Env (set in Vercel → Settings → Environment Variables; falls back to config.js):
//   SUPABASE_URL, SUPABASE_ANON_KEY, ADOBE_FONTS_KIT, SITE_URL (default https://raysfinance.com)
import { build, transform } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";

const OUT = "dist";
const t0 = Date.now();

// ---------- config ----------
let fileCfg = {};
if (existsSync("config.js")) {
  const ctx = { window: {} }; vm.runInNewContext(await readFile("config.js", "utf8"), ctx); fileCfg = ctx.window.RAYS_CONFIG || {};
}
const CFG = {
  supabaseUrl: process.env.SUPABASE_URL || fileCfg.supabaseUrl || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || fileCfg.supabaseAnonKey || "",
  adobeFontsKit: process.env.ADOBE_FONTS_KIT || fileCfg.adobeFontsKit || "",
  mediaBucket: fileCfg.mediaBucket || "media",
};
const SITE_URL = (process.env.SITE_URL || "https://raysfinance.com").replace(/\/$/, "");

// ---------- assets ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/assets`, { recursive: true });
const hash = s => createHash("sha256").update(s).digest("hex").slice(0, 10);
const target = ["es2020", "chrome80", "safari14", "firefox80"];

async function js(file) {
  const r = await build({ entryPoints: [file], bundle: false, minify: true, format: "iife", target, write: false, legalComments: "none" });
  return r.outputFiles[0].text;
}
const appSrc = await readFile("src/app.js", "utf8");
const appJs = await js("src/app.js");
const adminJs = await js("src/admin.js");
const css = (await transform(await readFile("src/styles.css", "utf8"), { loader: "css", minify: true, target })).code;

const adminName = `admin.${hash(adminJs)}.js`;
const appName = `app.${hash(appJs)}.js`;
await writeFile(`${OUT}/assets/${adminName}`, adminJs);
await writeFile(`${OUT}/assets/${appName}`, appJs);
await cp("assets/brand", `${OUT}/assets/brand`, { recursive: true });
if (existsSync("public")) await cp("public", OUT, { recursive: true });
await cp("content.json", `${OUT}/content.json`);

// ---------- content ----------
async function sb(p) {
  const r = await fetch(`${CFG.supabaseUrl.replace(/\/$/, "")}/rest/v1/${p}`, { headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}` } });
  if (!r.ok) throw new Error(`Supabase ${r.status} for ${p}`);
  return r.json();
}
let data = { site: null, posts: [] };
if (CFG.supabaseUrl && CFG.supabaseAnonKey) {
  try {
    const [site, posts] = await Promise.all([
      sb("site?id=eq.content&select=data"),
      sb("posts?select=id,data,published,date&published=eq.true&order=date.desc&limit=60"),
    ]);
    data.site = site?.[0]?.data || null;
    data.posts = posts.map(r => ({ ...(r.data || {}), id: r.id, published: r.published, date: r.date }));
    console.log(`content: Supabase (${data.posts.length} posts)`);
  } catch (e) { console.warn("content: Supabase unavailable, using content.json —", e.message); }
}
if (!data.site) { data.site = JSON.parse(await readFile("content.json", "utf8")); console.log("content: content.json"); }

// ---------- prerender ----------
const win = { __RAYS_PRERENDER: true, RAYS_CONFIG: CFG, RAYS_ASSETS: { logo: "/assets/brand/rays-logo.svg", tagline: "/assets/brand/rays-tagline.svg" } };
const noop = () => {};
const sandbox = {
  window: win, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, head: { appendChild: noop } },
  location: { protocol: "https:", pathname: "/", hash: "" }, history: {}, localStorage: { getItem: () => null, setItem: noop },
  navigator: {}, matchMedia: () => ({ matches: false }), console, setTimeout, Promise, JSON, Date, Math, Object, Array, String, RegExp, encodeURIComponent,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(appSrc, sandbox);
const prerender = sandbox.window.RaysPrerender;

const routes = new Set(["/", "/media", "/media/article", "/media/video", "/media/gallery"]);
for (const s of data.site.sections || []) { routes.add(`/${s.id}`); for (const p of s.pages) routes.add(`/${s.id}/${p.id}`); }
for (const p of data.posts) routes.add(`/media/post/${p.id}`);
routes.add("/legal");
for (const p of (data.site.policies || []).filter(p => p.published !== false)) routes.add(`/legal/${p.id}`);
const todayStr = new Date().toISOString().slice(0, 10);
routes.add("/about/careers/open");
for (const j of (data.site.jobs || []).filter(j => j.status === "open" && (!j.closes || j.closes >= todayStr))) routes.add(`/about/careers/${j.id}`);

// Pages other than /legal/* don't need full policy texts: ship a lighter copy.
const liteData = { ...data, site: { ...data.site, policies: (data.site.policies || []).map(({ body, ...p }) => p) } };
await mkdir(`${OUT}/data`, { recursive: true });
await writeFile(`${OUT}/data/site.json`, JSON.stringify(data.site));

const brand = data.site.brand || {}, contact = data.site.contact || {}, social = data.site.social || {};
const orgLd = { "@context": "https://schema.org", "@type": "FinancialService", name: brand.name || "Rays Microfinance", url: SITE_URL + "/", logo: SITE_URL + "/icons/icon-512.png",
  description: brand.tagline || "", slogan: brand.tagline2 || undefined, areaServed: "ET", foundingDate: "2014",
  address: contact.address ? { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "ET" } : undefined,
  telephone: contact.phone || undefined, email: contact.email || undefined,
  sameAs: Object.values(social).filter(Boolean).map(v => /^https?:/.test(v) ? v : "https://t.me/" + String(v).replace(/^@/, "")) };

const escAttr = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const jsonBlock = (id, o) => `<script type="application/json" id="${id}">${JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "")}</script>`;
const runtimeCfg = { ...CFG, adminScript: `/assets/${adminName}` };

function page({ html, title, description, faqs }, route) {
  const embed = route.startsWith("/legal/") ? data : liteData;
  const ld = [route === "/" ? orgLd : null,
    faqs && faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null].filter(Boolean);
  const url = SITE_URL + (route === "/" ? "/" : route);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#442580">
<meta property="og:type" content="website"><meta property="og:url" content="${url}">
<meta property="og:title" content="${escAttr(title)}"><meta property="og:description" content="${escAttr(description)}">
<meta property="og:image" content="${SITE_URL}/icons/og.png">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/assets/brand/rays-mark.svg">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
${CFG.supabaseUrl ? `<link rel="preconnect" href="${CFG.supabaseUrl}" crossorigin>` : ""}
<link rel="preload" as="image" href="/assets/brand/rays-logo.svg" fetchpriority="high">
<style>${css}</style>
${jsonBlock("rays-config", runtimeCfg)}
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("")}
<script src="/assets/${appName}" defer></script>
</head>
<body>
<div id="app">${html || `<div class="loading">Loading Rays…</div>`}</div>
${jsonBlock("rays-data", embed)}
</body>
</html>`;
}

let bytes = 0;
for (const r of routes) {
  const out = prerender(data, r);
  const file = r === "/" ? `${OUT}/index.html` : `${OUT}${r}.html`;
  await mkdir(path.dirname(file), { recursive: true });
  const doc = page(out, r); bytes += doc.length;
  await writeFile(file, doc);
}
// Fallback for routes that aren't prerendered yet (the portal, pages added since the last build)
await writeFile(`${OUT}/_app.html`, page({ html: "", title: "Rays Microfinance", description: data.site.brand?.tagline || "" }, "/_app"));

// ---------- SEO ----------
const today = new Date().toISOString().slice(0, 10);
await writeFile(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...routes].map(r => `<url><loc>${SITE_URL}${r === "/" ? "/" : r}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile(`${OUT}/robots.txt`, `User-agent: *\nDisallow: /admin\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`built ${routes.size} pages in ${Date.now() - t0} ms · app ${(appJs.length / 1024).toFixed(1)} KB · portal ${(adminJs.length / 1024).toFixed(1)} KB (lazy) · css ${(css.length / 1024).toFixed(1)} KB (inlined)`);
