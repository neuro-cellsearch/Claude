#!/usr/bin/env python3
"""
Builds a single-file, self-contained STATIC PREVIEW of the public website from a
running instance (default http://localhost:3000). Used to share the design without
hosting the app. Forms, booking and chat need the server and are disabled in the preview.

Usage: python3 scripts/build-static-preview.py [base_url] [out_file]
"""
import base64, re, sys, urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "site-preview/index.html"

SERVICES = ["ai-receptionist", "ai-website-chatbot", "lead-generation-automation",
            "appointment-booking-automation", "crm-automation", "business-workflow-automation"]
INDUSTRIES = ["roofing-construction", "estate-agents", "dental-practices", "recruitment-agencies",
              "gyms-fitness", "restaurants-hospitality", "automotive", "professional-services"]
PAGES = (["/", "/services"] + [f"/services/{s}" for s in SERVICES] + ["/industries"] +
         [f"/industries/{i}" for i in INDUSTRIES] +
         ["/pricing", "/case-studies", "/about", "/contact", "/book", "/quote", "/privacy", "/terms"])
APP_ROUTES = ("/login", "/register", "/portal", "/admin", "/forgot-password")


def get(path: str) -> bytes:
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return r.read()


def slug(path: str) -> str:
    p = path.split("?")[0].split("#")[0].strip("/")
    return "home" if not p else p.replace("/", "-")


def rewrite_links(html: str) -> str:
    def repl(m):
        href = m.group(1)
        if href.startswith(APP_ROUTES):
            return 'href="#app"'
        if href.startswith("/") and not href.startswith("//"):
            return f'href="#{slug(href)}"'
        return m.group(0)
    return re.sub(r'href="([^"]*)"', repl, html)


def scope_ids(html: str, prefix: str) -> str:
    """Prefix element ids/label targets per page so the combined document has unique ids."""
    html = re.sub(r'\bid="(?!(?:demo|home-book)")([^"]+)"', lambda m: f'id="{prefix}-{m.group(1)}"', html)
    return re.sub(r'\bfor="([^"]+)"', lambda m: f'for="{prefix}-{m.group(1)}"', html)


def extract(html: str, tag: str) -> str:
    m = re.search(rf"<{tag}\b[^>]*>.*?</{tag}>", html, re.S)
    if not m:
        raise SystemExit(f"<{tag}> not found")
    return m.group(0)


home = get("/").decode()
header = rewrite_links(extract(home, "header"))
footer = rewrite_links(extract(home, "footer"))

# Stylesheets, with fonts inlined as data: URIs (the artifact host blocks external files).
css = ""
for href in dict.fromkeys(re.findall(r'<link rel="stylesheet" href="([^"]+)"', home)):
    text = get(href).decode()
    def font(m):
        url = m.group(1)
        path = "/_next/static/" + url.split("../")[-1] if url.startswith("../") else url
        data = base64.b64encode(get(path)).decode()
        return f'url(data:font/woff2;base64,{data})'
    css += re.sub(r'url\(([^)]+\.woff2)\)', font, text)

sections = []
for path in PAGES:
    html = get(path).decode()
    main = extract(html, "main")
    main = re.sub(r"<script\b.*?</script>", "", main, flags=re.S)
    main = main.replace('id="book"', 'id="home-book"') if path == "/" else main
    main = main.replace("Loading availability…", "Live availability loads from the booking calendar in the full app.")
    page = slug(path)
    main = scope_ids(rewrite_links(main), page)
    inner = re.sub(r"^<main\b[^>]*>|</main>$", "", main.strip())
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    sections.append(f'<section class="pv-page" data-page="{page}" data-title="{title}" hidden>{inner}</section>')

app_note = '''<section class="pv-page" data-page="app" data-title="Client portal · Kairo Systems" hidden>
<div class="mx-auto max-w-2xl px-5 py-28 text-center"><p class="eyebrow">Full application</p>
<h1 class="mt-4 text-4xl font-semibold tracking-tight text-fg">Client portal and admin dashboard</h1>
<p class="mt-5 text-muted">Sign-in, the client portal and the admin dashboard run on the full Next.js + Supabase application,
so they aren't part of this static website preview. See the repository README to run it locally or deploy it.</p>
<a href="#home" class="mt-8 inline-flex h-12 items-center rounded-lg bg-signal-500 px-6 text-sm font-medium text-white">Back to the website</a></div></section>'''

head_html = '''<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kairo Systems — website preview</title><style>''' + css + '''
.pv-banner{position:relative;z-index:60;background:#2f7bff;color:#fff;font:500 13px/1.4 var(--font-sans);text-align:center;padding:7px 14px}
.pv-toast{margin-top:12px;border:1px solid rgba(242,181,68,.35);background:rgba(242,181,68,.1);color:#f2b544;border-radius:10px;padding:10px 12px;font-size:13px}
.pv-mnav{border-top:1px solid var(--color-line);background:var(--color-ink-950);padding:8px 20px 24px}
.pv-mnav a{display:block;padding:12px 0;border-bottom:1px solid rgba(35,42,53,.6);color:var(--color-fg);font-size:15px}
@media(min-width:1024px){.pv-mnav{display:none}}
.pv-chat{position:fixed;right:20px;bottom:20px;z-index:50;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
.pv-chat-panel{width:min(340px,calc(100vw - 40px));background:var(--color-ink-900);border:1px solid var(--color-line-strong);border-radius:16px;padding:16px;font-size:13.5px;color:var(--color-muted)}
.pv-chat-btn{height:52px;border-radius:999px;background:#2f7bff;color:#fff;border:0;padding:0 20px;font:500 14px var(--font-sans);box-shadow:0 10px 40px -10px rgba(47,123,255,.8);cursor:pointer}
</style></head><body class="min-h-dvh">
<div class="pv-banner" role="note">Website preview · forms, booking and the AI assistant work in the full app</div>'''

script = r'''<script>{
const pages=[...document.querySelectorAll('.pv-page')];
function show(){
  const h=location.hash.slice(1)||'home';
  const target=pages.find(p=>p.dataset.page===h);
  if(target){pages.forEach(p=>p.hidden=p!==target);document.title=target.dataset.title;window.scrollTo(0,0);closeMenu();mark(h);return;}
  const el=document.getElementById(h);
  if(el){const page=el.closest('.pv-page');if(page&&page.hidden){pages.forEach(p=>p.hidden=p!==page);}el.scrollIntoView();}
  else{pages.forEach(p=>p.hidden=p.dataset.page!=='home');}
}
function mark(h){document.querySelectorAll('header nav a').forEach(a=>{const on=h.startsWith(a.getAttribute('href').slice(1));a.classList.toggle('text-fg',on);a.classList.toggle('text-muted',!on);});}
window.addEventListener('hashchange',show);

/* Mobile menu */
const header=document.querySelector('header');
const toggle=header.querySelector('button[aria-label="Toggle menu"]');
let menu=null;
function closeMenu(){if(menu){menu.remove();menu=null;toggle&&toggle.setAttribute('aria-expanded','false');}}
if(toggle){toggle.addEventListener('click',()=>{
  if(menu){closeMenu();return;}
  menu=document.createElement('nav');menu.className='pv-mnav';menu.setAttribute('aria-label','Mobile');
  const links=[...header.querySelectorAll('nav a')].map(a=>'<a href="'+a.getAttribute('href')+'">'+a.textContent+'</a>').join('');
  menu.innerHTML=links+'<a href="#book" style="color:#8cbcff">Book a consultation</a><a href="#app">Client login</a>';
  header.appendChild(menu);toggle.setAttribute('aria-expanded','true');
});}

/* Forms need the server */
document.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target;
  if(f.querySelector('.pv-toast'))return;
  const n=document.createElement('p');n.className='pv-toast';n.setAttribute('role','status');
  n.textContent='Preview only: this form submits to the Kairo server in the full app (validation, rate limiting, CRM record and notifications).';
  f.appendChild(n);
});

/* Chat assistant placeholder */
const chat=document.createElement('div');chat.className='pv-chat no-print';
chat.innerHTML='<div class="pv-chat-panel" hidden><strong style="color:#eef1f6">Kairo assistant</strong><p style="margin-top:6px">In the full app this is an AI assistant answering from approved facts and capturing leads with consent. It needs the server and an OpenAI key, so it is off in this preview.</p></div><button class="pv-chat-btn" aria-label="Open chat assistant">Ask Kairo</button>';
document.body.appendChild(chat);
chat.querySelector('button').addEventListener('click',()=>{const p=chat.querySelector('.pv-chat-panel');p.hidden=!p.hidden;});

/* Interactive workflow demo (same behaviour as the app component) */
const S={
 roofing:{label:'Roofing',channel:'Missed call → SMS reply',time:'Sat 18:42',message:"Hi, we've got water coming through the ceiling after the storm. Can someone look at the roof this week? It's a 3-bed semi in Leeds.",fields:[['Service','Storm damage / leak'],['Location','Leeds, LS6'],['Urgency','High — active leak'],['Property','3-bed semi']],score:86,booking:'Survey · Mon 08:30',notify:'SMS to on-call roofer + job sheet emailed'},
 estate:{label:'Estate agent',channel:'Rightmove enquiry',time:'Sun 21:15',message:"Interested in the 2-bed flat on Park Road. We're first-time buyers with a mortgage agreement in principle. Can we view this week?",fields:[['Property','2-bed flat, Park Road'],['Position','First-time buyer'],['Finance','AIP in place'],['Intent','Viewing request']],score:91,booking:'Viewing · Tue 17:30',notify:'Negotiator notified; vendor update queued'},
 dental:{label:'Dental',channel:'Website chat',time:'Thu 22:03',message:"Do you do Invisalign? I'd like to know roughly what it costs and whether I can come in for a consultation.",fields:[['Treatment','Invisalign'],['Stage','Researching options'],['Request','Consultation'],['Clinical Q?','No — admin only']],score:78,booking:'Consultation · Sat 10:00',notify:'Reception task + reminder scheduled'},
 gym:{label:'Gym',channel:'Instagram DM',time:'Mon 06:12',message:'Hey, do you have a free trial? Looking to start strength training, I work shifts so mornings suit best.',fields:[['Goal','Strength training'],['Availability','Early mornings'],['Offer','Free trial pass'],['Source','Instagram']],score:72,booking:'Trial session · Wed 06:30',notify:'Coach notified; post-visit follow-up set'}
};
const STEPS=[['Enquiry arrives','Any channel, any hour'],['AI understands & qualifies','Using only approved knowledge'],['CRM record created','Scored and categorised'],['Appointment booked','From real availability'],['Team notified, follow-up set','Nothing forgotten']];
const ic=d=>'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
const ICONS=[ic('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),ic('<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>'),ic('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'),ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>'),ic('<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>')];
const CHECK=ic('<path d="M20 6 9 17l-5-5"/>');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demoEl=document.querySelector('#demo .surface');
let key='roofing',step=-1,playing=false,timer=null;
function panel(label,body){return '<div class="animate-fade-up rounded-lg border border-line bg-ink-850 p-3"><p class="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-subtle">'+esc(label)+'</p>'+body+'</div>';}
function render(){
  if(!demoEl)return;const s=S[key];const finished=step>=STEPS.length-1;
  const tabs=Object.entries(S).map(([k,v])=>'<button role="tab" aria-selected="'+(k===key)+'" data-k="'+k+'" class="rounded-md px-2.5 py-1 text-[12px] transition '+(k===key?'bg-signal-500/15 text-signal-300 ring-1 ring-signal-500/40':'text-muted hover:text-fg')+'">'+esc(v.label)+'</button>').join('');
  const steps=STEPS.map((st,i)=>{const done=i<step||(i===step&&!playing&&finished);const active=i===step;
    return '<li class="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500 '+(active?'border-signal-500/50 bg-signal-500/8 glow-ring':done?'border-line bg-ink-800':'border-transparent opacity-55')+'"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg '+(active||done?'bg-signal-500/15 text-signal-300':'bg-ink-700 text-subtle')+'">'+(done&&!active?CHECK:ICONS[i])+'</span><div class="min-w-0"><p class="text-[13.5px] font-medium text-fg">'+st[0]+'</p><p class="text-[12px] text-subtle">'+st[1]+'</p></div></li>';}).join('');
  let out='';
  if(step>=0)out+=panel(s.channel+' · '+s.time,'<p class="font-sans text-[13.5px] leading-relaxed text-fg/90">“'+esc(s.message)+'”</p>');
  if(step>=1)out+=panel('AI extraction','<dl class="grid grid-cols-2 gap-x-4 gap-y-1.5">'+s.fields.map(f=>'<dt class="text-subtle">'+esc(f[0])+'</dt><dd class="text-signal-300">'+esc(f[1])+'</dd>').join('')+'</dl>');
  if(step>=2)out+=panel('CRM','<div class="flex items-center justify-between"><span class="text-fg/90">Lead created · stage: <span class="text-aura-400">qualified</span></span><span class="rounded bg-success/15 px-1.5 py-0.5 text-success">score '+s.score+'</span></div>');
  if(step>=3)out+=panel('Calendar','<span class="text-fg/90">'+esc(s.booking)+' — confirmation sent</span>');
  if(step>=4)out+=panel('Notifications','<span class="text-fg/90">'+esc(s.notify)+'</span>');
  if(step<0)out+='<p class="pt-24 text-center font-sans text-[13px] text-subtle">Choose an industry and press “Run workflow”.</p>';
  demoEl.innerHTML='<div class="flex flex-wrap items-center justify-between gap-3 rounded-t-[1.1rem] border-b border-line bg-ink-900/80 px-4 py-3"><div class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-signal-400 animate-pulse-dot"></span><span class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Interactive demo · simulated data</span></div><div class="flex flex-wrap gap-1" role="tablist" aria-label="Choose an industry">'+tabs+'</div></div>'
   +'<div class="grid gap-4 p-4 lg:grid-cols-[1fr_1.15fr] lg:p-5"><ol class="space-y-1.5" aria-label="Workflow steps">'+steps+'<div class="pt-3"><button data-run class="inline-flex h-10 items-center gap-2 rounded-lg bg-signal-500 px-4 text-sm font-medium text-white transition hover:bg-signal-400 disabled:opacity-60" '+(playing?'disabled':'')+'>'+(finished?'Replay':playing?'Running…':'Run workflow')+'</button></div></ol>'
   +'<div class="min-h-[340px] space-y-3 rounded-xl border border-line bg-ink-900 p-4 font-mono text-[12.5px]">'+out+'</div></div>';
}
function tick(){if(!playing)return;if(step>=STEPS.length-1){playing=false;render();return;}timer=setTimeout(()=>{step++;render();tick();},step<0?300:1100);}
if(demoEl){
  demoEl.addEventListener('click',e=>{
    const t=e.target.closest('[data-k]');if(t){clearTimeout(timer);key=t.dataset.k;step=-1;playing=false;render();return;}
    if(e.target.closest('[data-run]')&&!playing){clearTimeout(timer);step=-1;playing=true;render();tick();}
  });
  render();
}
show();
}</script>'''

doc = head_html + header + '<main>' + "".join(sections) + app_note + '</main>' + footer + script + '</body></html>'
with open(OUT, "w") as f:
    f.write(doc)
print(f"Wrote {OUT}: {len(doc)/1024:.0f} KB, {len(sections)} pages")
