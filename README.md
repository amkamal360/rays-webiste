# Rays Microfinance website

One folder for the whole website:
- Push it to GitHub, and **Vercel** builds and hosts the site.
- A **GitHub Action** applies the **Supabase** database changes and deploys the server functions.

Brand follows the Rays Brand Manual v1.0: official vector logo and tagline, Rays Purple `#442580`, Rays Yellow `#FCC909`, Myriad Pro with a Helvetica fallback.

```
rays-website/
├─ src/                    website code: app.js (public site), admin.js (portal, loaded only on /admin), styles.css
├─ assets/brand/           official logo, mark and tagline (from the brand manual)
├─ public/                 favicon, app icons, social-share image, web manifest
├─ content.json            starter content (pages, FAQs, policies)
├─ build.mjs               build: prerenders every page to static HTML, sitemap, llms.txt
├─ vercel.json             hosting: security headers, redirects, caching
├─ supabase/
│  ├─ migrations/          database changes, applied in order (idempotent)
│  ├─ functions/           Edge Functions: submit (forms), ask (Ask Rays), track (analytics)
│  ├─ config.toml          Supabase CLI settings
│  ├─ setup-all.sql        all migrations in one file, for pasting into the SQL editor
│  ├─ seed.sql             starter content
│  └─ add-admin.sql        make a user a website editor
└─ .github/workflows/supabase.yml   deploys supabase/ on every push to main
```

## What visitors get

- **Four menu items:** Personal, Business, Financing, Partners. Each opens **one short page** with every product's key facts and a next step. Everything else lives in the footer.
- **Ask Rays**, front and centre. Visitors type a question and the answer appears right there.
  - Without AI, it answers instantly from the FAQs and pages.
  - With AI switched on, Claude answers in the visitor's language (Amharic, Afaan Oromoo, Somali, Arabic or English), using only Rays website content, and cites the pages it used.
- **Six "I want to…" shortcuts** under the ask box: open an account, get financing, send and pay, accept payments, find a branch, get help.
- **Light and dark mode**, fast on mobile data: static HTML, about 60 KB for a first visit.

## Deploy

### 1. Push to GitHub
```bat
git add .
git commit -m "Rays website"
git push
```

### 2. Vercel (website)
Import the repository in Vercel; `vercel.json` already sets the build. Under **Settings → Environment Variables**, add:

| Name | Value | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | yes |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Legacy** → `anon` `public` | yes |
| `SITE_URL` | `https://raysfinance.com` | yes |
| `TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → your widget → Site key | recommended |
| `AI_ANSWERS` | `on`, once `ANTHROPIC_API_KEY` is set in Supabase (step 3) | optional |
| `ADOBE_FONTS_KIT` | Adobe Fonts project ID for Myriad Pro | optional |

Never put the `service_role` or secret key in Vercel.

### 3. Supabase (database and functions)
**Option A: automatic (recommended).** In GitHub, open **Settings → Secrets and variables → Actions** and add:
- **Secrets:**
  - `SUPABASE_ACCESS_TOKEN`: supabase.com → Account → Access Tokens
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_PROJECT_REF`: Project Settings → General → Project ID
  - Optional: `TURNSTILE_SECRET_KEY` and `ANTHROPIC_API_KEY`
- **Variable:** `ALLOWED_ORIGINS` = `https://raysfinance.com,https://www.raysfinance.com,https://rays-webiste.vercel.app`

Then go to **Actions → Supabase → Run workflow**. From then on, every push that changes `supabase/` redeploys it automatically.

**Option B: by hand.**
1. Paste `supabase/setup-all.sql` into **SQL Editor** and run it.
2. Run `supabase/seed.sql` once for the starter content.
3. Deploy the functions with the CLI:
   ```bash
   supabase link --project-ref YOUR_REF
   supabase functions deploy submit --no-verify-jwt
   supabase functions deploy ask --no-verify-jwt
   supabase functions deploy track --no-verify-jwt
   supabase secrets set ALLOWED_ORIGINS=... TURNSTILE_SECRET_KEY=... ANTHROPIC_API_KEY=...
   ```

**Either way, also in the Supabase dashboard:**
1. **Authentication → Sign In / Providers → Email:** turn off **Allow new users to sign up**.
2. **Authentication → Multi-Factor:** make sure TOTP is on.
3. **Authentication → Attack Protection:** turn on CAPTCHA, choose Turnstile, and paste the Turnstile **secret** key.
4. **Authentication → URL Configuration:** set Site URL to `https://raysfinance.com`.
5. **Authentication → Users → Add user** (tick Auto Confirm). Then edit the email in `supabase/add-admin.sql` and run it.

### 4. Sign in
Open `/admin`, sign in, and set up two-factor with an authenticator app. Then fill in the contact details, branches and links under **Brand, contact and links**.

### 5. Domain (Cloudflare DNS)
1. In **Vercel → Domains**, add `raysfinance.com` and `www.raysfinance.com`.
2. In **Cloudflare DNS**, add the records Vercel shows (usually A `@` → `76.76.21.21` and CNAME `www` → `cname.vercel-dns.com`), set to **DNS only** (grey cloud). Leave MX and TXT records alone.

## Security

| Layer | Protection |
|---|---|
| Database rules | Only listed admins **with two-factor sign-in** can change anything. Postgres enforces this, so it holds even against direct API calls. |
| Sign-in | Password + authenticator code, Turnstile bot check, Supabase's sign-in rate limits, and sign-out after 30 minutes idle. |
| Public forms | Sent only through the `submit` function, which checks origin, the Turnstile bot test and rate limits (5 an hour and 12–15 a day per connection; 3 applications a day per email), and validates every field. The public can't write to the database or storage directly. |
| CVs | Private storage, opened by editors through 5-minute links. |
| Ask Rays | Checks origin, limits each connection to 20 questions per 10 minutes and 80 a day, and answers only from website content. Long numbers and emails are removed before questions are stored. |
| Activity log | Every portal change records who and when (**Portal → Activity log**). |
| Headers | Strict content security policy, HSTS, no framing. The portal is never indexed or cached. |

## Insights (analytics)

**Portal → Insights** shows, for the last 7, 30 or 90 days:
- visitors and page views per day
- top pages, and what people click
- **what people ask and search for**, and **questions the site couldn't answer** (add these to the FAQs)
- answer feedback (👍 👎), referrers, devices, and pages not found

It uses no cookies and stores no IP addresses: visitors are counted with a one-way code that changes daily. "Do Not Track" is respected. Data is kept for 13 months, and questions for 90 days.

## SEO and AEO (answer engines)

- **Static pages:** every page is prerendered to HTML with its title, description, canonical link and social-share tags.
- **Structured data:**
  - Organisation, WebSite and BreadcrumbList on every page
  - FinancialProduct for financing, and Service for other products
  - FAQPage on Help
  - JobPosting on open roles, so they can appear in Google's job listings
- **For AI assistants:**
  - `/llms.txt`: a short map of the site
  - `/llms-full.txt`: all public content as plain text
  - `robots.txt` welcomes search engines and AI crawlers, and excludes `/admin`

  This helps assistants such as ChatGPT, Claude and Perplexity quote Rays accurately.
- **Answer-first writing:** every product's first sentence answers "what is it and how do I get it".
- **Search Console:** add `raysfinance.com` in Google Search Console and submit `/sitemap.xml`.

## Local preview

```bash
npm install
npm run preview
```
Without Supabase keys the site runs in preview mode. On `localhost` only, the portal saves edits in your browser.

## Before launch

- Legal and compliance review of every policy. Fill in the `[bracketed]` details, then tick "Reviewed" in the portal.
- Contact details, branches, social and app links.
- Replace the sample news post, and delete or open the example job.
- Only switch on the financing calculator once the profit rate is approved.
- Upgrade Vercel to **Pro** (the Hobby plan is for non-commercial use) and Supabase to **Pro** (daily backups).
