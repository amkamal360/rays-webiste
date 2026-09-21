"use strict";
/* Rays Microfinance — public site core.
   Kept small on purpose: no libraries. The editing portal lives in admin.js and is
   only downloaded when someone opens /admin.
   Backends: "supabase" (production, plain REST for public reads), "cloud" (claude.ai
   artifact), "local" (browser-only preview). */

const CFG = Object.assign({ supabaseUrl:"", supabaseAnonKey:"", adobeFontsKit:"", mediaBucket:"media", adminScript:"/assets/admin.js" },
  (()=>{ try{ return JSON.parse(document.getElementById("rays-config")?.textContent||"{}"); }catch(e){ return {}; } })(), window.RAYS_CONFIG||{});
const PRERENDER = !!window.__RAYS_PRERENDER;
const IS_ARTIFACT = !PRERENDER && !!(window.claude && typeof window.claude.use==="function");
const PATH_MODE = PRERENDER || (!IS_ARTIFACT && /^https?:$/.test(location.protocol));
const ASSET_BASE = PATH_MODE ? "/" : "";
const BRAND = Object.assign({
  logo: ASSET_BASE+"assets/brand/rays-logo.svg",
  tagline: ASSET_BASE+"assets/brand/rays-tagline.svg"
}, window.RAYS_ASSETS||{});
const SB_URL = (CFG.supabaseUrl||"").replace(/\/$/,"");
const USE_SB = !!(SB_URL && CFG.supabaseAnonKey) && !IS_ARTIFACT;

/* ================= state ================= */
const S = { mode:"loading", loaded:false, site:null, posts:[], media:[], inquiries:[], applications:[], canEdit:false, maybeEditor:false,
  db:null, assets:null, user:null, sb:null, session:null, inbox:null,
  draft:null, dirty:false, postDraft:null, postDirty:false, pickFor:null, openDrop:null, mediaFilter:"all" };
const LS = { get(k){try{return JSON.parse(localStorage.getItem("rays:"+k))}catch(e){return null}}, set(k,v){try{localStorage.setItem("rays:"+k,JSON.stringify(v));return true}catch(e){return false}} };

const $ = (s,r=document)=>r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const safeHref = h => { h=String(h||""); return /^(#|\/|https?:|mailto:|tel:)/i.test(h) ? h : "#/"; };
const fmtDate = d => { try{ return new Date(d).toLocaleDateString("en-GB",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}) }catch(e){ return "" } };
const slug = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||uid();

function blobUrl(id){
  if(!id) return "";
  const m = S.media.find(x=>x.id===id); if(m && m.localUrl) return m.localUrl;
  if(S.mode==="supabase" || PRERENDER) return SB_URL+"/storage/v1/object/public/"+CFG.mediaBucket+"/"+encodeURIComponent(id);
  return "/_blob/"+id;
}
const thumbOf = (p,id) => (p && p.thumbs && p.thumbs[id]) || id;
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.setAttribute("role","status"); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }
function rich(text, hl=3){
  const block = b => {
    const lines=b.split("\n");
    if(/^##\s/.test(lines[0])) return `<h${hl}>`+esc(lines[0].replace(/^##\s/,""))+`</h${hl}>`+(lines.length>1?block(lines.slice(1).join("\n")):"");
    const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
    if(lines.every(l=>/^\s*[-*]\s+/.test(l))) return "<ul>"+lines.map(l=>"<li>"+inl(l.replace(/^\s*[-*]\s+/,""))+"</li>").join("")+"</ul>";
    if(lines.every(l=>/^\s*\d+[.)]\s+/.test(l))) return "<ol>"+lines.map(l=>"<li>"+inl(l.replace(/^\s*\d+[.)]\s+/,""))+"</li>").join("")+"</ol>";
    return "<p>"+lines.map(inl).join("<br>")+"</p>";
  };
  return String(text||"").trim().split(/\n\s*\n/).filter(Boolean).map(block).join("");
}

/* ================= routing ================= */
let PRE_PATH="/";
const curPath = () => PRERENDER ? PRE_PATH : PATH_MODE ? location.pathname.replace(/\/+$/,"")||"/" : (location.hash.replace(/^#/,"")||"/");
const route = () => curPath().split("/").filter(Boolean);
function nav(to, replace){
  to = to.replace(/^#/,""); if(!to.startsWith("/")) to="/"+to;
  if(PATH_MODE){ history[replace?"replaceState":"pushState"]({}, "", to); onRoute(); }
  else location.hash = "#"+to;
}
function onRoute(){ S.openDrop=null; S.pickFor=null; document.body.style.overflow=""; window.RaysAdmin?.onRoute?.(); render(true); }

/* ================= public data ================= */
async function sbRest(path, opts={}){
  const r = await fetch(SB_URL+"/rest/v1/"+path, { ...opts, headers:{ apikey:CFG.supabaseAnonKey, Authorization:"Bearer "+CFG.supabaseAnonKey, "Content-Type":"application/json", ...(opts.headers||{}) } });
  if(!r.ok){ const e=new Error("HTTP "+r.status); e.status=r.status; throw e; }
  return (r.status===201||r.status===204) ? null : r.json();
}
const mapPost = r => ({...(r.data||{}), id:r.id, published:r.published, date:r.date});
async function fetchPublic(){
  const [site,posts] = await Promise.all([
    sbRest("site?id=eq.content&select=data"),
    sbRest("posts?select=id,data,published,date&published=eq.true&order=date.desc&limit=60")
  ]);
  return { site: site?.[0]?.data || null, posts: (posts||[]).map(mapPost) };
}

/* ================= boot ================= */
function embedded(){ const el=document.getElementById("rays-data"); if(!el) return null; try{ return JSON.parse(el.textContent); }catch(e){ return null; } }
function sameData(a,b){ try{ return JSON.stringify(a)===JSON.stringify(b); }catch(e){ return false; } }

async function boot(){
  if(CFG.adobeFontsKit){ const l=document.createElement("link"); l.rel="stylesheet"; l.href="https://use.typekit.net/"+encodeURIComponent(CFG.adobeFontsKit)+".css"; document.head.appendChild(l); }
  if(USE_SB) return bootSupabase();
  let db=null, assets=null, user=null;
  if(IS_ARTIFACT){ try{ [db,assets,user] = await Promise.all([claude.use("db"),claude.use("assets"),claude.use("user")]); }catch(e){} }
  if(db) return bootCloud(db,assets,user);
  S.mode="local"; S.canEdit=true;
  const pre=embedded(), ls=LS.get("site"); S.site = ls || pre?.site || null; S.posts = LS.get("posts") || pre?.posts || []; S.media = LS.get("media")||[]; S.inquiries = LS.get("inquiries")||[];
  S.loaded=true; if(ls || !hydrate()) render(false);
}

async function bootSupabase(){
  S.mode="supabase";
  try{ S.maybeEditor = Object.keys(localStorage).some(k=>/^sb-.+-auth-token$/.test(k)); }catch(e){}
  // 1) Instant: the page ships with its own content, or we have a cached copy.
  const pre = embedded() || LS.get("public");
  if(pre?.site){ S.site=pre.site; S.posts=pre.posts||[]; S.loaded=true; if(!(embedded() && hydrate())) render(false); }
  // 2) Revalidate in the background so edits show up without a rebuild.
  try{
    const fresh = await fetchPublic();
    LS.set("public", fresh);
    const changed = !sameData(lite(fresh.site),lite(S.site)) || !sameData(fresh.posts, S.posts.filter(p=>p.published));
    if(changed && !curPath().startsWith("/admin")){ S.site=fresh.site; S.posts=fresh.posts; S.loaded=true; render(false); }
    else if(!changed){ S.site=fresh.site; if(route()[0]==="legal" && $(".policy .muted")) render(false); }
    else if(!S.loaded){ S.site=fresh.site; S.posts=fresh.posts; S.loaded=true; render(false); }
  }catch(e){
    if(!S.loaded){ S.loaded=true; S.loadError="Content couldn't be loaded. Check your connection and refresh."; render(false); }
  }
}

const canRerender = () => !(curPath().startsWith("/admin") && (S.dirty || S.postDirty || document.activeElement?.matches?.("input,textarea,select")));
async function bootCloud(db,assets,user){
  S.mode="cloud"; S.db=db; S.assets=assets; S.user=user;
  let can=false; try{ can = user ? await user.canEdit() : false; }catch(e){}
  S.canEdit = !!(can && assets);
  db.doc("site/content").onSnapshot(snap=>{ S.site = snap.exists ? snap.data() : null; S.loaded=true; if(canRerender()) render(false); }, ()=>{});
  db.collection("posts").orderBy("date","desc").onSnapshot(q=>{ S.posts=q.docs.map(d=>({id:d.id,...d.data()})); if(canRerender()) render(false); }, ()=>{});
}

async function addInquiry(q){
  if(S.mode==="supabase"){ await sbRest("inquiries",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({name:q.name,reach:q.reach,audience:q.audience,message:q.message})}); return; }
  if(S.mode==="cloud"){ const me = S.user ? await S.user.id() : null; if(!me) throw new Error("no-id");
    const ref=S.db.doc("inquiries/"+me); const cur=await ref.get(); const msgs=(cur.exists?cur.data().messages:[])||[];
    return ref.set({messages:[...msgs.slice(-49),{...q,key:uid()}]}); }
  S.inquiries.unshift({id:uid(),...q}); LS.set("inquiries",S.inquiries);
}

/* ================= content helpers ================= */
const site = () => S.site;
function findPage(secId,pageId,depth=0){
  const sec = site()?.sections?.find(s=>s.id===secId); if(!sec) return null;
  const pg = sec.pages.find(p=>p.id===pageId); if(!pg) return null;
  if(pg.ref && depth<3){ const [a,b]=pg.ref.split("/"); const t=findPage(a,b,depth+1); if(t) return {...t, sec, page:{...t.page, title:pg.title||t.page.title}, canonical:pg.ref}; }
  return {sec,page:pg};
}
const pageHref = (s,p) => "#/"+s+"/"+p;
const published = () => S.posts.filter(p=>p.published);
const KINDS = {article:"News",video:"Video",gallery:"Gallery"};

/* ================= brand graphics ================= */
const logoImg = (eager) => `<img src="${esc(BRAND.logo)}" alt="Rays MicroFinance Institution" width="146" height="60" ${eager?'fetchpriority="high"':'loading="lazy"'} decoding="async">`;
// Brand S-curve: window bounded by the S on the left and a circle on the right, lavender band with a tapered tail.
const CURVE_WINDOW = "M300 20C330 120 280 190 210 270C150 340 90 400 100 450C110 490 170 507 250 505C400 500 495 400 495 265C495 140 420 40 300 20Z";
const CURVE_BAND = "M300 20C330 120 280 190 210 270C150 340 90 400 100 450C110 490 170 507 250 505C300 504 340 498 372 488C332 515 292 523 250 523C160 525 76 500 76 450C72 388 135 322 195 253C262 176 308 112 285 40C272 6 205 12 155 45C105 80 62 140 36 205C78 128 140 55 212 26C250 12 288 8 300 20Z";

/* ================= public views ================= */
function header(){
  const secs = site()?.sections||[];
  const portal = S.canEdit || S.maybeEditor;
  return `${announcement()}<div class="brandbar" aria-hidden="true"></div><header class="site"><div class="wrap bar">
    <a class="logo" href="#/" aria-label="Rays home">${logoImg(true)}</a>
    <nav class="main" aria-label="Main">${secs.map(s=>`<div>
      <button class="top" aria-expanded="${S.openDrop===s.id}" aria-controls="drop-${esc(s.id)}" data-drop="${esc(s.id)}">${esc(s.title)}</button>
      <div class="drop${S.openDrop===s.id?" open":""}" id="drop-${esc(s.id)}"><p>${esc(s.intro)}</p>${s.pages.map(p=>`<a href="${pageHref(s.id,p.id)}">${esc(p.title)}</a>`).join("")}</div></div>`).join("")}
      <div><a class="top" href="#/media">Media</a></div>
    </nav>
    <div class="tools">
      <button class="iconbtn2" data-act="search" aria-label="Search the site"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
      <a class="btn small cta" href="#/about/contact">Open an account</a>
      ${portal?`<a class="btn small ghost portal" href="#/admin">Portal</a>`:""}
    </div>
    <button class="menu-btn" data-act="drawer" aria-label="Open menu" aria-controls="drawer" aria-expanded="false"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div></header>
  <div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="drawer-top"><a class="logo" href="#/">${logoImg()}</a><button class="btn small ghost" data-act="drawer-close">Close</button></div>
    ${secs.map(s=>`<details><summary>${esc(s.title)}</summary>${s.pages.map(p=>`<a href="${pageHref(s.id,p.id)}">${esc(p.title)}</a>`).join("")}</details>`).join("")}
    <details><summary>Media</summary><a href="#/media">All posts</a><a href="#/media/video">Videos</a></details>
    <details><summary>Legal</summary>${pubPolicies().map(p=>`<a href="#/legal/${esc(p.id)}">${esc(p.title)}</a>`).join("")}</details>
    <p style="margin-top:22px"><a class="btn block-btn" href="#/about/contact">Open an account</a></p>
  </div>
  <div class="search" id="search" role="dialog" aria-modal="true" aria-label="Search" hidden><div class="wrap">
    <div class="searchbar"><label class="visually-hidden" for="searchq">Search Rays</label><input type="search" id="searchq" placeholder="Search accounts, financing, help, policies…" autocomplete="off" enterkeyhint="search"><button class="btn small ghost" data-act="search-close">Close</button></div>
    <div id="searchres" class="searchres"></div></div></div>`;
}

function footer(){
  const s=site(); const secs=s.sections||[]; const pick = id=>secs.find(x=>x.id===id);
  const col = (id,title)=>{const x=pick(id); if(!x) return ""; return `<div><h2 class="fh">${esc(title||x.title)}</h2><ul>${x.pages.map(p=>`<li><a href="${pageHref(x.id,p.id)}">${esc(p.title)}</a></li>`).join("")}</ul></div>`};
  const c=s.contact||{};
  return `<footer class="site"><div class="wrap">
    <div class="fgrid">
      <div><a class="logo" href="#/" aria-label="Rays home">${logoImg()}</a>
        <p class="fdesc">${esc(s.brand?.tagline)}</p>
        <p class="fdesc">${[c.address,c.phone,c.email].filter(Boolean).map(esc).join("<br>")}</p></div>
      ${col("personal")}${col("financing")}${col("platforms")}${col("about","Company")}
    </div>
    ${footerExtras()}
    <div class="fbase"><span>© ${new Date().getFullYear()} ${esc(s.brand?.name)}. All rights reserved.${s.brand?.domain?` · ${esc(s.brand.domain)}`:""}</span>
      <span class="langs" aria-label="Languages">${(s.languages||[]).map(l=>`<span>${esc(l)}</span>`).join("")}</span></div>
  </div></footer>`;
}

function footerExtras(){
  const s=site(), so=s.social||{}, ap=s.apps||{};
  const names={facebook:"Facebook",telegram:"Telegram",linkedin:"LinkedIn",x:"X",youtube:"YouTube",tiktok:"TikTok",instagram:"Instagram"};
  const socials=Object.entries(names).filter(([k])=>so[k]).map(([k,v])=>extLink(k==="telegram"?tgHref(so[k]):so[k],v));
  const apps=[ap.android&&extLink(ap.android,"SahayPay for Android"), ap.ios&&extLink(ap.ios,"SahayPay for iPhone")].filter(Boolean);
  return `<div class="frow">
    <nav aria-label="Legal"><h2 class="fh">Legal</h2><ul class="inline">${pubPolicies().map(p=>`<li><a href="#/legal/${esc(p.id)}">${esc(p.title)}</a></li>`).join("")}</ul></nav>
    ${socials.length?`<div><h2 class="fh">Follow us</h2><ul class="inline">${socials.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:""}
    ${apps.length?`<div><h2 class="fh">Get the app</h2><ul class="inline">${apps.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:""}
  </div>`;
}

function viewHome(){
  const s=site(), h=s.home||{}, fin=findPage("financing","emurabaha");
  const motto = (s.brand?.motto||"").split(/(?<=\.)\s+/).filter(Boolean);
  const links=["#/personal/accounts","#/financing/emurabaha","#/infrastructure/build"];
  const latest = published().slice(0,3);
  return `<section class="hero"><div class="wrap">
      <div class="hero-copy">
        <h1>${motto.map((m,i)=>`<a href="${links[i]||"#/"}">${esc(m)}</a>`).join("")}</h1>
        <p class="lead">${esc(h.lead)}</p>
        <div class="ctas"><a class="btn yellow" href="#/about/contact">Open an account</a><a class="btn ghost-light" href="#/financing/emurabaha">Explore financing</a><a class="btn ghost-light" href="#/infrastructure/build">Build with Rays</a></div>
      </div>
      <div class="curvewrap"><figure class="curve">
        <div class="window"><canvas id="rain" aria-hidden="true"></canvas></div>
        <svg class="band" viewBox="0 0 500 530" preserveAspectRatio="none" aria-hidden="true"><path d="${CURVE_BAND}" fill="#DCD6EA"/></svg>
      </figure>
      <p class="curvecap">${esc(s.brand?.meaning)}</p></div>
    </div></section>

  <section class="block"><div class="wrap">
    <div class="split"><h2>One institution. Three capabilities.</h2><div class="prose">${rich(h.storyText)}</div></div>
    <div class="caps">${(h.capabilities||[]).map(c=>`<a href="${esc(safeHref(c.href))}"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><span>Learn more</span></a>`).join("")}</div>
  </div></section>

  ${fin?`<section class="block band"><div class="wrap">
    <div class="split"><div><h2>${esc(fin.page.title)}: ${esc(fin.page.lead)}</h2></div><div><p>${esc(fin.page.body)}</p><a class="btn" href="#/financing/emurabaha">How eMurabaha works</a></div></div>
    ${fin.page.steps?`<ol class="steps">${fin.page.steps.map(x=>`<li><b>${esc(x.title)}</b><span>${esc(x.text)}</span></li>`).join("")}</ol>`:""}
  </div></section>`:""}

  <section class="block"><div class="wrap split">
    <div><h2>${esc(h.connectivityTitle)}</h2></div>
    <div><p>${esc(h.connectivityText)}</p><ul class="chips">${(h.connectivity||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
  </div></section>

  <section class="block" style="padding-top:0"><div class="wrap"><div class="wallet">
    <div><h2>${esc(h.walletTitle)}</h2><p style="margin-top:16px">${esc(h.walletText)}</p>
      <div class="btnrow"><a class="btn yellow" href="#/platforms/sahaypay">Meet SahayPay</a><a class="btn ghost-light" href="#/infrastructure/white-label">White-label it</a></div></div>
    <div><div class="big">5M+</div><p>registered wallet customers on SahayPay deployments</p></div>
  </div></div></section>

  <section class="block cream inhouse"><div class="wrap">
    <div class="split"><h2>${esc(h.inhouseTitle)}</h2><div><p>${esc(h.inhouseText)}</p><ul class="chips">${(h.inhouseList||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><p style="margin-top:22px"><a class="btn" href="#/platforms/finsharia">About FinSharia</a></p></div></div>
  </div></section>

  <section class="block"><div class="wrap">
    <h2>Built for Ethiopia's financial ecosystem</h2>
    <div class="stats">${(s.stats||[]).map(x=>`<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>
  </div></section>

  ${latest.length?`<section class="block band"><div class="wrap">
    <div class="rowhead"><h2>News and media</h2><a href="#/media">See all posts</a></div>
    <div class="posts">${latest.map(postCard).join("")}</div>
  </div></section>`:""}

  <section class="block"><div class="wrap">
    <h2>Let's build what comes next.</h2>
    <div class="aud">
      <a href="#/personal/accounts"><b>Individuals</b><span>Open an account or explore financial services.</span></a>
      <a href="#/business/accounts"><b>Businesses</b><span>Accounts, payments and financing.</span></a>
      <a href="#/infrastructure/institutions"><b>Financial institutions</b><span>White-label platforms and connectivity.</span></a>
      <a href="#/infrastructure/developers"><b>Fintechs and developers</b><span>APIs, integrations and building on Rays.</span></a>
    </div>
  </div></section>
  <div class="tagline"><img src="${esc(BRAND.tagline)}" alt="${esc(s.brand?.tagline2||"Ahead of the curve.")}" width="420" height="122" loading="lazy" decoding="async"></div>`;
}

function postCard(p){
  const t = p.coverId ? thumbOf(p,p.coverId) : "";
  const cover = t ? `<img src="${esc(blobUrl(t))}" alt="" loading="lazy" decoding="async" width="640" height="400">` : "";
  return `<a class="post" href="#/media/post/${esc(p.id)}"><div class="thumb${cover?"":" empty"}">${cover}<span class="kind">${esc(KINDS[p.kind]||"News")}</span></div>
    <time>${esc(fmtDate(p.date))}</time><h3>${esc(p.title)}</h3>${p.excerpt?`<p class="muted excerpt">${esc(p.excerpt)}</p>`:""}</a>`;
}

function viewPage(secId,pageId){
  const f = findPage(secId,pageId); if(!f) return viewNotFound();
  const {page} = f; const own = site().sections.find(s=>s.id===secId);
  return `<section class="pagehead"><div class="wrap">
    <div class="crumb"><a href="#/">Rays</a> / ${esc(own.title)}</div>
    <h1>${esc(page.title)}</h1>${page.lead?`<p class="lead">${esc(page.lead)}</p>`:""}
    <nav class="subnav" aria-label="${esc(own.title)}">${own.pages.map(p=>`<a href="${pageHref(own.id,p.id)}" ${p.id===pageId?'aria-current="page"':""}>${esc(p.title)}</a>`).join("")}</nav>
  </div></section>
  <section class="block pagebody"><div class="wrap">
    <div class="prose">${rich(page.body)}</div>
    ${page.steps?.length?`<ol class="steps">${page.steps.map(x=>`<li><b>${esc(x.title)}</b><span>${esc(x.text)}</span></li>`).join("")}</ol>`:""}
    ${page.features?.length?`<div class="feat">${page.features.map(x=>`<div><h2>${esc(x.title)}</h2><p>${esc(x.text)}</p></div>`).join("")}</div>`:""}
    ${page.list?.length?`<ul class="twocol">${page.list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    ${page.calculator?calculatorBlock():""}
    ${page.kind==="contact"?contactForm():page.kind==="faq"?faqBlock():page.kind==="locations"?locationsBlock():page.kind==="downloads"?downloadsBlock():page.kind==="careers"?careersBlock():""}
    ${page.cta?.label?`<div class="cta-row"><a class="btn" href="${esc(safeHref(page.cta.href))}">${esc(page.cta.label)}</a></div>`:""}
  </div></section>`;
}

function contactForm(){
  const c=site().contact||{};
  return `<div class="split" style="margin-top:36px">
    <div>${channels()}${c.address||c.hours?`<div class="feat" style="margin-top:18px;grid-template-columns:1fr">
      ${c.address?`<div><h2>Visit</h2><p>${esc(c.address)}</p><p><a href="#/about/locations">Find a branch or agent</a></p></div>`:""}${c.hours?`<div><h2>Hours</h2><p>${esc(c.hours)}</p></div>`:""}</div>`:""}
      <p class="muted small" style="margin-top:18px">Something wrong? See how we handle <a href="#/legal/complaints">complaints</a>. Worried about fraud? Read our <a href="#/legal/security">security guidance</a>.</p></div>
    <form id="contact" novalidate>
      <div class="formgrid"><label class="f"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label>
      <label class="f"><span>Phone or email</span><input type="text" name="reach" required autocomplete="tel" inputmode="tel"></label></div>
      <label class="f"><span>I'm contacting Rays as</span><select name="audience"><option>An individual</option><option>A business or MSME</option><option>A financial institution</option><option>A fintech or developer</option><option>A job applicant</option><option>Media</option></select></label>
      <label class="f"><span>How can we help?</span><textarea name="message" required maxlength="4000"></textarea></label>
      <label class="hp" aria-hidden="true">Leave empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <p id="contact-msg" role="status" class="muted"></p>
      <button class="btn" type="submit">Send message</button>
    </form></div>`;
}

function viewMedia(filter){
  const all = published(); const list = filter ? all.filter(p=>p.kind===filter) : all;
  return `<section class="pagehead"><div class="wrap" style="padding-bottom:36px"><div class="crumb"><a href="#/">Rays</a> / Media</div><h1>News and media</h1>
    <p class="lead">Announcements, stories, videos and photos from Rays.</p></div></section>
    <section class="block pagebody"><div class="wrap">
    <nav class="tabs" aria-label="Filter"><a href="#/media" ${!filter?'aria-current="page"':""}>All</a>${Object.entries(KINDS).map(([k,v])=>`<a href="#/media/${k}" ${filter===k?'aria-current="page"':""}>${v}</a>`).join("")}</nav>
    ${list.length?`<div class="posts">${list.map(postCard).join("")}</div>`:`<div class="empty">Nothing published here yet.</div>`}</div></section>`;
}

function viewPost(id){
  const p = S.posts.find(x=>x.id===id && (x.published||S.canEdit)); if(!p) return viewNotFound();
  const gallery = (p.mediaIds||[]).filter(Boolean);
  const coverFull = p.coverId ? blobUrl(p.coverId) : "";
  return `<section class="block"><div class="wrap"><article class="article">
    <div class="crumb dark"><a href="#/media">Media</a> / ${esc(KINDS[p.kind]||"News")}</div>
    <time class="muted">${esc(fmtDate(p.date))}</time>${!p.published?` <span class="pill draft">Draft</span>`:""}
    <h1>${esc(p.title)}</h1>${p.excerpt?`<p class="lead">${esc(p.excerpt)}</p>`:""}
    ${p.videoId?`<video class="cover" controls playsinline preload="none" ${p.coverId?`poster="${esc(coverFull)}"`:""} src="${esc(blobUrl(p.videoId))}"></video>`:coverFull?`<img class="cover" src="${esc(coverFull)}" alt="" decoding="async" ${p.coverW?`width="${+p.coverW}" height="${+p.coverH}"`:""}>`:""}
    <div class="prose">${rich(p.body)}</div>
    ${gallery.length?`<div class="gallery">${gallery.map(g=>`<a href="${esc(blobUrl(g))}" target="_blank" rel="noopener"><img src="${esc(blobUrl(thumbOf(p,g)))}" alt="" loading="lazy" decoding="async" width="320" height="320"></a>`).join("")}</div>`:""}
    <p style="margin-top:32px"><a href="#/media">Back to all posts</a></p>
  </article></div></section>`;
}

const viewNotFound = () => `<section class="block"><div class="wrap"><h1 class="nf">This page doesn't exist.</h1><p class="lead" style="margin-top:14px">It may have been renamed or removed. <a href="#/">Go to the home page</a>.</p></div></section>`;
function viewEmptySite(){
  return `<div class="wrap" style="padding:80px 0">${logoImg(true)}<p class="lead" style="margin-top:24px">${esc(S.loadError||"The site has no content yet.")}</p>
    ${S.canEdit?`<p><a class="btn" href="#/admin">Open the portal</a></p>`:S.mode==="supabase"?`<p><a class="btn ghost" href="#/admin">Editor sign-in</a></p>`:`<p class="muted">Check back soon.</p>`}</div>`;
}

/* ================= extras: policies, careers, help, branches, downloads, calculator, search ================= */
const today = () => new Date().toISOString().slice(0,10);
const openJobs = () => (site()?.jobs||[]).filter(j=>j.status==="open" && (!j.closes || j.closes >= today()));
const pubPolicies = () => (site()?.policies||[]).filter(p=>p.published!==false);
const lite = s => s && ({...s, policies:(s.policies||[]).map(({body,...p})=>p)});
const mapsLink = b => "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(b.lat&&b.lng ? b.lat+","+b.lng : [b.name,b.address,b.city,"Ethiopia"].filter(Boolean).join(", "));
const telHref = n => "tel:"+String(n).replace(/[^\d+]/g,"");
const ussdHref = c => "tel:"+String(c).replace(/[^\d*#]/g,"").replace(/#/g,"%23");
const waHref = n => "https://wa.me/"+String(n).replace(/\D/g,"");
const tgHref = h => /^https?:/.test(h) ? h : "https://t.me/"+String(h).replace(/^@/,"");
const extLink = (href,label) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const fmtETB = n => "ETB "+Math.round(n).toLocaleString("en-US");

function announcement(){
  const a=site()?.announcement; if(!a?.active || !a.text) return "";
  return `<div class="announce" id="announce" data-text="${esc(a.text)}"><div class="wrap"><p>${esc(a.text)}${a.link?` <a href="${esc(safeHref(a.link))}">Learn more</a>`:""}</p><button class="announce-x" data-act="ann-close" aria-label="Dismiss announcement">×</button></div></div>`;
}
function channels(){
  const c=site()?.contact||{}; const b=[];
  if(c.phone) b.push(`<a class="chan" href="${telHref(c.phone)}"><b>Call</b><span>${esc(c.phone)}</span></a>`);
  if(c.tollfree) b.push(`<a class="chan" href="${telHref(c.tollfree)}"><b>Free call</b><span>${esc(c.tollfree)}</span></a>`);
  if(c.ussd) b.push(`<a class="chan" href="${ussdHref(c.ussd)}"><b>USSD</b><span>Dial ${esc(c.ussd)}</span></a>`);
  if(c.whatsapp) b.push(`<a class="chan" href="${esc(waHref(c.whatsapp))}" target="_blank" rel="noopener"><b>WhatsApp</b><span>${esc(c.whatsapp)}</span></a>`);
  if(c.telegram) b.push(`<a class="chan" href="${esc(tgHref(c.telegram))}" target="_blank" rel="noopener"><b>Telegram</b><span>${esc(c.telegram)}</span></a>`);
  if(c.email) b.push(`<a class="chan" href="mailto:${esc(c.email)}"><b>Email</b><span>${esc(c.email)}</span></a>`);
  return b.length ? `<div class="chans">${b.join("")}</div>` : "";
}

function calculatorBlock(){
  const c=site()?.calculator; if(!c?.enabled || !(+c.profitRate>0)) return "";
  const min=+c.minMonths||3, max=+c.maxMonths||36, def=Math.min(max,Math.max(min,12));
  return `<section class="calc" aria-labelledby="calc-h"><h2 id="calc-h">Estimate your instalments</h2>
    <div class="calc-grid"><div>
      <label class="f"><span>Price of the item (ETB)</span><input type="text" inputmode="numeric" data-calc="price" value="100000"></label>
      <label class="f"><span>Your down payment (ETB)</span><input type="text" inputmode="numeric" data-calc="down" value="20000"></label>
      <label class="f"><span>Repayment period: <output id="calc-m">${def}</output> months</span><input type="range" data-calc="months" min="${min}" max="${max}" step="1" value="${def}"></label>
      <p class="muted small">Indicative profit rate: ${esc(c.profitRate)}% per year</p>
    </div><div class="calc-out" aria-live="polite">
      <div><span>Monthly instalment</span><b id="calc-inst">–</b></div>
      <div><span>Amount financed</span><b id="calc-fin">–</b></div>
      <div><span>Total profit</span><b id="calc-profit">–</b></div>
      <div><span>Total you repay</span><b id="calc-total">–</b></div>
    </div></div>
    <p class="muted small">${esc(c.note)}</p></section>`;
}
function runCalc(){
  const c=site()?.calculator; if(!c) return;
  const num = k => Math.max(0, parseFloat(String($(`[data-calc=${k}]`)?.value||"0").replace(/[^\d.]/g,""))||0);
  const price=num("price"), down=Math.min(num("down"),price), months=Math.max(1,num("months"));
  const fin=price-down, profit=fin*(+c.profitRate/100)*(months/12), total=fin+profit;
  const set=(id,v)=>{ const el=$("#"+id); if(el) el.textContent=v; };
  set("calc-m",months); set("calc-fin",fmtETB(fin)); set("calc-profit",fmtETB(profit)); set("calc-total",fmtETB(total)); set("calc-inst",fin>0?fmtETB(total/months):"–");
}

function faqBlock(){
  const faqs=site()?.faqs||[]; if(!faqs.length) return `<div class="empty">No questions have been added yet.</div>`;
  const cats=[...new Set(faqs.map(f=>f.category||"General"))];
  return `<div class="faq"><label class="f"><span>Search the questions</span><input type="search" id="faqq" placeholder="For example: account, SahayPay, complaint" autocomplete="off"></label>
    ${cats.map(cat=>`<div class="faqcat"><h2 class="sub">${esc(cat)}</h2>${faqs.filter(f=>(f.category||"General")===cat).map(f=>`<details class="qa"><summary>${esc(f.q)}</summary><div class="prose">${rich(f.a)}</div></details>`).join("")}</div>`).join("")}
    <p id="faqnone" class="muted" hidden>No questions match. Try another word, or <a href="#/about/contact">ask us directly</a>.</p></div>`;
}
function locationsBlock(){
  const list=site()?.branches||[];
  if(!list.length) return `<div class="empty">The branch and agent list is being updated. Call us or visit any Rays branch in the meantime.</div>`;
  const cities=[...new Set(list.map(b=>b.city).filter(Boolean))].sort();
  const T={branch:"Branch",agent:"Agent",atm:"ATM",merchant:"Merchant"};
  return `<div class="locfilters formgrid">
      <label class="f"><span>City or town</span><select id="loccity"><option value="">All locations</option>${cities.map(c=>`<option>${esc(c)}</option>`).join("")}</select></label>
      <label class="f"><span>Type</span><select id="loctype"><option value="">Branches, agents and ATMs</option>${Object.entries(T).map(([k,v])=>`<option value="${k}">${v}s</option>`).join("")}</select></label></div>
    <p class="muted small" id="loccount">${list.length} locations</p>
    <div class="locs">${list.map(b=>`<article class="loc" data-city="${esc(b.city)}" data-type="${esc(b.type||"branch")}">
      <span class="pill">${esc(T[b.type]||"Branch")}</span><h2>${esc(b.name)}</h2>
      <p>${esc([b.address,b.city,b.region].filter(Boolean).join(", "))}</p>${b.hours?`<p class="muted small">${esc(b.hours)}</p>`:""}
      <p class="btnrow">${b.phone?`<a class="btn small ghost" href="${telHref(b.phone)}">Call</a>`:""}<a class="btn small ghost" href="${esc(mapsLink(b))}" target="_blank" rel="noopener">Directions</a></p></article>`).join("")}</div>`;
}
function downloadsBlock(){
  const list=(site()?.downloads||[]).filter(d=>d.mediaId);
  if(!list.length) return `<div class="empty">No documents have been published yet.</div>`;
  const cats=[...new Set(list.map(d=>d.category||"Documents"))];
  return cats.map(cat=>`<h2 class="sub">${esc(cat)}</h2><ul class="dl">${list.filter(d=>(d.category||"Documents")===cat).map(d=>`<li><a href="${esc(blobUrl(d.mediaId))}" target="_blank" rel="noopener" download><b>${esc(d.title)}</b><span>${esc(d.format||"PDF")}${d.size?` · ${esc(d.size)}`:""}</span></a></li>`).join("")}</ul>`).join("");
}
function careersBlock(){
  const jobs=openJobs();
  return `<h2 class="sub">Open roles</h2>${jobs.length?`<div class="jobs">${jobs.map(j=>`<a class="job" href="#/about/careers/${esc(j.id)}"><h3>${esc(j.title)}</h3><p class="muted">${esc([j.department,j.location,j.type].filter(Boolean).join(" · "))}</p>${j.summary?`<p>${esc(j.summary)}</p>`:""}${j.closes?`<p class="muted small">Apply by ${esc(fmtDate(j.closes))}</p>`:""}</a>`).join("")}</div>`
    :`<div class="empty">There are no open roles right now.</div>`}
    <p style="margin-top:22px">Don't see a role that fits? <a href="#/about/careers/open">Send us an open application</a>.</p>`;
}
function viewJob(id){
  const job = id==="open" ? {id:"open",title:"Open application",summary:"Tell us about yourself and the kind of work you're looking for. We'll keep your details on file and contact you when a suitable role opens."} : (site()?.jobs||[]).find(j=>j.id===id && (j.status==="open"||S.canEdit));
  if(!job) return `<section class="block"><div class="wrap"><h1 class="nf">This role is no longer open.</h1><p class="lead" style="margin-top:14px"><a href="#/about/careers">See current openings</a>.</p></div></section>`;
  const closed = job.closes && job.closes < today();
  return `<section class="pagehead"><div class="wrap" style="padding-bottom:36px"><div class="crumb"><a href="#/about/careers">Careers</a></div>
    <h1>${esc(job.title)}</h1><p class="lead">${esc([job.department,job.location,job.type].filter(Boolean).join(" · ")||job.summary||"")}</p></div></section>
    <section class="block pagebody"><div class="wrap split">
      <div class="prose">${job.id!=="open"&&job.summary?`<p><b>${esc(job.summary)}</b></p>`:""}${rich(job.body)}${job.closes?`<p class="muted">Applications close on ${esc(fmtDate(job.closes))}.</p>`:""}</div>
      <div>${closed?`<div class="empty">Applications for this role have closed.</div>`:applyForm(job)}</div>
    </div></section>`;
}
function applyForm(job){
  const cvLink = S.mode==="cloud";
  return `<form id="apply" class="panel" novalidate data-job="${esc(job.id)}" data-title="${esc(job.title)}"><h2 class="sub" style="margin-top:0">Apply${job.id==="open"?"":" for this role"}</h2>
    <label class="f"><span>Full name</span><input type="text" name="name" required autocomplete="name"></label>
    <div class="formgrid"><label class="f"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
    <label class="f"><span>Phone</span><input type="tel" name="phone" required autocomplete="tel"></label></div>
    ${cvLink?`<label class="f"><span>Link to your CV</span><input type="text" name="cvlink" placeholder="Google Drive, Dropbox or LinkedIn link" required></label>`
      :`<label class="f"><span>CV (PDF or Word, up to 5 MB)</span><input type="file" name="cv" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label>`}
    <label class="f"><span>Why you'd like to join Rays <small class="muted">(optional)</small></span><textarea name="message" maxlength="3000"></textarea></label>
    <label class="check"><input type="checkbox" name="consent" required> I agree that Rays may use my details to assess my application, as described in the <a href="#/legal/privacy" target="_blank">privacy policy</a>.</label>
    <label class="hp" aria-hidden="true">Leave empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
    <p id="apply-msg" role="status" class="muted"></p>
    <button class="btn" type="submit">Submit application</button></form>`;
}
async function submitApply(e){
  e.preventDefault(); const f=e.target, fd=new FormData(f), msg=$("#apply-msg");
  if(fd.get("website")) return;
  const q={ jobId:f.dataset.job, jobTitle:f.dataset.title, name:(fd.get("name")||"").trim().slice(0,120), email:(fd.get("email")||"").trim().slice(0,160), phone:(fd.get("phone")||"").trim().slice(0,40), message:(fd.get("message")||"").trim().slice(0,3000), cvLink:(fd.get("cvlink")||"").trim().slice(0,500), createdAt:new Date().toISOString(), status:"new" };
  const file=fd.get("cv");
  if(!q.name || !/^\S+@\S+\.\S+$/.test(q.email) || !q.phone){ msg.textContent="Enter your name, a valid email address and a phone number."; return; }
  if(file && file.size===0 && !q.cvLink){ msg.textContent="Attach your CV."; return; }
  if(file && file.size>5*1048576){ msg.textContent="Your CV is over 5 MB. Save it as a smaller PDF and try again."; return; }
  if(file && file.size && !/\.(pdf|docx?)$/i.test(file.name)){ msg.textContent="Attach your CV as a PDF or Word document."; return; }
  if(!fd.get("consent")){ msg.textContent="Tick the box to agree to how we'll use your details."; return; }
  const btn=f.querySelector("button[type=submit]"); btn.disabled=true; msg.textContent="Sending your application…";
  try{ await addApplication(q, file&&file.size?file:null); f.innerHTML=`<h2 class="sub" style="margin-top:0">Application received</h2><p>Thank you, ${esc(q.name)}. We've received your application${q.jobId!=="open"?` for ${esc(q.jobTitle)}`:""} and will contact you if you're shortlisted.</p>`; }
  catch(err){ btn.disabled=false; msg.textContent="Your application couldn't be sent. Check your connection and try again."; }
}
async function addApplication(q,file){
  if(S.mode==="supabase"){
    let cv_path="", cv_name="";
    if(file){ const ext=(file.name.match(/\.(pdf|docx?)$/i)||[".pdf"])[0].toLowerCase(); cv_path=`applications/${uid()}-${slug(q.name)}${ext}`; cv_name=file.name.slice(0,200);
      const r=await fetch(`${SB_URL}/storage/v1/object/cvs/${cv_path}`,{method:"POST",headers:{apikey:CFG.supabaseAnonKey,Authorization:"Bearer "+CFG.supabaseAnonKey,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
      if(!r.ok) throw new Error("upload "+r.status); }
    await sbRest("applications",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({job_id:q.jobId,job_title:q.jobTitle,name:q.name,email:q.email,phone:q.phone,message:q.message,cv_path,cv_name,cv_link:q.cvLink})});
    return;
  }
  if(S.mode==="cloud"){ const me = S.user ? await S.user.id() : null; if(!me) throw new Error("no-id");
    const ref=S.db.doc("applications/"+me); const cur=await ref.get(); const list=(cur.exists?cur.data().items:[])||[];
    return ref.set({items:[...list.slice(-19),{...q,key:uid()}]}); }
  let cvData=""; if(file && file.size<1048576) cvData=await new Promise(r=>{const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(file);});
  const apps=LS.get("applications")||[]; apps.unshift({id:uid(),...q,cvName:file?.name||"",cvData}); LS.set("applications",apps);
}

function viewLegalIndex(){
  return `<section class="pagehead"><div class="wrap" style="padding-bottom:36px"><div class="crumb"><a href="#/">Rays</a> / Legal</div><h1>Policies and legal information</h1>
    <p class="lead">How we protect you, your data and your money.</p></div></section>
    <section class="block pagebody"><div class="wrap"><div class="legal-list">${pubPolicies().map(p=>`<a href="#/legal/${esc(p.id)}"><h2 class="sub">${esc(p.title)}</h2><p class="muted">${esc(p.summary)}</p></a>`).join("")}</div></div></section>`;
}
function viewPolicy(id){
  const p=pubPolicies().find(x=>x.id===id); if(!p) return viewNotFound();
  if(p.body===undefined){ ensureFull(); }
  return `<section class="pagehead"><div class="wrap" style="padding-bottom:36px"><div class="crumb"><a href="#/legal">Legal</a></div><h1>${esc(p.title)}</h1>
    ${p.updated?`<p class="lead">Last updated ${esc(fmtDate(p.updated))}</p>`:""}</div></section>
    <section class="block pagebody"><div class="wrap legal">
      <aside class="legal-nav" aria-label="Policies">${pubPolicies().map(x=>`<a href="#/legal/${esc(x.id)}" ${x.id===id?'aria-current="page"':""}>${esc(x.title)}</a>`).join("")}</aside>
      <article class="prose policy">${p.body===undefined?`<p class="muted">Loading…</p>`:rich(p.body,2)}</article>
    </div></section>`;
}
let fullLoading=null;
function ensureFull(){
  if(fullLoading || PRERENDER) return;
  fullLoading = (S.mode==="supabase" ? fetchPublic().then(d=>d.site) : fetch(ASSET_BASE+"data/site.json").then(r=>r.ok?r.json():null))
    .then(s=>{ if(s){ S.site=s; render(false); } }).catch(()=>{}).finally(()=>{ fullLoading=null; });
}

/* ---------- site search (runs on content already in the page) ---------- */
function searchIndex(){
  const s=site(); if(!s) return [];
  const out=[];
  for(const sec of s.sections||[]) for(const p of sec.pages){ if(p.ref) continue; out.push({t:p.title,s:sec.title,x:[p.lead,p.body,(p.features||[]).map(f=>f.title+" "+f.text).join(" "),(p.list||[]).join(" ")].join(" "),h:pageHref(sec.id,p.id)}); }
  for(const f of s.faqs||[]) out.push({t:f.q,s:"Help",x:f.a,h:"#/about/help"});
  for(const p of pubPolicies()) out.push({t:p.title,s:"Legal",x:p.summary+" "+(p.body||""),h:"#/legal/"+p.id});
  for(const j of openJobs()) out.push({t:j.title,s:"Careers",x:[j.department,j.location,j.summary].join(" "),h:"#/about/careers/"+j.id});
  for(const p of published()) out.push({t:p.title,s:"News",x:(p.excerpt||"")+" "+(p.body||""),h:"#/media/post/"+p.id});
  return out;
}
function runSearch(q){
  const box=$("#searchres"); if(!box) return;
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length){ box.innerHTML=""; return; }
  const hits=searchIndex().map(e=>{ const t=e.t.toLowerCase(), x=(e.x||"").toLowerCase(); if(!terms.every(w=>t.includes(w)||x.includes(w))) return null;
    let score=terms.reduce((n,w)=>n+(t.includes(w)?3:0)+(x.includes(w)?1:0),0); const i=x.indexOf(terms[0]); const snip=i>=0?(e.x||"").slice(Math.max(0,i-50),i+90).trim():(e.x||"").slice(0,120);
    return {...e,score,snip}; }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,12);
  box.innerHTML = toPaths(hits.length ? hits.map(h=>`<a href="${h.h}"><span class="muted small">${esc(h.s)}</span><b>${esc(h.t)}</b><span class="small">${esc(h.snip)}</span></a>`).join("") : `<p class="muted">No results for "${esc(q)}". Try a different word, or <a href="#/about/help">browse help</a>.</p>`);
}
function openSearch(){ const s=$("#search"); if(!s) return; s.hidden=false; document.body.style.overflow="hidden"; setTimeout(()=>$("#searchq")?.focus(),30); }
function closeSearch(){ const s=$("#search"); if(!s || s.hidden) return; s.hidden=true; document.body.style.overflow=""; }

/* ================= page assembly (shared by browser and prerender) ================= */
function toPaths(html){ return PATH_MODE ? html.replace(/href="#\//g,'href="/') : html; }
function pageMeta(r){
  const f = r.length>=2 && r[0]!=="media" ? findPage(r[0],r[1]) : null;
  const post = r[0]==="media" && r[1]==="post" ? S.posts.find(p=>p.id===r[2]) : null;
  const brand = site()?.brand||{};
  const policy = r[0]==="legal" && r[1] ? pubPolicies().find(p=>p.id===r[1]) : null;
  const job = r[0]==="about" && r[1]==="careers" && r[2] ? (r[2]==="open" ? {title:"Open application",summary:"Apply to join Rays."} : (site()?.jobs||[]).find(j=>j.id===r[2])) : null;
  if(policy) return {title:policy.title+" · Rays Microfinance", description:policy.summary||""};
  if(r[0]==="legal") return {title:"Policies and legal information · Rays Microfinance", description:"Privacy, terms, complaints, security and other policies."};
  if(job) return {title:job.title+" · Careers at Rays", description:job.summary||""};
  const known = !r.length || (r[0]==="media" ? (r[1]!=="post" || post) : r.length===1 ? site()?.sections?.some(s=>s.id===r[0]) : !!f);
  const title = !known ? "Page not found · Rays Microfinance" : f ? f.page.title+" · Rays Microfinance" : post ? post.title+" · Rays Microfinance" : r[0]==="media" ? "News and media · Rays Microfinance" : (brand.name||"Rays")+" · "+(brand.motto||"");
  const description = (f?.page?.lead) || post?.excerpt || brand.tagline || "";
  return {title, description};
}
function publicHTML(r){
  let main;
  if(!r.length) main=viewHome();
  else if(r[0]==="media") main = r[1]==="post" ? viewPost(r[2]) : viewMedia(KINDS[r[1]]?r[1]:null);
  else if(r[0]==="legal") main = r[1] ? viewPolicy(r[1]) : viewLegalIndex();
  else if(r[0]==="about" && r[1]==="careers" && r[2]) main = viewJob(r[2]);
  else if(r.length===1){ const sec=site().sections.find(s=>s.id===r[0]); main = sec ? viewPage(sec.id,sec.pages[0]?.id) : viewNotFound(); }
  else main=viewPage(r[0],r[1]);
  return toPaths(header()+`<main id="main">${main}</main>`+footer());
}

/* ================= render ================= */
let adminLoading=null;
function loadAdmin(){
  if(window.RaysAdmin) return Promise.resolve();
  if(!adminLoading) adminLoading = new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=CFG.adminScript; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  return adminLoading;
}
/* Attach behaviour to server-rendered HTML without rebuilding it. */
function hydrate(){
  const app=$("#app"); if(!app || !app.querySelector("header.site") || route()[0]==="admin") return false;
  if(!route().length) startRain();
  afterRender();
  if(S.maybeEditor || S.canEdit){ const tools=$(".bar .tools"); if(tools && !tools.querySelector(".portal")) tools.insertAdjacentHTML("beforeend",toPaths(`<a class="btn small ghost portal" href="#/admin">Portal</a>`)); }
  return true;
}
function render(scrollTop=true){
  const app=$("#app"); if(!S.loaded) return;
  const r=route();
  if(r[0]==="admin"){
    if(rainStop){rainStop();rainStop=null}
    document.title="Portal · Rays";
    if(!window.RaysAdmin){ app.innerHTML=`<div class="loading">Opening the portal…</div>`; loadAdmin().then(()=>render(scrollTop)).catch(()=>{ app.innerHTML=`<div class="loading">The portal couldn't load. Check your connection and refresh.</div>`; }); return; }
    return window.RaysAdmin.render(app,r,scrollTop);
  }
  if(!site()){ app.innerHTML=toPaths(viewEmptySite()); return; }
  app.innerHTML = publicHTML(r);
  const m = pageMeta(r); document.title=m.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", m.description);
  if(scrollTop) window.scrollTo(0,0);
  if(!r.length) startRain(); else if(rainStop){rainStop();rainStop=null}
  afterRender();
}
function afterRender(){
  if($("[data-calc]")) runCalc();
  const an=$("#announce"); if(an && LS.get("annClosed")===an.dataset.text) an.remove();
}

/* ================= rain inside the brand curve =================
   Runs once for ~10 s, then settles on a still frame. Pauses off-screen and in background
   tabs, caps pixel density on phones, and draws a single still frame for reduced motion. */
let rainStop=null;
function startRain(){
  if(rainStop){rainStop();rainStop=null}
  const cv=$("#rain"); if(!cv) return;
  const ctx=cv.getContext("2d",{alpha:false});
  const C={skyTop:"#6E8FC4",skyLow:"#EEF1F8",rain:"#FFFFFF",dry:"#D9C29A",wet:"#5B3F2E",hill:"#B6A8D6",sprout:"#6FA83A",leaf:"#FCC909"};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 700px)").matches;
  const saveData = navigator.connection?.saveData;
  const cols=small?44:70;
  let W=0,H=0,wet=new Array(cols).fill(0),drops=[],ripples=[],sprouts=[],raf=0,done=false,sky=0,elapsed=0,last=0,visible=true;
  for(let i=0;i<cols;i++){ if(Math.random()<.6) sprouts.push({i,off:Math.random(),h:0,max:10+Math.random()*28,lean:(Math.random()-.5)*.5,bloom:Math.random()<.18}); }
  function size(){ const dpr=Math.min(small?1.5:2,devicePixelRatio||1); W=cv.clientWidth; H=cv.clientHeight; if(!W||!H) return; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); }
  const gy=()=>H*.66;
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const lerp=(a,b,t)=>{const pa=hex(a),pb=hex(b);return `rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(",")})`};
  function drawSky(){ const g=ctx.createLinearGradient(0,0,0,gy()); g.addColorStop(0,lerp("#5C6F96",C.skyTop,sky)); g.addColorStop(1,lerp("#B9C1D4",C.skyLow,sky)); ctx.fillStyle=g; ctx.fillRect(0,0,W,gy()+2);
    ctx.fillStyle=C.hill; ctx.beginPath(); ctx.moveTo(0,gy()); ctx.quadraticCurveTo(W*.25,gy()-H*.1,W*.5,gy()-H*.03); ctx.quadraticCurveTo(W*.72,gy()-H*.13,W,gy()-H*.02); ctx.lineTo(W,gy()); ctx.fill(); }
  function drawGround(){ const cw=W/cols, y=gy(); for(let i=0;i<cols;i++){ ctx.fillStyle=lerp(C.dry,C.wet,Math.min(1,wet[i])); ctx.fillRect(i*cw,y,cw+1,H-y); } }
  function drawSprouts(){ const cw=W/cols, y=gy(); ctx.strokeStyle=C.sprout; ctx.fillStyle=C.sprout; ctx.lineWidth=2; ctx.lineCap="round";
    for(const s of sprouts){ if(s.h<=.5) continue; const x=(s.i+s.off)*cw, tx=x+s.lean*s.h, ty=y-s.h;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x,y-s.h*.6,tx,ty); ctx.stroke();
      if(s.h>8){ const l=Math.min(9,s.h*.35); ctx.beginPath(); ctx.ellipse(tx-l*.6,ty+l*.3,l*.7,l*.3,-.6,0,Math.PI*2); ctx.ellipse(tx+l*.6,ty+l*.5,l*.7,l*.3,.6,0,Math.PI*2); ctx.fill();
        if(s.bloom && s.h>s.max*.9){ ctx.fillStyle=C.leaf; ctx.beginPath(); ctx.arc(tx,ty-2,3.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle=C.sprout; } } } }
  function finalState(){ if(!W) return; wet.fill(1); sky=1; sprouts.forEach(s=>s.h=s.max); drawSky(); drawGround(); drawSprouts(); cv.classList.add("ready"); }
  function frame(now){
    raf=0; if(!visible||done) return;
    const dt=last?Math.min(50,now-last):16; last=now; elapsed+=dt/1000; const k=dt/16.7;
    if(!W){ size(); raf=requestAnimationFrame(frame); return; }
    const raining=elapsed<5.5;
    if(!raining) sky=Math.min(1,sky+.012*k);
    drawSky();
    if(raining){ for(let n=0;n<Math.max(2,W/(small?160:110));n++) drops.push({x:Math.random()*W,y:-20-Math.random()*40,v:6+Math.random()*5,l:10+Math.random()*14}); }
    drawGround();
    const y0=gy(); ctx.strokeStyle=C.rain; ctx.lineWidth=1.4; ctx.globalAlpha=.8; ctx.beginPath();
    drops=drops.filter(d=>{ d.y+=d.v*k; if(d.y>=y0){ const i=Math.min(cols-1,Math.max(0,Math.floor(d.x/W*cols))); wet[i]=Math.min(1,wet[i]+.06); if(i>0) wet[i-1]=Math.min(1,wet[i-1]+.02); if(i<cols-1) wet[i+1]=Math.min(1,wet[i+1]+.02); if(ripples.length<60) ripples.push({x:d.x,r:1,a:.6}); return false; } ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-1,d.y-d.l); return true; });
    ctx.stroke();
    ctx.lineWidth=1; ripples=ripples.filter(r=>{ r.r+=.8*k; r.a-=.03*k; if(r.a<=0) return false; ctx.globalAlpha=r.a; ctx.beginPath(); ctx.ellipse(r.x,y0+2,r.r*1.8,r.r*.4,0,0,Math.PI*2); ctx.stroke(); return true; });
    ctx.globalAlpha=1;
    for(const s of sprouts){ if(wet[s.i]>.5 && s.h<s.max) s.h+=((s.max-s.h)*.03+.08)*k; }
    if(!raining){ for(let i=0;i<cols;i++) wet[i]=Math.min(1,wet[i]+.004*k); }
    drawSprouts();
    if(elapsed>11 && !drops.length && !ripples.length){ done=true; finalState(); return; }
    raf=requestAnimationFrame(frame);
  }
  const kick=()=>{ if(!raf && visible && !done){ last=0; raf=requestAnimationFrame(frame); } };
  size(); cv.classList.add("ready");
  const ro=new ResizeObserver(()=>{ size(); if(done||reduce||saveData) finalState(); }); ro.observe(cv);
  if(reduce||saveData){ finalState(); rainStop=()=>ro.disconnect(); return; }
  const io=new IntersectionObserver(es=>{ visible=es[0].isIntersecting && !document.hidden; kick(); }); io.observe(cv);
  const vis=()=>{ visible=!document.hidden; kick(); }; document.addEventListener("visibilitychange",vis);
  // wait for the first paint so the animation never competes with the page arriving
  const start=()=>kick(); ("requestIdleCallback" in window) ? requestIdleCallback(start,{timeout:600}) : setTimeout(start,200);
  rainStop=()=>{ cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange",vis); done=true; };
}

/* ================= public events ================= */
async function submitContact(e){
  e.preventDefault(); const f=e.target, fd=new FormData(f), msg=$("#contact-msg");
  if(fd.get("website")) return; // spam trap
  const q={name:(fd.get("name")||"").trim().slice(0,120),reach:(fd.get("reach")||"").trim().slice(0,160),audience:fd.get("audience"),message:(fd.get("message")||"").trim().slice(0,4000),createdAt:new Date().toISOString(),handled:false};
  if(!q.name||!q.reach||!q.message){ msg.textContent="Fill in your name, a phone number or email, and your message."; return; }
  const btn=f.querySelector("button[type=submit]"); btn.disabled=true; msg.textContent="Sending…";
  try{ await addInquiry(q); f.reset(); msg.textContent="Message sent. Our team will get back to you."; }
  catch(err){ msg.textContent="Your message couldn't be sent. Check your connection and try again."; }
  btn.disabled=false;
}
function closeDrawer(){ $("#drawer")?.classList.remove("open"); $(".menu-btn")?.setAttribute("aria-expanded","false"); document.body.style.overflow=""; }

if(!PRERENDER){
  window.addEventListener(PATH_MODE?"popstate":"hashchange", onRoute);
  document.addEventListener("click",e=>{
    const link=e.target.closest("a[href]");
    if(link && PATH_MODE && e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !link.target && !link.hasAttribute("download")){
      const href=link.getAttribute("href");
      if(href.startsWith("/") && !href.startsWith("//")){
        e.preventDefault(); closeDrawer();
        if(window.RaysAdmin?.guardLeave && !window.RaysAdmin.guardLeave(href)) return;
        nav(href); return;
      }
    }
    const dropBtn=e.target.closest("[data-drop]");
    if(dropBtn){ const id=dropBtn.dataset.drop; S.openDrop = S.openDrop===id?null:id; document.querySelectorAll(".drop").forEach(d=>d.classList.toggle("open",d.id==="drop-"+S.openDrop)); document.querySelectorAll("[data-drop]").forEach(b=>b.setAttribute("aria-expanded",b.dataset.drop===S.openDrop)); return; }
    if(S.openDrop && !e.target.closest(".drop")){ S.openDrop=null; document.querySelectorAll(".drop.open").forEach(d=>d.classList.remove("open")); document.querySelectorAll("[data-drop]").forEach(b=>b.setAttribute("aria-expanded","false")); }
    const a=e.target.closest("[data-act]"); if(!a) return;
    if(a.dataset.act==="drawer"){ $("#drawer")?.classList.add("open"); a.setAttribute("aria-expanded","true"); document.body.style.overflow="hidden"; return; }
    if(a.dataset.act==="drawer-close"){ closeDrawer(); return; }
    if(a.dataset.act==="search"){ openSearch(); return; }
    if(a.dataset.act==="search-close"){ closeSearch(); return; }
    if(a.dataset.act==="ann-close"){ const an=$("#announce"); if(an){ LS.set("annClosed",an.dataset.text); an.remove(); } return; }
    window.RaysAdmin?.act(a,e);
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="/" && !e.target.matches?.("input,textarea,select")){ e.preventDefault(); openSearch(); return; }
    if(e.key==="Escape"){ closeSearch(); if(S.openDrop){ S.openDrop=null; document.querySelectorAll(".drop.open").forEach(d=>d.classList.remove("open")); } closeDrawer(); }
  });
  document.addEventListener("submit",e=>{ if(e.target.id==="contact") submitContact(e); else if(e.target.id==="apply") submitApply(e); });
  document.addEventListener("input",e=>{
    const t=e.target;
    if(t.dataset?.calc) runCalc();
    else if(t.id==="searchq") runSearch(t.value);
    else if(t.id==="faqq"){ const q=t.value.toLowerCase().trim(); let n=0; document.querySelectorAll(".qa").forEach(d=>{ const hit=!q||d.textContent.toLowerCase().includes(q); d.hidden=!hit; if(hit){n++; if(q) d.open=true;} }); document.querySelectorAll(".faqcat").forEach(c=>c.hidden=![...c.querySelectorAll(".qa")].some(d=>!d.hidden)); const none=$("#faqnone"); if(none) none.hidden=n>0; }
  });
  document.addEventListener("change",e=>{
    if(e.target.id==="loccity"||e.target.id==="loctype"){ const c=$("#loccity").value, t=$("#loctype").value; let n=0; document.querySelectorAll(".loc").forEach(l=>{ const ok=(!c||l.dataset.city===c)&&(!t||l.dataset.type===t); l.hidden=!ok; if(ok) n++; }); const lc=$("#loccount"); if(lc) lc.textContent=n+(n===1?" location":" locations"); }
  });
  document.addEventListener("click",e=>{ if(e.target.closest("#searchres a")) closeSearch(); },true);
  // Warm the portal code when an editor shows intent, so it opens instantly.
  document.addEventListener("pointerover",e=>{ if(e.target.closest?.(".portal")) loadAdmin().catch(()=>{}); },{passive:true});
  boot();
}

/* shared with admin.js (loaded on demand) */
window.Rays = { CFG, S, LS, $, esc, clone, uid, slug, blobUrl, thumbOf, toast, rich, nav, route, curPath, render, findPage, KINDS, site, logoImg, SB_URL, PATH_MODE, ASSET_BASE, IS_ARTIFACT, toPaths, fmtDate, canRerender, sbRest, mapPost, header, footer, lite, pubPolicies };

/* ================= prerender entry (used by build.mjs in Node) ================= */
if(PRERENDER){
  window.RaysPrerender = (data, path) => {
    S.site=data.site; S.posts=data.posts||[]; S.loaded=true; S.mode="supabase"; PRE_PATH=path;
    const r=route();
    return { html: site() ? publicHTML(r) : "", ...pageMeta(r), faqs: (r[0]==="about"&&r[1]==="help") ? (site().faqs||[]) : null };
  };
}
