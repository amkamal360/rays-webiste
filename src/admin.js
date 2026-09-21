"use strict";
/* Rays portal. Loaded on demand from app.js when someone opens /admin. */
const { CFG, S, LS, $, esc, clone, uid, slug, blobUrl, toast, nav, route, curPath, render, findPage, KINDS, site, logoImg, SB_URL, toPaths, fmtDate, canRerender, header } = window.Rays;

const fmtSize = b => b>1048576 ? (b/1048576).toFixed(1)+" MB" : Math.round((b||0)/1024)+" KB";
let ready=null;

/* ================= backend setup ================= */
async function init(){
  if(S.mode==="supabase"){
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    S.sb = createClient(SB_URL, CFG.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
    const { data:{ session } } = await S.sb.auth.getSession();
    await setSession(session); await sbLoad();
    S.sb.auth.onAuthStateChange(async (evt, sess)=>{ if(evt==="TOKEN_REFRESHED"||evt==="INITIAL_SESSION") return; await setSession(sess); await sbLoad(); render(false); });
  } else if(S.mode==="local"){ S.applications = LS.get("applications")||[];
  } else if(S.mode==="cloud" && S.canEdit){
    const db=S.db;
    db.collection("media").orderBy("uploadedAt","desc").onSnapshot(q=>{ S.media=q.docs.map(d=>({id:d.id,...d.data()})); if(canRerender()) render(false); }, ()=>{});
    let raw=[], st={handled:{},deleted:{}};
    const merge=()=>{ S.inquiries = raw.flatMap(d=>(d.data().messages||[]).map((m,i)=>({...m,id:d.id+"~"+(m.key||i)}))).filter(m=>!st.deleted[m.id]).map(m=>({...m,handled:!!st.handled[m.id]})).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")); if(canRerender()) render(false); };
    db.collection("inquiries").onSnapshot(q=>{ raw=q.docs; merge(); }, ()=>{});
    let araw=[], ast={status:{},deleted:{}};
    const amerge=()=>{ S.applications = araw.flatMap(d=>(d.data().items||[]).map((m,i)=>({...m,id:d.id+"~"+(m.key||i)}))).filter(m=>!ast.deleted[m.id]).map(m=>({...m,status:ast.status[m.id]||m.status||"new"})).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")); if(canRerender()) render(false); };
    db.collection("applications").onSnapshot(q=>{ araw=q.docs; amerge(); }, ()=>{});
    db.doc("hr/state").onSnapshot(sn=>{ const d=sn.exists?sn.data():{}; ast={status:d.status||{},deleted:d.deleted||{}}; S.hr=ast; amerge(); }, ()=>{});
    db.doc("inbox/state").onSnapshot(sn=>{ const d=sn.exists?sn.data():{}; st={handled:d.handled||{},deleted:d.deleted||{}}; S.inbox=st; merge(); }, ()=>{});
  }
}
async function setSession(session){
  S.session=session||null; S.canEdit=false;
  if(session){ const { data } = await S.sb.from("admins").select("user_id").eq("user_id",session.user.id).maybeSingle(); S.canEdit=!!data; }
  S.maybeEditor=!!session;
}
async function sbLoad(){
  if(!S.canEdit) return;
  const sb=S.sb;
  const [siteR,posts,media,inq,apps] = await Promise.all([
    sb.from("site").select("data").eq("id","content").maybeSingle(),
    sb.from("posts").select("id,data,published,date").order("date",{ascending:false}),
    sb.from("media").select("*").order("uploaded_at",{ascending:false}),
    sb.from("inquiries").select("*").order("created_at",{ascending:false}),
    sb.from("applications").select("*").order("created_at",{ascending:false})
  ]);
  S.applications = (apps.data||[]).map(a=>({id:a.id,jobId:a.job_id,jobTitle:a.job_title,name:a.name,email:a.email,phone:a.phone,message:a.message,cvPath:a.cv_path,cvName:a.cv_name,cvLink:a.cv_link,status:a.status,createdAt:a.created_at}));
  if(!S.dirty) S.site = siteR.data?.data || null;
  S.posts = (posts.data||[]).map(r=>({...(r.data||{}), id:r.id, published:r.published, date:r.date}));
  S.media = (media.data||[]).map(m=>({id:m.id,name:m.name,contentType:m.content_type,size:m.size,alt:m.alt||"",thumb:m.thumb||"",width:m.width,height:m.height,uploadedAt:m.uploaded_at}));
  S.inquiries = (inq.data||[]).map(q=>({id:q.id,name:q.name,reach:q.reach,audience:q.audience,message:q.message,handled:q.handled,createdAt:q.created_at}));
}
const sbCheck = r => { if(r.error){ const e=new Error(r.error.message); e.code=r.error.code||r.error.statusCode; throw e; } return r; };

/* ================= image optimisation before upload =================
   Phone photos are often 3–8 MB. We resize to 1600 px (full) and 640 px (thumbnail) as WebP,
   so visitors on mobile data download a fraction of that. */
async function resizeImage(file, max, q=0.82){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return null;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*scale), h=Math.round(bmp.height*scale);
  const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(bmp,0,0,w,h); bmp.close?.();
  let blob = await new Promise(r=>c.toBlob(r,"image/webp",q));
  if(!blob || blob.type!=="image/webp") blob = await new Promise(r=>c.toBlob(r,"image/jpeg",q));
  return blob ? {blob,w,h} : null;
}
async function prepare(file){
  const full = await resizeImage(file,1600);
  const thumb = full ? await resizeImage(file,640,.78) : null;
  const ext = b => b.type==="image/webp"?".webp":b.type==="image/jpeg"?".jpg":"";
  const base = file.name.replace(/\.[^.]+$/,"");
  const useFull = full && full.blob.size < file.size;
  return {
    main: useFull ? new File([full.blob], base+ext(full.blob), {type:full.blob.type}) : file,
    thumb: thumb ? new File([thumb.blob], base+"-thumb"+ext(thumb.blob), {type:thumb.blob.type}) : null,
    width: full?.w, height: full?.h
  };
}

/* ================= storage adapter (writes) ================= */
const store = {
  async saveSite(obj){
    if(S.mode==="supabase"){ sbCheck(await S.sb.from("site").upsert({id:"content",data:obj,updated_at:new Date().toISOString()})); S.site=obj; LS.set("public",null); return; }
    if(S.mode==="cloud") return S.db.doc("site/content").set(obj);
    S.site=obj; if(!LS.set("site",obj)) throw new Error("Browser storage is full"); },
  async savePost(p){
    const {id,...rest}=p;
    if(S.mode==="supabase"){ const {published,date,...data}=rest; sbCheck(await S.sb.from("posts").upsert({id,data,published:!!published,date:date||null})); await sbLoad(); return; }
    if(S.mode==="cloud") return S.db.doc("posts/"+id).set(rest);
    const i=S.posts.findIndex(x=>x.id===id); if(i>=0) S.posts[i]=p; else S.posts.unshift(p); S.posts.sort((a,b)=>(b.date||"").localeCompare(a.date||"")); LS.set("posts",S.posts); },
  async deletePost(id){
    if(S.mode==="supabase"){ sbCheck(await S.sb.from("posts").delete().eq("id",id)); await sbLoad(); return; }
    if(S.mode==="cloud") return S.db.doc("posts/"+id).delete();
    S.posts=S.posts.filter(x=>x.id!==id); LS.set("posts",S.posts); },
  async upload(file){
    const isVideo=/^video\//.test(file.type);
    const cap = S.mode==="supabase"?50:S.mode==="cloud"?20:2.5;
    const prep = await prepare(file);
    if(prep.main.size > cap*1048576) throw new Error(`${file.name} is ${fmtSize(prep.main.size)}. The limit is ${cap} MB${isVideo?"; compress the video (720p is plenty for phones) and try again":""}.`);
    const meta = { name:file.name, contentType:prep.main.type||file.type, size:prep.main.size, width:prep.width||null, height:prep.height||null };
    if(S.mode==="supabase"){
      const put = async f => { const ext=(f.name.match(/\.[a-z0-9]+$/i)||[""])[0].toLowerCase(); const path=uid()+"-"+slug(f.name.replace(/\.[^.]+$/,""))+ext;
        sbCheck(await S.sb.storage.from(CFG.mediaBucket).upload(path,f,{contentType:f.type||undefined,upsert:false,cacheControl:"31536000"})); return path; };
      const id = await put(prep.main); const thumb = prep.thumb ? await put(prep.thumb) : "";
      sbCheck(await S.sb.from("media").insert({id,name:meta.name,content_type:meta.contentType,size:meta.size,thumb,width:meta.width,height:meta.height}));
      return id; }
    if(S.mode==="cloud"){
      const r = await S.assets.upload(prep.main); const t = prep.thumb ? await S.assets.upload(prep.thumb) : null;
      await S.db.doc("media/"+r.id).set({...meta,thumb:t?.id||"",uploadedAt:new Date().toISOString(),alt:""}); return r.id; }
    const read = f => new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(f)});
    const id=uid(), tid=prep.thumb?uid():"";
    S.media.unshift({id,...meta,thumb:tid,uploadedAt:new Date().toISOString(),localUrl:await read(prep.main),alt:""});
    if(tid) S.media.unshift({id:tid,name:prep.thumb.name,contentType:prep.thumb.type,size:prep.thumb.size,localUrl:await read(prep.thumb),isThumb:true});
    if(!LS.set("media",S.media)){ S.media=S.media.filter(m=>m.id!==id&&m.id!==tid); throw new Error("Browser storage is full. Delete some files and try again."); }
    return id; },
  async afterUpload(){ if(S.mode==="supabase") await sbLoad(); },
  async deleteMedia(id){
    const m=S.media.find(x=>x.id===id); const ids=[id, m?.thumb].filter(Boolean);
    if(S.mode==="supabase"){ await S.sb.storage.from(CFG.mediaBucket).remove(ids); sbCheck(await S.sb.from("media").delete().eq("id",id)); await sbLoad(); return; }
    if(S.mode==="cloud"){ for(const x of ids){ try{ await S.assets.delete(x);}catch(e){} } return S.db.doc("media/"+id).delete(); }
    S.media=S.media.filter(x=>!ids.includes(x.id)); LS.set("media",S.media); },
  async setHandled(id,handled){
    if(S.mode==="supabase"){ sbCheck(await S.sb.from("inquiries").update({handled}).eq("id",id)); await sbLoad(); return; }
    if(S.mode==="cloud"){ const st=clone(S.inbox||{handled:{},deleted:{}}); if(handled) st.handled[id]=true; else delete st.handled[id]; return S.db.doc("inbox/state").set(st); }
    Object.assign(S.inquiries.find(x=>x.id===id),{handled}); LS.set("inquiries",S.inquiries); },
  async setAppStatus(id,status){
    if(S.mode==="supabase"){ sbCheck(await S.sb.from("applications").update({status}).eq("id",id)); const a=S.applications.find(x=>x.id===id); if(a) a.status=status; return; }
    if(S.mode==="cloud"){ const st=clone(S.hr||{status:{},deleted:{}}); st.status[id]=status; return S.db.doc("hr/state").set(st); }
    const apps=LS.get("applications")||[]; const a=apps.find(x=>x.id===id); if(a) a.status=status; LS.set("applications",apps); S.applications=apps; },
  async deleteApp(id){
    const a=S.applications.find(x=>x.id===id);
    if(S.mode==="supabase"){ if(a?.cvPath) await S.sb.storage.from("cvs").remove([a.cvPath]); sbCheck(await S.sb.from("applications").delete().eq("id",id)); await sbLoad(); return; }
    if(S.mode==="cloud"){ const st=clone(S.hr||{status:{},deleted:{}}); st.deleted[id]=true; return S.db.doc("hr/state").set(st); }
    S.applications=S.applications.filter(x=>x.id!==id); LS.set("applications",S.applications); },
  async cvUrl(a){
    if(a.cvPath && S.mode==="supabase"){ const { data, error } = await S.sb.storage.from("cvs").createSignedUrl(a.cvPath, 300, { download: a.cvName||true }); if(error) throw error; return data.signedUrl; }
    return a.cvData || a.cvLink || ""; },
  async deleteInquiry(id){
    if(S.mode==="supabase"){ sbCheck(await S.sb.from("inquiries").delete().eq("id",id)); await sbLoad(); return; }
    if(S.mode==="cloud"){ const st=clone(S.inbox||{handled:{},deleted:{}}); st.deleted[id]=true; delete st.handled[id]; return S.db.doc("inbox/state").set(st); }
    S.inquiries=S.inquiries.filter(x=>x.id!==id); LS.set("inquiries",S.inquiries); }
};
const libMedia = () => S.media.filter(m=>!m.isThumb);

/* ================= views ================= */
function shell(active,inner){
  const secs=(S.draft||site())?.sections||[];
  const item=(h,l)=>`<a href="${h}" ${active===h?'aria-current="page"':""}>${esc(l)}</a>`;
  const open = S.inquiries.filter(x=>!x.handled).length; const newApps=S.applications.filter(a=>a.status==="new").length;
  const note = S.mode==="local" ? `<p class="note">Preview mode: changes are saved in this browser only. Add your Supabase keys to share content with your team.</p>` : "";
  return `<div class="admin"><aside>
    <a class="logo" href="#/">${logoImg(true)}</a>
    ${item("#/admin","Overview")}
    <div class="grp">Website</div>${item("#/admin/home","Home page")}${item("#/admin/stats","Figures")}${item("#/admin/settings","Brand, contact and links")}${item("#/admin/faqs","Help and FAQs")}${item("#/admin/branches","Branches and agents")}${item("#/admin/downloads","Downloads")}${item("#/admin/calculator","Financing calculator")}${item("#/admin/policies","Policies")}
    <div class="grp">Pages</div>${secs.map(s=>item("#/admin/pages/"+s.id,s.title)).join("")}
    <div class="grp">Careers</div>${item("#/admin/jobs","Jobs")}${item("#/admin/applications","Applications"+(newApps?` (${newApps})`:""))}
    <div class="grp">Media</div>${item("#/admin/posts","Posts")}${item("#/admin/media","Library")}
    <div class="grp">Inbox</div>${item("#/admin/inquiries","Enquiries"+(open?` (${open})`:""))}
    <div class="grp">&nbsp;</div><a href="#/">View website</a>
    ${S.mode==="supabase"?`<button class="linklike" data-act="signout">Sign out</button>`:""}
  </aside><main id="adminmain">${note}${inner}</main></div>
  <div class="savebar${S.dirty?" show":""}" id="savebar"><span>You have unsaved changes to the website.</span><button class="btn ghost-light small" data-act="discard">Discard</button><button class="btn yellow small" data-act="save-site">Save changes</button></div>`;
}
function ensureDraft(){ if(!S.draft) S.draft = clone(site()||{brand:{},home:{},stats:[],sections:[],contact:{},languages:[]}); return S.draft; }
const fld = (path,label,val,type="text",hint="") => type==="area"
  ? `<label class="f"><span>${esc(label)}</span><textarea data-bind="${esc(path)}">${esc(val)}</textarea>${hint?`<small class="muted">${esc(hint)}</small>`:""}</label>`
  : `<label class="f"><span>${esc(label)}</span><input type="text" data-bind="${esc(path)}" value="${esc(val)}">${hint?`<small class="muted">${esc(hint)}</small>`:""}</label>`;
const linesFld = (path,label,arr,hint="One item per line") => `<label class="f"><span>${esc(label)}</span><textarea data-lines="${esc(path)}">${esc((arr||[]).join("\n"))}</textarea><small class="muted">${esc(hint)}</small></label>`;
function pairList(path,arr,titleLbl="Title",textLbl="Text",addLbl="Add item",hrefs=false){
  return `${(arr||[]).map((x,i)=>`<div class="row">
      <input type="text" aria-label="${esc(titleLbl)}" placeholder="${esc(titleLbl)}" data-bind="${path}.${i}.title" value="${esc(x.title)}">
      <div><textarea style="min-height:64px" aria-label="${esc(textLbl)}" placeholder="${esc(textLbl)}" data-bind="${path}.${i}.text">${esc(x.text)}</textarea>${hrefs?`<input type="text" style="margin-top:6px" placeholder="Link, e.g. /financing/emurabaha" data-bind="${path}.${i}.href" value="${esc(x.href)}">`:""}</div>
      <button class="iconbtn" data-act="rm" data-path="${path}" data-i="${i}" aria-label="Remove ${esc(x.title||"item")}">Remove</button></div>`).join("")}
    <button class="btn small ghost" data-act="add" data-path="${path}" data-shape="${hrefs?"link":"pair"}">${esc(addLbl)}</button>`;
}
function vOverview(){
  const d=site(); const pages=(d?.sections||[]).reduce((n,s)=>n+s.pages.length,0);
  return shell("#/admin",`<h1>Overview</h1><p class="muted">Manage the Rays website: pages, home page, figures, posts and media.</p>
    ${!d?`<div class="panel"><h2>Set up the website</h2><p>No content has been saved yet. Load the starter content, which covers every section and page, then edit it here.</p>
      <div class="btnrow"><button class="btn" data-act="starter">Load starter content</button><button class="btn ghost" data-act="blank-site">Start blank</button></div><p id="startermsg" role="status" class="muted" style="margin-top:10px"></p></div>`:""}
    <div class="stats" style="margin-top:24px">
      <div><b>${pages}</b><span>Pages</span></div><div><b>${S.posts.filter(p=>p.published).length}</b><span>Published posts</span></div>
      <div><b>${S.posts.filter(p=>!p.published).length}</b><span>Drafts</span></div><div><b>${S.inquiries.filter(x=>!x.handled).length}</b><span>Open enquiries</span></div></div>
    <div class="panel"><h2>Quick actions</h2><div class="btnrow"><a class="btn" href="#/admin/posts/new">Write a post</a><a class="btn ghost" href="#/admin/media">Upload media</a><a class="btn ghost" href="#/admin/home">Edit home page</a></div></div>`);
}
function vHome(){
  const d=ensureDraft(); d.home=d.home||{};
  return shell("#/admin/home",`<h1>Home page</h1>
    <div class="panel"><h2>Hero</h2>${fld("brand.motto","Headline (each sentence becomes a line)",d.brand?.motto)}${fld("home.lead","Introduction",d.home.lead,"area")}${fld("brand.meaning","Caption under the curve",d.brand?.meaning)}</div>
    <div class="panel"><h2>Story</h2>${fld("home.storyText","Story text",d.home.storyText,"area","Leave a blank line between paragraphs. Start lines with - for a bullet list.")}</div>
    <div class="panel"><h2>Three capabilities</h2>${pairList("home.capabilities",d.home.capabilities,"Title","Description","Add capability",true)}</div>
    <div class="panel"><h2>Connectivity</h2>${fld("home.connectivityTitle","Heading",d.home.connectivityTitle)}${fld("home.connectivityText","Text",d.home.connectivityText,"area")}${linesFld("home.connectivity","Connected institutions",d.home.connectivity)}</div>
    <div class="panel"><h2>SahayPay spotlight</h2>${fld("home.walletTitle","Heading",d.home.walletTitle)}${fld("home.walletText","Text",d.home.walletText,"area")}</div>
    <div class="panel"><h2>Built in-house</h2>${fld("home.inhouseTitle","Heading",d.home.inhouseTitle)}${fld("home.inhouseText","Text",d.home.inhouseText,"area")}${linesFld("home.inhouseList","Platforms we build",d.home.inhouseList)}</div>`);
}
function vStats(){
  const d=ensureDraft(); d.stats=d.stats||[];
  return shell("#/admin/stats",`<h1>Figures</h1><p class="muted">Shown on the home page under "Built for Ethiopia's financial ecosystem".</p>
    <div class="panel">${d.stats.map((x,i)=>`<div class="row two"><input type="text" aria-label="Figure" placeholder="Figure, e.g. 1.2M+" data-bind="stats.${i}.value" value="${esc(x.value)}"><input type="text" aria-label="Label" placeholder="Label" data-bind="stats.${i}.label" value="${esc(x.label)}"><button class="iconbtn" data-act="rm" data-path="stats" data-i="${i}">Remove</button></div>`).join("")}
    <button class="btn small ghost" data-act="add" data-path="stats" data-shape="stat">Add figure</button></div>`);
}
function vSettings(){
  const d=ensureDraft(); d.brand=d.brand||{}; d.contact=d.contact||{};
  return shell("#/admin/settings",`<h1>Brand and contact</h1>
    <div class="panel"><h2>Brand</h2>${fld("brand.name","Full name",d.brand.name)}${fld("brand.tagline","Descriptor",d.brand.tagline,"area")}${fld("brand.domain","Web address",d.brand.domain)}
      <p class="muted" style="font-size:14px">The logo and the "Ahead of the curve." tagline are official artwork from the brand manual and can't be edited here.</p></div>
    <div class="panel"><h2>Contact details</h2><div class="formgrid">${fld("contact.phone","Phone",d.contact.phone)}${fld("contact.email","Email",d.contact.email)}${fld("contact.address","Address",d.contact.address)}${fld("contact.hours","Opening hours",d.contact.hours)}</div></div>
    <div class="panel"><h2>Quick contact buttons</h2><p class="muted small">Shown on the contact page. Leave empty to hide.</p><div class="formgrid">${fld("contact.tollfree","Free call number",d.contact.tollfree)}${fld("contact.ussd","USSD code",d.contact.ussd,"text","e.g. *123#")}${fld("contact.whatsapp","WhatsApp number",d.contact.whatsapp,"text","With country code, e.g. +251…")}${fld("contact.telegram","Telegram",d.contact.telegram,"text","@username or t.me link")}</div></div>
    <div class="panel"><h2>Announcement banner</h2><p class="muted small">A yellow bar across the top of every page, for service notices or campaigns. Visitors can dismiss it.</p>
      <label class="check"><input type="checkbox" data-bind="announcement.active" ${d.announcement?.active?"checked":""}> Show the banner</label>
      ${fld("announcement.text","Message",d.announcement?.text)}${fld("announcement.link","Link (optional)",d.announcement?.link,"text","e.g. /media/post/…")}</div>
    <div class="panel"><h2>Social media</h2><div class="formgrid">${["facebook","telegram","linkedin","x","youtube","tiktok","instagram"].map(k=>fld("social."+k,{facebook:"Facebook",telegram:"Telegram channel",linkedin:"LinkedIn",x:"X",youtube:"YouTube",tiktok:"TikTok",instagram:"Instagram"}[k],d.social?.[k],"text","Full link")).join("")}</div></div>
    <div class="panel"><h2>App download links</h2><div class="formgrid">${fld("apps.android","SahayPay on Google Play",d.apps?.android)}${fld("apps.ios","SahayPay on the App Store",d.apps?.ios)}</div></div>
    <div class="panel"><h2>Languages in footer</h2>${linesFld("languages","Languages",d.languages)}</div>`);
}
function vSection(secId,pageId){
  const d=ensureDraft(); const si=d.sections.findIndex(s=>s.id===secId); if(si<0) return shell("",`<h1>Section not found</h1>`);
  const sec=d.sections[si]; const pi = pageId ? sec.pages.findIndex(p=>p.id===pageId) : -1; const base=`sections.${si}`;
  let inner = `<h1>${esc(sec.title)}</h1>
    <div class="panel"><h2>Section</h2><div class="formgrid">${fld(base+".title","Menu name",sec.title)}${fld(base+".intro","Short introduction",sec.intro)}</div></div>
    <div class="panel"><h2>Pages in this section</h2><div class="tablewrap"><table class="list"><thead><tr><th>Page</th><th>Address</th><th></th></tr></thead><tbody>
    ${sec.pages.map((p,i)=>`<tr><td><a href="#/admin/pages/${esc(sec.id)}/${esc(p.id)}">${esc(p.title)}</a>${p.ref?` <span class="pill">Linked to ${esc(p.ref)}</span>`:""}</td><td class="muted">/${esc(sec.id)}/${esc(p.id)}</td>
      <td style="white-space:nowrap">${i>0?`<button class="iconbtn" data-act="move" data-si="${si}" data-i="${i}" data-dir="-1" aria-label="Move up">Up</button>`:""} ${i<sec.pages.length-1?`<button class="iconbtn" data-act="move" data-si="${si}" data-i="${i}" data-dir="1" aria-label="Move down">Down</button>`:""} <button class="iconbtn" data-act="rm" data-path="${base}.pages" data-i="${i}">Remove</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="btnrow" style="margin-top:14px"><input type="text" id="newpage" placeholder="New page name" style="max-width:280px"><button class="btn small" data-act="addpage" data-si="${si}">Add page</button></div></div>`;
  if(pi>=0){
    const p=sec.pages[pi], pb=`${base}.pages.${pi}`;
    inner += `<div class="panel" id="pageedit"><h2>Edit page: ${esc(p.title)}</h2>
      <p class="muted" style="font-size:15px">Live at <a href="#/${esc(sec.id)}/${esc(p.id)}">/${esc(sec.id)}/${esc(p.id)}</a></p>
      ${fld(pb+".title","Page title",p.title)}
      ${p.ref?`<p class="note">This page shows the content of <b>${esc(p.ref)}</b>, so both stay in sync. <button class="btn small ghost" data-act="unlink" data-path="${pb}">Give it its own content</button></p>`:`
      ${fld(pb+".lead","Lead sentence",p.lead)}
      ${fld(pb+".body","Body",p.body,"area","Blank line between paragraphs. Start lines with - for bullets, ## for a subheading.")}
      <h3 style="margin:22px 0 10px">Feature list</h3>${pairList(pb+".features",p.features,"Feature","Description","Add feature")}
      <h3 style="margin:22px 0 10px">Numbered steps</h3><p class="muted" style="font-size:14px">Use only for a real sequence, like an application process.</p>${pairList(pb+".steps",p.steps,"Step","Description","Add step")}
      <div style="margin-top:22px">${linesFld(pb+".list","Simple list (optional)",p.list)}</div>
      <h3 style="margin:22px 0 10px">Button</h3><div class="formgrid">${fld(pb+".cta.label","Button label",p.cta?.label)}${fld(pb+".cta.href","Button link",p.cta?.href,"text","e.g. /about/contact")}</div>`}
    </div>`;
  }
  return shell("#/admin/pages/"+secId,inner);
}
function tile(m,opts={}){
  const u=blobUrl(m.thumb||m.id), t=m.contentType||"";
  const pv = t.startsWith("image/") ? `<img src="${esc(u)}" alt="${esc(m.alt||"")}" loading="lazy" decoding="async">` : t.startsWith("video/") ? `<video src="${esc(blobUrl(m.id))}" muted preload="metadata"></video>` : `<span class="muted">${esc((t.split("/")[1]||"file").toUpperCase())}</span>`;
  return `<div class="mitem${opts.pick?" pick":""}${opts.sel?" sel":""}" ${opts.pick?`data-act="pick" data-id="${esc(m.id)}" role="button" tabindex="0"`:""}><div class="pv">${pv}</div>
    <div class="meta"><b title="${esc(m.name)}">${esc(m.name)}</b><span class="muted">${esc(fmtSize(m.size))}${m.width?` · ${m.width}×${m.height}`:""}</span>
    ${opts.manage?`<div class="btnrow" style="margin-top:6px;gap:6px"><button class="iconbtn" data-act="copyurl" data-id="${esc(m.id)}">Copy link</button><button class="iconbtn" data-act="delmedia" data-id="${esc(m.id)}">Delete</button></div>`:""}</div></div>`;
}
function vMedia(){
  const f=S.mediaFilter; const list=libMedia().filter(m=>f==="all"||(m.contentType||"").startsWith(f));
  const cap = S.mode==="supabase"?"50 MB":S.mode==="cloud"?"20 MB":"2.5 MB";
  return shell("#/admin/media",`<h1>Media library</h1><p class="muted">Upload images, videos and PDFs to use in posts. Photos are resized and compressed automatically so they load fast on phones.</p>
    <div class="panel"><div class="drop-zone" id="dz"><p><b>Drop files here</b> or choose them from your device.</p>
      <label class="btn">Choose files<input type="file" id="fileinput" multiple accept="image/*,video/*,application/pdf" class="visually-hidden"></label>
      <p class="muted" style="font-size:14px;margin:10px 0 0">Up to ${cap} each. For video, export at 720p (MP4) to keep it light for mobile viewers.</p><p id="upmsg" role="status"></p></div></div>
    <nav class="tabs">${[["all","All"],["image/","Images"],["video/","Videos"],["application/pdf","Documents"]].map(([k,l])=>`<a href="#" data-act="mfilter" data-f="${k}" ${f===k?'aria-current="page"':""}>${l}</a>`).join("")}</nav>
    ${list.length?`<div class="mgrid">${list.map(m=>tile(m,{manage:true})).join("")}</div>`:`<div class="empty" style="margin-top:16px">No files yet. Upload your first image or video above.</div>`}`);
}
function vPosts(){
  return shell("#/admin/posts",`<div class="rowhead"><h1>Posts</h1><a class="btn" href="#/admin/posts/new">Write a post</a></div>
    <p class="muted">News, videos and photo galleries shown on the Media page and home page.</p>
    ${S.posts.length?`<div class="panel tablewrap"><table class="list"><thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Status</th></tr></thead><tbody>
    ${S.posts.map(p=>`<tr><td><a href="#/admin/posts/${esc(p.id)}">${esc(p.title||"Untitled")}</a></td><td>${esc(KINDS[p.kind]||"News")}</td><td class="muted">${esc(fmtDate(p.date))}</td><td>${p.published?`<span class="pill">Published</span>`:`<span class="pill draft">Draft</span>`}</td></tr>`).join("")}
    </tbody></table></div>`:`<div class="empty" style="margin-top:20px">No posts yet. <a href="#/admin/posts/new">Write the first one</a>.</div>`}`);
}
function vPostEdit(id){
  if(!S.postDraft || S.postDraft._for!==id){
    const ex = S.posts.find(p=>p.id===id);
    S.postDraft = ex ? {mediaIds:[],thumbs:{},...clone(ex),_for:id} : {_for:id,id:uid(),title:"",kind:"article",excerpt:"",body:"",coverId:"",videoId:"",mediaIds:[],thumbs:{},published:false,date:new Date().toISOString().slice(0,10)};
    S.postDirty=false;
  }
  const p=S.postDraft; const imgs=libMedia().filter(m=>(m.contentType||"").startsWith("image/")); const vids=libMedia().filter(m=>(m.contentType||"").startsWith("video/"));
  const chosen = mid=>{const m=S.media.find(x=>x.id===mid); return m?tile(m):`<span class="muted">None selected</span>`};
  const pool = S.pickFor==="video"?vids:imgs;
  const picker = S.pickFor ? `<div class="panel"><h2>Choose ${S.pickFor==="video"?"a video":S.pickFor==="gallery"?"gallery images":"a cover image"}</h2>
    ${pool.length?`<div class="mgrid">${pool.map(m=>tile(m,{pick:true,sel:S.pickFor==="gallery"?p.mediaIds.includes(m.id):(S.pickFor==="video"?p.videoId:p.coverId)===m.id})).join("")}</div>`:`<div class="empty">No ${S.pickFor==="video"?"videos":"images"} in the library. <a href="#/admin/media">Upload some first</a>.</div>`}
    <p style="margin-top:14px"><button class="btn small" data-act="pickdone">Done</button></p></div>` : "";
  const exists = S.posts.some(x=>x.id===p.id);
  return shell("#/admin/posts",`<p><a href="#/admin/posts">All posts</a></p><h1>${exists?"Edit post":"New post"}</h1>
    <div class="panel">
      <label class="f"><span>Title</span><input type="text" data-post="title" value="${esc(p.title)}"></label>
      <div class="formgrid"><label class="f"><span>Type</span><select data-post="kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${p.kind===k?"selected":""}>${v}</option>`).join("")}</select></label>
      <label class="f"><span>Date</span><input type="text" data-post="date" value="${esc(p.date)}" placeholder="YYYY-MM-DD"></label></div>
      <label class="f"><span>Summary</span><textarea style="min-height:70px" data-post="excerpt">${esc(p.excerpt)}</textarea></label>
      <label class="f"><span>Body</span><textarea style="min-height:220px" data-post="body">${esc(p.body)}</textarea><small class="muted">Blank line between paragraphs. Start lines with - for bullets, ## for a subheading.</small></label>
    </div>
    <div class="panel"><h2>Media</h2><div class="formgrid">
      <div><p><b>Cover image</b></p><div style="max-width:220px">${chosen(p.coverId)}</div><p style="margin-top:10px"><button class="btn small ghost" data-act="pickfor" data-for="cover">Choose cover</button> ${p.coverId?`<button class="iconbtn" data-act="clearmedia" data-f="coverId">Remove</button>`:""}</p></div>
      <div><p><b>Video</b></p><div style="max-width:220px">${chosen(p.videoId)}</div><p style="margin-top:10px"><button class="btn small ghost" data-act="pickfor" data-for="video">Choose video</button> ${p.videoId?`<button class="iconbtn" data-act="clearmedia" data-f="videoId">Remove</button>`:""}</p></div></div>
      <p style="margin-top:14px"><b>Gallery</b> <span class="muted">(${p.mediaIds.length} images)</span></p><button class="btn small ghost" data-act="pickfor" data-for="gallery">Choose gallery images</button></div>
    ${picker}
    <div class="panel btnrow" style="align-items:center">
      <label style="display:flex;gap:8px;align-items:center;margin-right:auto"><input type="checkbox" data-post="published" ${p.published?"checked":""}> Published on the website</label>
      ${exists?`<button class="btn small danger" data-act="delpost">${S.confirmDel?"Confirm delete":"Delete post"}</button>`:""}
      <button class="btn" data-act="savepost">Save post</button></div>`);
}
function vInquiries(){
  return shell("#/admin/inquiries",`<h1>Enquiries</h1><p class="muted">Messages sent through the contact form.</p>
    ${S.inquiries.length?S.inquiries.map(q=>`<div class="panel"><div class="rowhead"><div><b>${esc(q.name)}</b> <span class="muted">${esc(q.reach)}</span><br><span class="pill">${esc(q.audience)}</span> <span class="muted" style="font-size:14px">${esc(fmtDate(q.createdAt))}</span>${q.handled?` <span class="pill draft">Handled</span>`:""}</div>
      <div class="btnrow" style="gap:6px"><button class="iconbtn" data-act="handle" data-id="${esc(q.id)}">${q.handled?"Mark as open":"Mark as handled"}</button><button class="iconbtn" data-act="delinq" data-id="${esc(q.id)}">Delete</button></div></div>
      <p style="margin:12px 0 0;white-space:pre-wrap">${esc(q.message)}</p></div>`).join(""):`<div class="empty" style="margin-top:20px">No enquiries yet. They appear here when someone uses the contact form.</div>`}`);
}
function vLogin(){
  return `<div class="login"><form class="panel" id="loginform">${logoImg(true)}<h1>Sign in to the portal</h1>
    <p class="muted" style="font-size:15px">For Rays website editors.</p>
    <label class="f"><span>Email</span><input type="email" name="email" required autocomplete="username"></label>
    <label class="f"><span>Password</span><input type="password" name="password" required autocomplete="current-password"></label>
    <p id="loginmsg" role="status" class="muted"></p>
    <button class="btn block-btn" type="submit">Sign in</button>
    <p style="margin-top:14px;font-size:15px"><a href="#/">Back to the website</a></p></form></div>`;
}

/* ================= portal: policies, careers, help, branches, downloads, calculator ================= */
const APP_STATUS = {new:"New",review:"In review",shortlisted:"Shortlisted",interview:"Interview",offer:"Offer",hired:"Hired",rejected:"Not progressing"};
function objList(path, arr, fields, addLbl, tpl){
  return `${(arr||[]).map((x,i)=>`<div class="objrow">
      <div class="objfields">${fields.map(f=>{
        const p=`${path}.${i}.${f.k}`, v=x[f.k];
        if(f.type==="area") return `<label class="f ${f.wide?"wide":""}"><span>${esc(f.label)}</span><textarea data-bind="${p}">${esc(v)}</textarea></label>`;
        if(f.type==="select") return `<label class="f"><span>${esc(f.label)}</span><select data-bind="${p}">${f.options.map(([ov,ol])=>`<option value="${esc(ov)}" ${String(v??"")===ov?"selected":""}>${esc(ol)}</option>`).join("")}</select></label>`;
        return `<label class="f ${f.wide?"wide":""}"><span>${esc(f.label)}</span><input type="text" data-bind="${p}" value="${esc(v)}" ${f.ph?`placeholder="${esc(f.ph)}"`:""}></label>`;
      }).join("")}</div>
      <button class="iconbtn" data-act="rm" data-path="${path}" data-i="${i}">Remove</button></div>`).join("")}
    <button class="btn small ghost" data-act="addtpl" data-path="${path}" data-tpl="${esc(JSON.stringify(tpl))}">${esc(addLbl)}</button>`;
}
function vFaqs(){
  const d=ensureDraft(); d.faqs=d.faqs||[];
  return shell("#/admin/faqs",`<h1>Help and FAQs</h1><p class="muted">Shown on <a href="#/about/help">About → Help and FAQs</a>, grouped by category, and included in site search and Google results.</p>
    <div class="panel">${objList("faqs",d.faqs,[{k:"q",label:"Question",wide:true},{k:"category",label:"Category",ph:"e.g. Accounts"},{k:"a",label:"Answer",type:"area",wide:true}],"Add question",{q:"",a:"",category:""})}</div>`);
}
function vBranches(){
  const d=ensureDraft(); d.branches=d.branches||[];
  const T=[["branch","Branch"],["agent","Agent"],["atm","ATM"],["merchant","Merchant"]];
  return shell("#/admin/branches",`<h1>Branches and agents</h1><p class="muted">Shown on <a href="#/about/locations">About → Branches and agents</a>. Visitors can filter by town and type, call, and get directions. Latitude and longitude are optional; without them, directions search by name and address.</p>
    <div class="panel">${objList("branches",d.branches,[{k:"name",label:"Name"},{k:"type",label:"Type",type:"select",options:T},{k:"city",label:"City or town"},{k:"region",label:"Region"},{k:"address",label:"Address",wide:true},{k:"phone",label:"Phone"},{k:"hours",label:"Opening hours"},{k:"lat",label:"Latitude",ph:"9.0108"},{k:"lng",label:"Longitude",ph:"38.7613"}],"Add location",{name:"",type:"branch",city:"",region:"",address:"",phone:"",hours:"",lat:"",lng:""})}</div>`);
}
function vDownloads(){
  const d=ensureDraft(); d.downloads=d.downloads||[];
  const docs=libMedia().filter(m=>!/^video\//.test(m.contentType||""));
  const opts=[["","Choose a file…"],...docs.map(m=>[m.id,m.name])];
  return shell("#/admin/downloads",`<h1>Downloads</h1><p class="muted">Forms, tariff guides, annual reports and brochures on <a href="#/about/downloads">About → Downloads</a>. Upload the file to the <a href="#/admin/media">media library</a> first, then pick it here.</p>
    <div class="panel">${objList("downloads",d.downloads,[{k:"title",label:"Title",wide:true},{k:"category",label:"Category",ph:"Forms, Tariffs, Reports"},{k:"mediaId",label:"File",type:"select",options:opts},{k:"format",label:"Format",ph:"PDF"},{k:"size",label:"Size shown",ph:"e.g. 240 KB"}],"Add document",{title:"",category:"",mediaId:"",format:"PDF",size:""})}</div>`);
}
function vCalc(){
  const d=ensureDraft(); d.calculator=d.calculator||{enabled:false,minMonths:3,maxMonths:36};
  const c=d.calculator;
  return shell("#/admin/calculator",`<h1>Financing calculator</h1><p class="muted">An indicative instalment estimate on the eMurabaha and Murabaha pages. It uses a fixed profit margin on the amount financed, spread evenly over the period.</p>
    <div class="panel"><label class="check"><input type="checkbox" data-bind="calculator.enabled" ${c.enabled?"checked":""}> Show the calculator on financing pages</label>
      <div class="formgrid">${fld("calculator.profitRate","Indicative profit rate (% per year)",c.profitRate??"")}${fld("calculator.minMonths","Shortest period (months)",c.minMonths)}${fld("calculator.maxMonths","Longest period (months)",c.maxMonths)}</div>
      ${fld("calculator.note","Note shown under the calculator",c.note,"area")}
      ${!(+c.profitRate>0)?`<p class="note">Set an indicative profit rate, approved by your finance and Sharia teams, before you switch the calculator on.</p>`:""}</div>`);
}
function vPolicies(id){
  const d=ensureDraft(); d.policies=d.policies||[];
  const i=id?d.policies.findIndex(p=>p.id===id):-1;
  if(i<0) return shell("#/admin/policies",`<div class="rowhead"><h1>Policies</h1><button class="btn" data-act="addpolicy">Add policy</button></div>
    <p class="muted">Shown under <a href="#/legal">Legal</a> and in the footer of every page.</p>
    <p class="note">These policies are drafts. Have Rays legal and compliance review each one, fill in the [bracketed] details, then tick "Reviewed".</p>
    <div class="panel tablewrap"><table class="list"><thead><tr><th>Policy</th><th>Last updated</th><th>Status</th><th></th></tr></thead><tbody>
    ${d.policies.map((p,k)=>`<tr><td><a href="#/admin/policies/${esc(p.id)}">${esc(p.title)}</a></td><td class="muted">${esc(fmtDate(p.updated))}</td>
      <td>${p.published===false?`<span class="pill draft">Hidden</span>`:`<span class="pill">Published</span>`} ${p.reviewed?`<span class="pill">Reviewed</span>`:`<span class="pill draft">Needs review</span>`}</td>
      <td style="white-space:nowrap">${k>0?`<button class="iconbtn" data-act="moveitem" data-path="policies" data-i="${k}" data-dir="-1">Up</button>`:""}</td></tr>`).join("")}</tbody></table></div>`);
  const p=d.policies[i], b=`policies.${i}`;
  return shell("#/admin/policies",`<p><a href="#/admin/policies">All policies</a></p><h1>${esc(p.title)}</h1>
    <p class="muted">Live at <a href="#/legal/${esc(p.id)}">/legal/${esc(p.id)}</a></p>
    <div class="panel">${fld(b+".title","Title",p.title)}${fld(b+".summary","One-line summary",p.summary)}${fld(b+".updated","Last updated (YYYY-MM-DD)",p.updated)}
      <label class="check"><input type="checkbox" data-bind="${b}.published" ${p.published!==false?"checked":""}> Published on the website</label>
      <label class="check"><input type="checkbox" data-bind="${b}.reviewed" ${p.reviewed?"checked":""}> Reviewed by legal and compliance</label></div>
    <div class="panel">${fld(b+".body","Policy text",p.body,"area","## for a heading, - for bullets, 1. for numbered steps, **text** for bold, and a blank line between paragraphs.")}</div>
    <div class="panel btnrow"><button class="btn small danger" data-act="rmitem" data-path="policies" data-i="${i}" data-back="/admin/policies">Delete policy</button></div>`);
}
function vJobs(id){
  const d=ensureDraft(); d.jobs=d.jobs||[];
  const S_=[["draft","Draft (hidden)"],["open","Open for applications"],["closed","Closed"]];
  const i=id?d.jobs.findIndex(j=>j.id===id):-1;
  const count = jid => S.applications.filter(a=>a.jobId===jid).length;
  if(i<0) return shell("#/admin/jobs",`<div class="rowhead"><h1>Jobs</h1><button class="btn" data-act="addjob">Add job</button></div>
    <p class="muted">Open roles appear on <a href="#/about/careers">About → Careers</a>. Applications arrive under <a href="#/admin/applications">Applications</a>.</p>
    ${d.jobs.length?`<div class="panel tablewrap"><table class="list"><thead><tr><th>Role</th><th>Status</th><th>Closes</th><th>Applications</th></tr></thead><tbody>
    ${d.jobs.map(j=>`<tr><td><a href="#/admin/jobs/${esc(j.id)}">${esc(j.title||"Untitled")}</a><br><span class="muted small">${esc([j.department,j.location].filter(Boolean).join(" · "))}</span></td>
      <td><span class="pill ${j.status==="open"?"":"draft"}">${esc((S_.find(x=>x[0]===j.status)||S_[0])[1])}</span></td><td class="muted">${j.closes?esc(fmtDate(j.closes)):"–"}</td>
      <td><button class="iconbtn" data-act="appfilter" data-job="${esc(j.id)}">${count(j.id)} view</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No jobs yet. Add your first opening.</div>`}`);
  const j=d.jobs[i], b=`jobs.${i}`;
  return shell("#/admin/jobs",`<p><a href="#/admin/jobs">All jobs</a></p><h1>${esc(j.title||"New job")}</h1>
    <div class="panel">${fld(b+".title","Job title",j.title)}
      <div class="formgrid">${fld(b+".department","Department",j.department)}${fld(b+".location","Location",j.location)}${fld(b+".type","Type",j.type,"text","Full-time, contract, internship…")}${fld(b+".closes","Closing date (YYYY-MM-DD)",j.closes,"text","Leave empty for no closing date")}</div>
      <label class="f"><span>Status</span><select data-bind="${b}.status">${S_.map(([v,l])=>`<option value="${v}" ${j.status===v?"selected":""}>${l}</option>`).join("")}</select></label>
      ${fld(b+".summary","Short summary",j.summary,"area")}</div>
    <div class="panel">${fld(b+".body","Full description",j.body,"area","Use ## for headings like 'What you'll do', and - for bullet points.")}</div>
    <div class="panel btnrow"><a class="btn small ghost" href="#/about/careers/${esc(j.id)}">Preview listing</a><button class="btn small danger" data-act="rmitem" data-path="jobs" data-i="${i}" data-back="/admin/jobs">Delete job</button></div>`);
}
function vApplications(){
  const jobF = S.appJob || "";
  const stF = S.appStatus || "";
  const jobs=site()?.jobs||[];
  const list=S.applications.filter(a=>(!jobF||a.jobId===jobF)&&(!stF||a.status===stF));
  return shell("#/admin/applications",`<h1>Applications</h1><p class="muted">CVs are stored privately. Only portal editors can open them, through a link that expires after a few minutes.</p>
    <div class="panel formgrid"><label class="f"><span>Role</span><select id="appjob"><option value="">All roles</option><option value="open" ${jobF==="open"?"selected":""}>Open applications</option>${jobs.map(j=>`<option value="${esc(j.id)}" ${jobF===j.id?"selected":""}>${esc(j.title)}</option>`).join("")}</select></label>
      <label class="f"><span>Stage</span><select id="appstatus"><option value="">All stages</option>${Object.entries(APP_STATUS).map(([k,v])=>`<option value="${k}" ${stF===k?"selected":""}>${v}</option>`).join("")}</select></label></div>
    ${list.length?list.map(a=>`<div class="panel"><div class="rowhead"><div><b>${esc(a.name)}</b> <span class="muted">${esc(a.jobTitle||"Open application")}</span><br>
        <span class="small"><a href="mailto:${esc(a.email)}">${esc(a.email)}</a> · <a href="tel:${esc(a.phone)}">${esc(a.phone)}</a> · ${esc(fmtDate(a.createdAt))}</span></div>
      <div class="btnrow" style="gap:6px;align-items:center"><select data-appstatus="${esc(a.id)}" aria-label="Stage">${Object.entries(APP_STATUS).map(([k,v])=>`<option value="${k}" ${a.status===k?"selected":""}>${v}</option>`).join("")}</select>
        ${a.cvPath||a.cvData||a.cvLink?`<button class="btn small" data-act="cv" data-id="${esc(a.id)}">Open CV</button>`:""}<button class="iconbtn" data-act="delapp" data-id="${esc(a.id)}">Delete</button></div></div>
      ${a.message?`<p style="margin:12px 0 0;white-space:pre-wrap">${esc(a.message)}</p>`:""}</div>`).join(""):`<div class="empty" style="margin-top:20px">No applications${jobF||stF?" match these filters":" yet"}.</div>`}`);
}

/* ================= render ================= */
function renderAdmin(app,r,scrollTop){
  if(!ready){ app.innerHTML=`<div class="loading">Opening the portal…</div>`; ready=init().then(()=>render(scrollTop)).catch(e=>{ console.error(e); app.innerHTML=`<div class="loading">The portal couldn't connect. Check your connection and refresh.</div>`; }); return; }
  if(!S.canEdit){
    if(S.mode==="supabase" && !S.session){ app.innerHTML=toPaths(vLogin()); $("#loginform").addEventListener("submit",submitLogin); return; }
    app.innerHTML = toPaths((site()?header():"")+`<section class="block"><div class="wrap"><h1 class="nf">The portal is for site editors.</h1><p class="lead" style="margin-top:12px">This account doesn't have edit access. Ask an administrator to add you. <a href="#/">Back to the website</a></p>${S.mode==="supabase"?`<p><button class="btn ghost" data-act="signout">Sign out</button></p>`:""}</div></section>`);
    return;
  }
  let html;
  switch(r[1]){
    case "home": html=vHome(); break;
    case "stats": html=vStats(); break;
    case "settings": html=vSettings(); break;
    case "pages": html=vSection(r[2],r[3]); break;
    case "media": html=vMedia(); break;
    case "posts": html= r[2] ? vPostEdit(r[2]==="new" ? (S.newId ||= "new-"+uid()) : r[2]) : vPosts(); break;
    case "inquiries": html=vInquiries(); break;
    case "faqs": html=vFaqs(); break;
    case "branches": html=vBranches(); break;
    case "downloads": html=vDownloads(); break;
    case "calculator": html=vCalc(); break;
    case "policies": html=vPolicies(r[2]); break;
    case "jobs": html=vJobs(r[2]); break;
    case "applications": html=vApplications(); break;
    default: html=vOverview();
  }
  app.innerHTML=toPaths(html); bindUploads();
  if(scrollTop){ if(r[3]) $("#pageedit")?.scrollIntoView(); else window.scrollTo(0,0); }
}

/* ================= interactions ================= */
function setPath(obj,path,val){ const ks=path.split("."); let o=obj; for(let i=0;i<ks.length-1;i++){ const k=ks[i]; if(o[k]==null||typeof o[k]!=="object") o[k]= /^\d+$/.test(ks[i+1])?[]:{}; o=o[k]; } o[ks.at(-1)]=val; }
function getPath(obj,path){ return path.split(".").reduce((o,k)=>o==null?undefined:o[k],obj); }
function markDirty(){ S.dirty=true; $("#savebar")?.classList.add("show"); }
function bindUploads(){
  const dz=$("#dz"), fi=$("#fileinput");
  if(fi) fi.addEventListener("change",()=>uploadFiles(fi.files));
  if(dz){ ["dragenter","dragover"].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.add("over")}));
    ["dragleave","drop"].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.remove("over")}));
    dz.addEventListener("drop",ev=>uploadFiles(ev.dataTransfer.files)); }
}
async function uploadFiles(files){
  const msg=$("#upmsg"); const arr=[...files]; let ok=0; const errs=[];
  for(const [i,f] of arr.entries()){ if(msg) msg.textContent=`Optimising and uploading ${i+1} of ${arr.length}: ${f.name}`;
    try{ await store.upload(f); ok++; }catch(e){ errs.push(e?.message || `${f.name} couldn't be uploaded. Check the file type and size.`); } }
  await store.afterUpload();
  if(S.mode!=="cloud") render(false);
  const m=$("#upmsg"); if(m) m.textContent=(ok?`Uploaded ${ok} file${ok>1?"s":""}. `:"")+errs.join(" ");
  if(ok) toast(`Uploaded ${ok} file${ok>1?"s":""}`);
}
async function submitLogin(e){
  e.preventDefault(); const fd=new FormData(e.target), msg=$("#loginmsg"), btn=e.target.querySelector("button");
  btn.disabled=true; msg.textContent="Signing in…";
  const { data, error } = await S.sb.auth.signInWithPassword({ email:fd.get("email"), password:fd.get("password") });
  if(error){ msg.textContent = "Sign-in failed: "+error.message; btn.disabled=false; return; }
  await setSession(data.session); await sbLoad(); render(false);
}

document.addEventListener("input",e=>{
  const t=e.target;
  if(t.dataset.bind){ setPath(ensureDraft(),t.dataset.bind,t.type==="checkbox"?t.checked:t.value); markDirty(); }
  else if(t.dataset.lines){ setPath(ensureDraft(),t.dataset.lines,t.value.split("\n").map(x=>x.trim()).filter(Boolean)); markDirty(); }
  else if(t.dataset.post){ S.postDraft[t.dataset.post] = t.type==="checkbox" ? t.checked : t.value; S.postDirty=true; }
});
document.addEventListener("change",async e=>{ const t=e.target;
  if(t.dataset.bind && (t.type==="checkbox"||t.tagName==="SELECT")){ setPath(ensureDraft(),t.dataset.bind,t.type==="checkbox"?t.checked:t.value); markDirty(); }
  if(t.id==="appjob"){ S.appJob=t.value; render(false); }
  if(t.id==="appstatus"){ S.appStatus=t.value; render(false); }
  if(t.dataset.appstatus){ try{ await store.setAppStatus(t.dataset.appstatus,t.value); toast("Stage updated"); }catch(err){ toast("Couldn't update the stage."); } }
  if(t.dataset.post){ S.postDraft[t.dataset.post]= t.type==="checkbox"?t.checked:t.value; S.postDirty=true; } });
document.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ") && e.target.matches?.("[data-act=pick]")){ e.preventDefault(); e.target.click(); } });

async function act(a,e){
  const act=a.dataset.act;
  switch(act){
    case "appfilter": S.appJob=a.dataset.job; S.appStatus=""; nav("/admin/applications"); break;
    case "addtpl": { const arr=getPath(ensureDraft(),a.dataset.path)||[]; arr.push(JSON.parse(a.dataset.tpl)); setPath(S.draft,a.dataset.path,arr); markDirty(); render(false); break; }
    case "moveitem": { const arr=getPath(ensureDraft(),a.dataset.path); const i=+a.dataset.i, j=i+(+a.dataset.dir); [arr[i],arr[j]]=[arr[j],arr[i]]; markDirty(); render(false); break; }
    case "rmitem": { if(a.dataset.confirm!=="1"){ a.dataset.confirm="1"; a.textContent="Confirm delete"; return; } getPath(ensureDraft(),a.dataset.path).splice(+a.dataset.i,1); markDirty(); nav(a.dataset.back); break; }
    case "addpolicy": { const d=ensureDraft(); d.policies=d.policies||[]; const id=slug("policy-"+uid()); d.policies.push({id,title:"New policy",summary:"",updated:new Date().toISOString().slice(0,10),published:false,reviewed:false,body:""}); markDirty(); nav("/admin/policies/"+id); break; }
    case "addjob": { const d=ensureDraft(); d.jobs=d.jobs||[]; const id=slug("job-"+uid()); d.jobs.unshift({id,title:"",department:"",location:"Addis Ababa",type:"Full-time",closes:"",status:"draft",summary:"",body:""}); markDirty(); nav("/admin/jobs/"+id); break; }
    case "cv": { const app=S.applications.find(x=>x.id===a.dataset.id); const w=window.open("","_blank"); try{ const u=await store.cvUrl(app); if(w) w.location=u; else location.href=u; }catch(err){ w?.close(); toast("The CV couldn't be opened. Try again."); } break; }
    case "delapp": if(a.dataset.confirm!=="1"){ a.dataset.confirm="1"; a.textContent="Confirm"; return; } try{ await store.deleteApp(a.dataset.id); if(S.mode!=="cloud") render(false); toast("Application deleted"); }catch(err){ toast("Couldn't delete. Try again."); } break;
    case "signout": await S.sb?.auth.signOut(); S.canEdit=false; S.session=null; S.maybeEditor=false; nav("/"); break;
    case "save-site": {
      a.disabled=true; a.textContent="Saving…";
      try{ await store.saveSite(clone(S.draft)); S.dirty=false; S.draft=null; toast("Changes saved"); render(false); }
      catch(err){ a.disabled=false; a.textContent="Save changes"; toast(err?.code==="invalid_argument"||err?.code==="42501"?"You don't have permission to save, or the content is too large.":"Changes couldn't be saved. Try again."); }
      break; }
    case "discard": S.draft=null; S.dirty=false; render(false); break;
    case "starter": {
      const m=$("#startermsg"); a.disabled=true; if(m) m.textContent="Loading starter content…";
      try{ const res=await fetch("/content.json",{cache:"no-store"}); if(!res.ok) throw new Error(); await store.saveSite(await res.json()); S.draft=null; S.dirty=false; toast("Starter content loaded"); render(false); }
      catch(err){ a.disabled=false; if(m) m.textContent="content.json couldn't be loaded. Make sure it's deployed next to index.html."; }
      break; }
    case "blank-site": S.draft={brand:{name:"Rays Microfinance",short:"Rays",tagline:"",motto:"Bank with us. Finance with us. Build with us.",meaning:"",domain:"raysfinance.com"},home:{capabilities:[]},stats:[],sections:[],contact:{},languages:["English"]}; markDirty(); nav("/admin/settings"); break;
    case "add": { const arr=getPath(ensureDraft(),a.dataset.path)||[]; const shape=a.dataset.shape; arr.push(shape==="stat"?{value:"",label:""}:shape==="link"?{title:"",text:"",href:""}:{title:"",text:""}); setPath(S.draft,a.dataset.path,arr); markDirty(); render(false); break; }
    case "rm": { const arr=getPath(ensureDraft(),a.dataset.path); arr.splice(+a.dataset.i,1); markDirty();
      if(/\.pages$/.test(a.dataset.path)){ nav("/admin/pages/"+route()[2]); } else render(false); break; }
    case "move": { const pages=ensureDraft().sections[+a.dataset.si].pages; const i=+a.dataset.i, j=i+(+a.dataset.dir); [pages[i],pages[j]]=[pages[j],pages[i]]; markDirty(); render(false); break; }
    case "addpage": { const name=$("#newpage")?.value.trim(); if(!name){ $("#newpage")?.focus(); return; } const sec=ensureDraft().sections[+a.dataset.si]; let id=slug(name); while(sec.pages.some(p=>p.id===id)) id+="-2"; sec.pages.push({id,title:name,lead:"",body:"",features:[]}); markDirty(); nav(`/admin/pages/${sec.id}/${id}`); break; }
    case "unlink": { const pg=getPath(ensureDraft(),a.dataset.path); const [x,y]=pg.ref.split("/"); const src=findPage(x,y); Object.assign(pg,clone(src?.page||{}),{id:pg.id,title:pg.title}); delete pg.ref; markDirty(); render(false); break; }
    case "mfilter": e.preventDefault(); S.mediaFilter=a.dataset.f; render(false); break;
    case "copyurl": { const u=new URL(blobUrl(a.dataset.id),location.href).href; try{ await navigator.clipboard.writeText(u); toast("Link copied"); }catch(err){ toast(u); } break; }
    case "delmedia": {
      if(a.dataset.confirm!=="1"){ a.dataset.confirm="1"; a.textContent="Confirm"; return; }
      const id=a.dataset.id; const used=S.posts.filter(p=>p.coverId===id||p.videoId===id||(p.mediaIds||[]).includes(id));
      try{ await store.deleteMedia(id);
        for(const p of used){ const th={...(p.thumbs||{})}; delete th[id]; await store.savePost({...p,thumbs:th,coverId:p.coverId===id?"":p.coverId,videoId:p.videoId===id?"":p.videoId,mediaIds:(p.mediaIds||[]).filter(x=>x!==id)}); }
        toast(used.length?`Deleted and removed from ${used.length} post${used.length>1?"s":""}`:"Deleted"); if(S.mode!=="cloud") render(false);
      }catch(err){ toast("The file couldn't be deleted. Try again."); }
      break; }
    case "pickfor": S.pickFor=a.dataset.for; render(false); break;
    case "pickdone": S.pickFor=null; render(false); break;
    case "pick": { const p=S.postDraft, id=a.dataset.id, m=S.media.find(x=>x.id===id);
      p.thumbs=p.thumbs||{}; if(m?.thumb) p.thumbs[id]=m.thumb;
      if(S.pickFor==="gallery"){ p.mediaIds = p.mediaIds.includes(id)? p.mediaIds.filter(x=>x!==id) : [...p.mediaIds,id]; }
      else if(S.pickFor==="video"){ p.videoId=id; S.pickFor=null; }
      else { p.coverId=id; p.coverW=m?.width||null; p.coverH=m?.height||null; S.pickFor=null; }
      S.postDirty=true; render(false); break; }
    case "clearmedia": S.postDraft[a.dataset.f]=""; S.postDirty=true; render(false); break;
    case "savepost": { const p=S.postDraft; if(!p.title.trim()){ toast("Add a title before saving."); $("[data-post=title]")?.focus(); return; }
      const {_for,...clean}=p; a.disabled=true;
      try{ await store.savePost(clean); S.postDirty=false; S.newId=null; toast(p.published?"Post published":"Draft saved"); S.postDraft={...clean,_for:clean.id}; nav("/admin/posts/"+clean.id,true); }
      catch(err){ a.disabled=false; toast("The post couldn't be saved. Try again."); }
      break; }
    case "delpost": if(!S.confirmDel){ S.confirmDel=true; render(false); setTimeout(()=>{S.confirmDel=false},4000); return; }
      try{ await store.deletePost(S.postDraft.id); S.confirmDel=false; S.postDraft=null; S.postDirty=false; toast("Post deleted"); nav("/admin/posts"); }catch(err){ toast("The post couldn't be deleted."); } break;
    case "handle": { const q=S.inquiries.find(x=>x.id===a.dataset.id); try{ await store.setHandled(q.id,!q.handled); if(S.mode!=="cloud") render(false);}catch(err){toast("Couldn't update. Try again.")} break; }
    case "delinq": if(a.dataset.confirm!=="1"){ a.dataset.confirm="1"; a.textContent="Confirm"; return; } try{ await store.deleteInquiry(a.dataset.id); if(S.mode!=="cloud") render(false);}catch(err){toast("Couldn't delete. Try again.")} break;
  }
}

window.RaysAdmin = {
  render: renderAdmin, act,
  onRoute(){ if(!curPath().startsWith("/admin/posts/")){ S.postDraft=null; S.postDirty=false; S.newId=null; } }
};
