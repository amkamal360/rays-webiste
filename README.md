# Rays Microfinance website

Public website and content portal for Rays Microfinance. Brand follows the Rays Brand Manual v1.0 (logo and "Ahead of the curve." artwork extracted as vectors from the manual; Rays Purple `#442580`, Rays Yellow `#FCC909`, Rays Black `#231F20`; Myriad Pro with Helvetica fallback).

## Built for phones on mobile data

Every page is prerendered to static HTML at build time, with its content already inside, so a phone gets a complete, readable page in the first response, even before JavaScript runs.

| First visit, home page | |
|---|---|
| Requests | 3 (HTML, logo, script) |
| Transferred | about 56 KB |
| Lighthouse mobile (slow 4G, mid-range phone) | 100 in all four categories on the home, financing, contact, careers and privacy pages |
| Largest contentful paint | about 1.4 s |
| Layout shift | 0 |

How it gets there:
- **Static HTML per page.** The build runs the same render code in Node and writes one HTML file per route, plus `sitemap.xml` and `robots.txt`.
- **No libraries on public pages.** The public script is about 10 KB gzipped. The CSS is inlined, so there's no render-blocking request.
- **The portal is separate.** `admin.js` and the Supabase client are downloaded only when someone opens `/admin`.
- **Content stays fresh without a rebuild.** After load, the page quietly checks Supabase and updates if an editor changed something. Visiting other pages needs no further downloads.
- **Uploaded photos are optimised.** Before upload, photos are resized in the browser to 1600 px WebP, with a 640 px thumbnail for cards, so a 5 MB phone photo becomes roughly 150–300 KB.
- **The hero animation is well behaved.** It runs once for about 10 s, pauses when off-screen or in a background tab, and caps pixel density on phones. It shows a still frame for reduced-motion and data-saver users.
- **Assets are cached.** Script filenames carry a content hash and are cached for a year; HTML always revalidates.
- **Off-screen rendering is skipped.** Sections below the fold use `content-visibility`.

## What's on the site

- **Seven sections from the sitemap:** Personal, Business, Financing, Payments, Infrastructure, Platforms and About, plus Media for news, videos and galleries.
- **Legal** (`/legal`), linked from every footer:
  - Privacy policy
  - Terms and conditions
  - Cookies and storage
  - Complaints and customer feedback
  - Security and fraud awareness
  - Anti-money laundering and KYC
  - Sharia compliance statement
  - Accessibility

  **These are drafts.** Legal and compliance must review each one and fill in every `[bracketed]` detail before launch. Each policy has a "Reviewed" tick in the portal so you can track progress.
- **Careers** (`/about/careers`): editors publish roles with a closing date. Candidates apply with a CV (PDF or Word, up to 5 MB) and must give consent before submitting. There's also an "open application" for people who don't see a matching role. CVs go to a private storage bucket that only portal editors can open, through links that expire after 5 minutes. Applications move through stages: new, in review, shortlisted, interview, offer, hired, not progressing.
- **Help and FAQs** (`/about/help`): searchable and grouped by category. The questions are also published as FAQ data for Google.
- **Branches and agents** (`/about/locations`): filter by town and type. Each location has call and directions buttons that open Google Maps, so there's no heavy embedded map on the page.
- **Downloads** (`/about/downloads`): forms, tariff guides, reports and brochures taken from the media library.
- **Financing calculator** on the eMurabaha and Murabaha pages. It's switched off until you set an indicative profit rate, approved by finance and your Sharia advisers.
- **Site search**: the search icon, or the `/` key. It searches pages, FAQs, policies, jobs and news instantly, with no server involved.
- **Announcement banner** for service notices or campaigns. Visitors can dismiss it.
- **Quick contact buttons** (call, free call, USSD, WhatsApp, Telegram, email), social media links and SahayPay app links. Each is set in the portal and hidden while empty.
- **Search engine details:** a sitemap, robots.txt, canonical links, social-share previews and organisation data for Google.
- **Installable** on a phone's home screen via the web manifest and app icons.

## Project layout

```
src/app.js          public site (render, routing, hydration, rain animation)
src/admin.js        portal (loaded on demand)
src/styles.css      all styles
assets/brand/       official logo, mark and tagline (SVG, from the brand manual)
public/             favicon, app icons, social image, web manifest
content.json        starter content (every section and page)
build.mjs           build: minify, fingerprint, prerender → dist/
supabase/schema.sql database, access rules and storage bucket
supabase/seed.sql   optional: load starter content with SQL
```

Run locally: `npm install && npm run preview`, then open the printed address. Without Supabase keys the site runs in preview mode, and portal edits are saved in your browser only.

## Deploy

### 1. Supabase
1. Create a project at supabase.com. The Frankfurt region is closest to Ethiopia among common options.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Under Authentication → Users, add each editor (email and password). Then run:
   `insert into public.admins (user_id) select id from auth.users where email = 'editor@raysfinance.com';`
4. Under Authentication → URL Configuration, set Site URL to `https://raysfinance.com`.
5. Load content: either run `supabase/seed.sql`, or sign in at `/admin` and choose **Load starter content**.

### 2. Vercel
1. Push this folder to a GitHub repository and import it in Vercel. The framework preset can be "Other"; `vercel.json` already sets the build command and the output directory (`dist`).
2. Under Settings → Environment Variables, add:
   - `SUPABASE_URL`: from Supabase → Project Settings → API
   - `SUPABASE_ANON_KEY`: the "anon public" key
   - `SITE_URL`: `https://raysfinance.com`
   - `ADOBE_FONTS_KIT`: optional, your Adobe Fonts project ID for Myriad Pro
3. Deploy.

### 3. Automatic rebuilds when content changes (recommended)
Pages already show edits within a second through the background refresh. A rebuild also bakes the edits into the static HTML, which search engines see and which is the fastest possible first paint.
1. Vercel → Settings → Git → Deploy Hooks: create a hook and copy its URL.
2. Supabase → Database → Webhooks: create a webhook on tables `site` and `posts` for insert, update and delete. Use type HTTP Request, method POST, with the deploy-hook URL.

### 4. Domain via Cloudflare DNS
1. Vercel → Settings → Domains: add `raysfinance.com` and `www.raysfinance.com`, and pick which one redirects to the other.
2. Cloudflare → DNS: add the records Vercel shows. Usually these are:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`
3. Set both records to **DNS only** (grey cloud). Vercel already serves from a global CDN and issues the SSL certificate. Proxying through Cloudflare as well adds a second hop and can block certificate renewal. If you do switch the proxy on, set Cloudflare SSL/TLS to **Full (strict)**.

## Protecting the forms from spam
The contact and application forms have a hidden spam trap, and the database limits field lengths and file types. Before a public launch, consider adding Cloudflare Turnstile. It's free and you already use Cloudflare. You'd send submissions through a small Supabase Edge Function that checks the Turnstile token first.

## Fonts
The manual requires Myriad Pro, a licensed Adobe font, so it isn't bundled. Create an Adobe Fonts web project containing Myriad Pro and set its display to "swap", then put the project ID in `ADOBE_FONTS_KIT`. Until then the site uses Helvetica, the manual's secondary typeface. Ethiopic text uses the phone's built-in font (Noto Sans Ethiopic on Android, Kefa on iPhone), so there's no extra download.
"# rays-webiste" 
