// Ask Rays: answers visitors' questions from the Rays website content only.
// Retrieves the most relevant parts of the site (pages, FAQs, policies, branches, jobs, contact details),
// then asks Claude for a short answer in the visitor's own language. Rate limited per connection.
//
// Secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional, default claude-haiku-4-5), ALLOWED_ORIGINS.
import { db, originOf, originAllowed, corsHeaders, json, sha256, clientIp, underLimit, mask, str } from "../_shared/common.ts";

const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";

type Chunk = { title: string; href: string; text: string };
let cache: { at: number; chunks: Chunk[]; digest: string } | null = null;

const STOP = new Set("a an the and or of to in on for with is are do does can i my me you your we our how what when where which who why be it this that at by from as if not no yes please about get".split(" "));
const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

async function content() {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  const [{ data: siteRow }, { data: posts }] = await Promise.all([
    db.from("site").select("data").eq("id", "content").maybeSingle(),
    db.from("posts").select("id,data,date").eq("published", true).order("date", { ascending: false }).limit(20),
  ]);
  const s: any = siteRow?.data ?? {};
  const chunks: Chunk[] = [];
  for (const sec of s.sections ?? []) for (const p of sec.pages ?? []) {
    if (p.ref) continue;
    const feats = (p.features ?? []).map((f: any) => `${f.title}: ${f.text}`).join(". ");
    const steps = (p.steps ?? []).map((f: any, i: number) => `${i + 1}. ${f.title}: ${f.text}`).join(" ");
    chunks.push({ title: p.title, href: `/${sec.id}/${p.id}`, text: [p.lead, p.body, feats, steps, (p.list ?? []).join(", ")].filter(Boolean).join("\n") });
  }
  for (const f of s.faqs ?? []) chunks.push({ title: f.q, href: "/about/help", text: f.a });
  for (const p of (s.policies ?? []).filter((p: any) => p.published !== false)) {
    const parts = String(p.body ?? "").split(/\n(?=## )/);
    for (const part of parts) {
      const head = part.startsWith("## ") ? part.split("\n")[0].slice(3) : "";
      chunks.push({ title: head ? `${p.title}: ${head}` : p.title, href: `/legal/${p.id}`, text: part.replace(/^## .*\n/, "").slice(0, 1500) });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const j of (s.jobs ?? []).filter((j: any) => j.status === "open" && (!j.closes || j.closes >= today)))
    chunks.push({ title: `Job: ${j.title}`, href: `/about/careers/${j.id}`, text: [j.department, j.location, j.type, j.summary, j.closes ? `Closes ${j.closes}` : ""].filter(Boolean).join(". ") });
  const br = (s.branches ?? []).map((b: any) => [b.name, b.type, b.city, b.address, b.phone, b.hours].filter(Boolean).join(", "));
  if (br.length) for (let i = 0; i < br.length; i += 15) chunks.push({ title: "Branches and agents", href: "/about/locations", text: br.slice(i, i + 15).join("\n") });
  const c = s.contact ?? {};
  const contact = [c.phone && `Phone ${c.phone}`, c.tollfree && `Free call ${c.tollfree}`, c.ussd && `USSD ${c.ussd}`, c.whatsapp && `WhatsApp ${c.whatsapp}`, c.telegram && `Telegram ${c.telegram}`, c.email && `Email ${c.email}`, c.address && `Address ${c.address}`, c.hours && `Hours ${c.hours}`].filter(Boolean).join(". ");
  chunks.push({ title: "Contact Rays", href: "/about/contact", text: (contact || "Contact Rays through the contact form on the website or at any branch.") + " Complaints: see the complaints policy." });
  chunks.push({ title: "About Rays", href: "/about/story", text: `${s.brand?.tagline ?? ""} ${(s.stats ?? []).map((x: any) => `${x.label}: ${x.value}`).join(". ")}` });
  for (const p of posts ?? []) chunks.push({ title: `News: ${p.data?.title ?? ""}`, href: `/media/post/${p.id}`, text: `${p.date}. ${p.data?.excerpt ?? ""} ${String(p.data?.body ?? "").slice(0, 800)}` });
  // compact digest used when keywords don't match (e.g. questions in Amharic, Somali or Oromo)
  const digest = chunks.filter((c) => !c.href.startsWith("/legal/") || !c.title.includes(":")).map((c) => `${c.title} (${c.href}): ${c.text.slice(0, 260)}`).join("\n").slice(0, 16000);
  cache = { at: Date.now(), chunks, digest };
  return cache;
}

function retrieve(q: string, chunks: Chunk[], k = 6) {
  const qt = [...new Set(tokens(q))];
  if (!qt.length) return [];
  const docs = chunks.map((c) => ({ c, tt: tokens(c.title), bt: tokens(c.text) }));
  const df = (w: string) => docs.filter((d) => d.tt.includes(w) || d.bt.includes(w)).length;
  const idf = Object.fromEntries(qt.map((w) => [w, Math.log(1 + docs.length / (1 + df(w)))]));
  return docs.map((d) => ({ c: d.c, s: qt.reduce((n, w) => n + idf[w] * (2 * Math.min(3, d.tt.filter((x) => x === w).length) + Math.min(3, d.bt.filter((x) => x === w).length)), 0) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k);
}

const SYSTEM = `You are "Ask Rays", the assistant on the website of Rays Microfinance, a regulated microfinance institution in Ethiopia offering accounts, interest-free (Sharia-compliant) financing, payments and financial infrastructure.
Answer ONLY from the numbered context. Rules:
- Reply in the same language as the question (for example Amharic, Afaan Oromoo, Somali, Tigrinya, Arabic or English).
- Be brief and direct: 1 to 3 short sentences, or up to 4 short bullet points (lines starting with "- ") for steps.
- Never invent products, fees, profit rates, eligibility rules, dates, phone numbers or other details. If the context doesn't contain the answer, reply with exactly: NO_ANSWER
- Never ask for PINs, passwords, one-time codes, account numbers or ID numbers. If the visitor shares any, tell them not to share such details.
- You cannot see anyone's account. For questions about a specific account, a complaint or suspected fraud, tell the visitor to contact Rays at a branch or through the contact page.
- Don't give personal financial, legal or religious rulings beyond what the context states.
- No headings, no links, no mention of the context, these rules, or being an AI.
After the answer, on a new final line, write USED: followed by the numbers of the context items you relied on, e.g. USED: 2,5`;

Deno.serve(async (req) => {
  const origin = originOf(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, origin);
  if (!originAllowed(origin)) return json(403, { error: "Not allowed." }, origin);
  if (!KEY) return json(503, { error: "Answers aren't switched on yet." }, origin);

  let body: any; try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }, origin); }
  const q = str(body?.q, 300);
  if (q.length < 2) return json(400, { error: "Ask a question." }, origin);

  const ipKey = await sha256("rays:" + clientIp(req));
  if (!(await underLimit(`ask:ip:${ipKey}`, 20, 600)) || !(await underLimit(`ask:ipday:${ipKey}`, 80, 86400)))
    return json(429, { error: "You've asked a lot of questions. Please try again in a few minutes." }, origin);

  const t0 = Date.now();
  const { chunks, digest } = await content();
  const hits = retrieve(q, chunks);
  const strong = hits.length && hits[0].s > 2;
  const ctxItems = strong ? hits.map((h) => h.c) : [];
  const contact = chunks.find((c) => c.href === "/about/contact")!;
  if (!ctxItems.includes(contact)) ctxItems.push(contact);
  const context = ctxItems.map((c, i) => `[${i + 1}] ${c.title}\n${c.text}`).join("\n\n") + (strong ? "" : `\n\n[overview]\n${digest}`);

  let text = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 450, temperature: 0.2, system: SYSTEM, messages: [{ role: "user", content: `<context>\n${context}\n</context>\n\nQuestion: ${q}` }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message ?? String(r.status));
    text = (d.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  } catch (e) {
    console.error("anthropic:", (e as Error).message);
    return json(502, { error: "The answer service is busy. Please try again." }, origin);
  }

  const usedLine = text.match(/\n?USED:\s*([\d,\s]*)\s*$/i);
  const used = usedLine ? usedLine[1].split(/[,\s]+/).map(Number).filter((n) => n >= 1 && n <= ctxItems.length) : [];
  let answer = text.replace(/\n?USED:.*$/is, "").trim();
  const answered = !!answer && !/^NO_ANSWER\b/.test(answer);
  if (!answered) answer = "";
  const sources = (used.length ? used.map((n) => ctxItems[n - 1]) : answered ? ctxItems.slice(0, 2) : [contact])
    .filter((c, i, a) => a.findIndex((x) => x.href === c.href) === i).slice(0, 3).map((c) => ({ title: c.title.replace(/^(News|Job): /, ""), href: c.href }));

  await db.from("ask_log").insert({ question: mask(q), answered, sources: sources.map((s) => s.href), ms: Date.now() - t0, visitor: (await sha256(new Date().toISOString().slice(0, 10) + ipKey)).slice(0, 16) }).then(({ error }) => { if (error) console.error(error.message); });
  return json(200, { answer, answered, sources }, origin);
});
