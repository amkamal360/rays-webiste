// Protected public form submissions: contact form and job applications.
// Checks origin, the Cloudflare Turnstile bot test (when TURNSTILE_SECRET_KEY is set) and rate limits,
// validates every field, then stores it with the service role. CVs upload through a single-use signed URL.
import { db, originOf, originAllowed, corsHeaders, json, sha256, clientIp, underLimit, str } from "../_shared/common.ts";

const TS_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
const CV_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const CV_MAX = 5 * 1024 * 1024;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cv";

Deno.serve(async (req) => {
  const origin = originOf(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, origin);
  if (!originAllowed(origin)) return json(403, { error: "This form can only be sent from the Rays website." }, origin);
  if (Number(req.headers.get("content-length") ?? 0) > 20_000) return json(413, { error: "Submission too large." }, origin);

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }, origin); }
  const type = body?.type;
  if (type !== "contact" && type !== "application") return json(400, { error: "Invalid request." }, origin);

  const ip = clientIp(req);
  const ipKey = await sha256("rays:" + ip);

  if (TS_SECRET) {
    const form = new FormData();
    form.append("secret", TS_SECRET); form.append("response", str(body.token, 2048)); form.append("remoteip", ip);
    const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!ts.success) return json(400, { error: "The security check failed. Please complete it again." }, origin);
  }

  if (!(await underLimit(`${type}:ip:${ipKey}`, 5, 3600)) || !(await underLimit(`${type}:ipday:${ipKey}`, type === "contact" ? 15 : 12, 86400)))
    return json(429, { error: "Too many submissions from your connection. Please try again later." }, origin);

  const f = body.fields ?? {};
  if (type === "contact") {
    const row = { name: str(f.name, 120), reach: str(f.reach, 160), audience: str(f.audience, 60), message: str(f.message, 4000) };
    if (!row.name || !row.reach || !row.message) return json(400, { error: "Fill in your name, a phone number or email, and your message." }, origin);
    const { error } = await db.from("inquiries").insert(row);
    if (error) { console.error(error.message); return json(500, { error: "Your message couldn't be saved. Please try again." }, origin); }
    return json(200, { ok: true }, origin);
  }

  const row: Record<string, string> = {
    job_id: str(f.jobId, 120) || "open", job_title: str(f.jobTitle, 200), name: str(f.name, 120), email: str(f.email, 160).toLowerCase(),
    phone: str(f.phone, 40), message: str(f.message, 3000), cv_link: str(f.cvLink, 500), cv_path: "", cv_name: "",
  };
  if (!row.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || !row.phone) return json(400, { error: "Enter your name, a valid email address and a phone number." }, origin);
  if (!(await underLimit(`application:email:${await sha256(row.email)}`, 3, 86400)))
    return json(429, { error: "We've already received several applications from this email address today." }, origin);

  if (row.job_id !== "open") {
    const { data: site } = await db.from("site").select("data").eq("id", "content").maybeSingle();
    const job = (site?.data?.jobs ?? []).find((j: any) => j.id === row.job_id);
    const today = new Date().toISOString().slice(0, 10);
    if (!job || job.status !== "open" || (job.closes && job.closes < today)) return json(400, { error: "This role is no longer accepting applications." }, origin);
    row.job_title = String(job.title ?? row.job_title).slice(0, 200);
  }

  let upload: { signedUrl: string } | null = null;
  if (body.cv) {
    const cv = body.cv;
    const ext = (String(cv.name ?? "").match(/\.(pdf|docx?)$/i)?.[0] ?? "").toLowerCase();
    if (!ext || !CV_TYPES.includes(String(cv.type)) || !(Number(cv.size) > 0 && Number(cv.size) <= CV_MAX))
      return json(400, { error: "Attach your CV as a PDF or Word document up to 5 MB." }, origin);
    row.cv_path = `applications/${crypto.randomUUID()}-${slug(row.name)}${ext}`;
    row.cv_name = str(cv.name, 200);
    const { data, error } = await db.storage.from("cvs").createSignedUploadUrl(row.cv_path);
    if (error || !data) { console.error(error?.message); return json(500, { error: "Your CV couldn't be prepared for upload. Please try again." }, origin); }
    upload = { signedUrl: data.signedUrl };
  } else if (!row.cv_link) {
    return json(400, { error: "Attach your CV." }, origin);
  }

  const { error } = await db.from("applications").insert(row);
  if (error) { console.error(error.message); return json(500, { error: "Your application couldn't be saved. Please try again." }, origin); }
  return json(200, { ok: true, upload }, origin);
});
