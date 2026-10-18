/* Flame-n-Focus web app: core (utils, auth, shell, router, home, profile, menu, chef). */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
const S = { user: null, profile: null, status: null };
const VIEWS = {};

/* ------------------------------------------------------------------ icons */
const IC = {
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  menu: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
  chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  chef: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8",
  plus: "M12 5v14 M5 12h14",
  trash: "M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4h6v2",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18 M6 6l12 12",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
};
const ico = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;
const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/></svg>`;

/* ------------------------------------------------------------------ helpers */
async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const tok = store.get("ff_token");
  if (tok) headers.Authorization = "Bearer " + tok;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch("/api" + path, { method, headers, body: payload }); }
  catch { throw new Error("Cannot reach the server. Is it running?"); }
  let d = null;
  try { d = await r.json(); } catch {}
  if (r.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/signup")) {
    store.set("ff_token", null); S.user = null; route();
    throw new Error((d && d.detail) || "Please sign in.");
  }
  if (!r.ok) {
    let m = d && d.detail;
    if (Array.isArray(m)) m = m.map(x => x.msg).join("; ");
    throw new Error(m || r.statusText);
  }
  return d;
}
function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = "toast " + type; t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
function modal(html, onMount) {
  const o = document.createElement("div");
  o.className = "overlay";
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => o.remove();
  o.addEventListener("mousedown", e => { if (e.target === o) close(); });
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  document.body.appendChild(o);
  onMount && onMount($(".modal", o), close);
  return close;
}
async function busy(btn, label, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } catch (e) { toast(e.message, "bad"); } finally { btn.disabled = false; btn.innerHTML = old; }
}
const cur = () => "Rs";
const toMin = s => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
const addMins = (s, m) => { const t = (toMin(s) + m) % 1440; return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
function spanMins(start, end) {
  const d = toMin(end) - toMin(start);
  if (!(d >= 10 && d <= 120)) throw new Error("The break must end 10 to 120 minutes after it starts.");
  return d;
}
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const csv = s => String(s || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
const empty = (emoji, msg) => `<div class="empty"><div class="big">${emoji}</div><p>${esc(msg)}</p></div>`;
const skeleton = n => Array.from({ length: n }, () => '<div class="skeleton"></div>').join("");
const todayStr = () => new Date().toISOString().slice(0, 10);
async function copyText(t, btn) {
  try { await navigator.clipboard.writeText(t); toast("Copied", "ok"); }
  catch { toast("Copy failed. Select the text manually.", "bad"); }
}

/* voice input (Web Speech API). Falls back silently where unsupported. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = target => SR ? `<button type="button" class="icon-btn" data-mic="${target}" title="Speak" aria-label="Voice input">${ico("mic")}</button>` : "";
document.addEventListener("click", e => {
  const b = e.target.closest("[data-mic]");
  if (!b || !SR) return;
  const input = $(b.dataset.mic);
  if (!input) return;
  if (b._rec) { b._rec.stop(); return; }
  const rec = new SR();
  rec.lang = store.get("ff_voice") || "en-US";
  rec.interimResults = false;
  b._rec = rec; b.classList.add("live");
  rec.onresult = ev => { const t = ev.results[0][0].transcript; input.value = (input.value ? input.value + " " : "") + t; input.dispatchEvent(new Event("input")); };
  rec.onerror = ev => toast("Voice input: " + (ev.error === "not-allowed" ? "microphone blocked" : ev.error), "bad");
  rec.onend = () => { b.classList.remove("live"); b._rec = null; };
  try { rec.start(); } catch { b.classList.remove("live"); b._rec = null; }
});

/* ------------------------------------------------------------------ router + shell */
const NAV = [
  ["home", "Home", "home"], ["team", "Team lunch", "users"], ["menu", "Menu", "menu"],
  ["nutrition", "Nutrition", "activity"], ["plan", "Meal plan", "calendar"], ["chat", "Ask Flame", "chat"],
  ["recipes", "Recipes", "search"], ["focus", "Focus", "clock"], ["profile", "Profile", "user"], ["chef", "Chef console", "chef"],
];

function shell(active) {
  const items = NAV.filter(n => n[0] !== "chef" || S.user.role === "chef");
  const nav = items.map(([k, label, ic]) => `<a href="#/${k}" class="${k === active ? "on" : ""}">${ico(ic)}<span>${label}</span></a>`).join("");
  $("#app").innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">${LOGO}<span>Flame-n-<span class="grad-text">Focus</span></span></div>
      <nav class="nav">${nav}</nav>
      <div class="grow"></div>
      <div class="me"><div class="avatar">${esc(S.user.name[0] || "?").toUpperCase()}</div>
        <div style="min-width:0;flex:1"><div class="nm">${esc(S.user.name)}</div><div class="small muted">${S.user.role === "chef" ? "Chef" : "Member"}</div></div>
        <button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">${ico("logout")}</button></div>
    </aside>
    <div>
      <div class="topbar"><div class="brand">${LOGO}<span>Flame-n-<span class="grad-text">Focus</span></span></div>
        <button class="icon-btn" id="logout2" aria-label="Sign out">${ico("logout")}</button></div>
      <main id="view">${skeleton(3)}</main>
    </div>
  </div>`;
  const out = async () => { try { await api("/auth/logout", { method: "POST" }); } catch {} store.set("ff_token", null); S.user = null; location.hash = ""; route(); };
  $("#logout").onclick = out; $("#logout2").onclick = out;
}

async function route() {
  if (!S.user && store.get("ff_token")) {
    try { S.user = await api("/auth/me"); } catch { S.user = null; }
  }
  $$(".overlay").forEach(o => o.remove());
  if (!S.user) {
    const h = location.hash;
    return renderAuth(h.startsWith("#/signup") ? "signup" : "login");
  }
  const [, page = "home", arg] = location.hash.split("/");
  const key = VIEWS[page] && (page !== "chef" || S.user.role === "chef") ? page : "home";
  shell(key);
  const view = $("#view");
  view.dataset.page = key;
  try { await VIEWS[key](view, arg); }
  catch (e) { view.innerHTML = `<div class="card">${empty("", e.message)}</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

/* ------------------------------------------------------------------ auth screen */
function renderAuth(initial = "login") {
  let mode = initial, role = "member";
  const keep = {};
  const draw = () => {
    ["nm", "em", "pw", "cc"].forEach(id => { const e = $("#" + id); if (e) keep[id] = e.value; });
    $("#app").innerHTML = `
    <div class="auth">
      <section class="hero">
        <img class="hero-photo" src="/static/img/steak.jpg" alt="">
        <div class="hero-spices"><img src="/static/img/spices1.png" alt=""><img src="/static/img/spices2.png" alt=""><img src="/static/img/spices3.png" alt=""></div>
        <a class="brand" href="#/" style="color:inherit">${LOGO}<span>Flame-n-Focus</span></a>
        <div class="hero-center"><h1>Lunch that fits everyone on the team.</h1></div>
      </section>
      <section class="auth-side"><div class="auth-card">
        <h2 style="font-size:1.6rem;margin-bottom:6px">${mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p class="muted" style="margin-bottom:18px">${mode === "login" ? "Sign in to plan your break." : "It takes 20 seconds."}</p>
        <div class="seg" style="margin-bottom:18px"><button data-m="login" class="${mode === "login" ? "on" : ""}">Sign in</button><button data-m="signup" class="${mode === "signup" ? "on" : ""}">Sign up</button></div>
        <form id="af" novalidate>
          ${mode === "signup" ? `<div class="field"><label class="f" for="nm">Full name</label><input id="nm" autocomplete="name" required></div>` : ""}
          <div class="field"><label class="f" for="em">Email</label><input id="em" type="email" autocomplete="email" required></div>
          <div class="field"><label class="f" for="pw">Password ${mode === "signup" ? "(min 8 characters)" : ""}</label><input id="pw" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required></div>
          ${mode === "signup" ? `
          
` : ""}
          <p class="msg bad hidden" id="aerr" role="alert"></p>
          <button class="btn block" id="asub">${mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
      </div></section>
    </div>`;
    Object.entries(keep).forEach(([id, v]) => { const e = $("#" + id); if (e) e.value = v; });
    $$("[data-m]").forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $("#af").onsubmit = async e => {
      e.preventDefault();
      const err = $("#aerr"); err.classList.add("hidden");
      const body = { email: $("#em").value, password: $("#pw").value };
      if (mode === "signup") Object.assign(body, { name: $("#nm").value, role });
      const btn = $("#asub"); btn.disabled = true;
      try {
        const d = await api(mode === "login" ? "/auth/login" : "/auth/signup", { method: "POST", body });
        store.set("ff_token", d.token); S.user = d.user; location.hash = "#/home"; route();
      } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); btn.disabled = false; }
    };
  };
  draw();
}

/* ------------------------------------------------------------------ shared pieces */
function ring(value, target, label) {
  const R = 62, C = 2 * Math.PI * R, pct = Math.min(value / (target || 1), 1);
  const over = value > target;
  return `<div class="ring"><svg width="150" height="150" viewBox="0 0 150 150">
    <circle cx="75" cy="75" r="${R}" fill="none" stroke="var(--line)" stroke-width="12"/>
    <circle cx="75" cy="75" r="${R}" fill="none" stroke="${over ? "var(--bad)" : "url(#rg)"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
    <defs><linearGradient id="rg"><stop offset="0" stop-color="#5E6600"/><stop offset="1" stop-color="#233000"/></linearGradient></defs></svg>
    <div class="c"><div class="stat" style="font-size:1.7rem">${value}</div><div class="small muted">${label}</div></div></div>`;
}
function macroBar(p, c, f) {
  const t = (p * 4 + c * 4 + f * 9) || 1;
  return `<div class="macros" title="Protein / Carbs / Fat"><i style="width:${p * 4 / t * 100}%"></i><i style="width:${c * 4 / t * 100}%"></i><i style="width:${f * 9 / t * 100}%"></i></div>
    <div class="legend"><span><i class="dot" style="background:#233000"></i>P ${p}g</span><span><i class="dot" style="background:#5E6600"></i>C ${c}g</span><span><i class="dot" style="background:#9AA64B"></i>F ${f}g</span></div>`;
}
const ALLERGEN_SYN = { nuts: ["nut", "almond", "cashew", "peanut", "walnut", "pistachio"], dairy: ["milk", "lactose", "cheese", "dairy"],
  gluten: ["wheat", "gluten", "celiac", "coeliac"], seafood: ["fish", "shrimp", "prawn", "shellfish", "seafood"], egg: ["egg"] };
function dishWarnings(i) {
  const p = S.profile; if (!p) return [];
  const out = [];
  for (const a of i.allergens || []) {
    const words = [a, ...(ALLERGEN_SYN[a] || [])];
    if ((p.allergies || []).some(x => words.some(w => x.includes(w)))) out.push(`Contains ${a} (your allergy)`);
  }
  for (const d of p.dislikes || []) if (d && i.name.toLowerCase().includes(d)) out.push(`Contains ${d} (disliked)`);
  return out;
}
const DISH_IMGS = ["salad", "plate", "drinks", "soup", "pear", "asparagus", "steak"];
const DISH_RULES = [
  [/coffee|tea|juice|drink|shake|lassi|soda|lemonade|mojito/i, ["drinks"]],
  [/brownie|cake|dessert|pastry|sweet|ice cream|pudding|halwa|kheer/i, ["pear"]],
  [/soup|karahi|curry|daal|dal |biryani|rice|chawal|bowl|stew|haleem|nihari/i, ["soup"]],
  [/salad|wrap|veg|roll|paneer|healthy|oats|yogurt|fruit|chana/i, ["salad", "asparagus"]],
  [/burger|steak|sandwich|beef|chicken|tikka|platter|grill|zinger|bbq|kebab|fries|egg|omelet|paratha|roti/i, ["plate", "steak"]],
];
const dishImg = n => {
  const name = String(n), h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  for (const [re, imgs] of DISH_RULES) if (re.test(name)) return imgs[h % imgs.length];
  return DISH_IMGS[h % DISH_IMGS.length];
};
function dishCard(i, extra = "") {
  const spice = i.spice ? `Spice ${i.spice}/3` : "";
  const warn = dishWarnings(i).map(w => `<span class="chip bad"> ${esc(w)}</span>`).join("");
  const fav = S.favs && S.favs.has(i.id);
  return `<article class="card dish" data-id="${i.id}" tabindex="0" aria-label="${esc(i.name)}, view details">
    <div class="dish-media"><img class="dish-img" src="/static/img/${dishImg(i.name)}.jpg" alt="" loading="lazy">
      <button class="fav ${fav ? "on" : ""}" data-fav="${i.id}" aria-pressed="${!!fav}" aria-label="${fav ? "Remove from" : "Save to"} favourites" type="button">${ico("heart")}</button></div>
    <div class="top"><div><h3>${esc(i.name)}</h3>${i.description ? `<p class="small muted">${esc(i.description)}</p>` : ""}</div><div class="price">${cur()} ${i.price}</div></div>
    <div class="chips"><span class="chip"> ${i.calories} kcal</span><span class="chip"> ${i.prep_min} min</span>${spice ? `<span class="chip">${spice}</span>` : ""}
      ${i.source === "custom" ? '<span class="chip info">Custom · AI-estimated</span>' : ""}</div>
    ${macroBar(i.protein, i.carbs, i.fat)}
    <div class="chips">${warn}${(i.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join("")}${(i.allergens || []).map(a => `<span class="chip warn">contains ${esc(a)}</span>`).join("")}</div>
    ${i.chef_note ? `<p class="small muted"> ${esc(i.chef_note)}</p>` : ""}${extra}</article>`;
}
function itemForm(it = {}) {
  const v = (k, d = "") => esc(it[k] ?? d);
  return `
  <div class="field"><label class="f">Dish name</label><input name="name" value="${v("name")}" required></div>
  <div class="field"><label class="f">Description</label><input name="description" value="${v("description")}"></div>
  <div class="grid g3">
    <div class="field"><label class="f">Price (Rs)</label><input name="price" type="number" min="0" value="${v("price", 0)}"></div>
    <div class="field"><label class="f">Calories</label><input name="calories" type="number" min="0" value="${v("calories", 0)}"></div>
    <div class="field"><label class="f">Prep (min)</label><input name="prep_min" type="number" min="0" value="${v("prep_min", 10)}"></div>
    <div class="field"><label class="f">Protein (g)</label><input name="protein" type="number" min="0" value="${v("protein", 0)}"></div>
    <div class="field"><label class="f">Carbs (g)</label><input name="carbs" type="number" min="0" value="${v("carbs", 0)}"></div>
    <div class="field"><label class="f">Fat (g)</label><input name="fat" type="number" min="0" value="${v("fat", 0)}"></div>
  </div>
  <div class="grid g2">
    <div class="field"><label class="f">Spice (0-3)</label><input name="spice" type="number" min="0" max="3" value="${v("spice", 0)}"></div>
    <div class="field"><label class="f">Tags (comma separated)</label><input name="tags" value="${esc((it.tags || []).join(", "))}" placeholder="halal, vegetarian, healthy"></div>
  </div>
  <div class="field"><label class="f">Allergens (gluten, dairy, egg, nuts, seafood)</label><input name="allergens" value="${esc((it.allergens || []).join(", "))}"></div>
  <div class="field"><label class="f">Note for customers</label><input name="chef_note" value="${v("chef_note")}" maxlength="300"></div>`;
}
function readItem(root) {
  const g = n => root.querySelector(`[name=${n}]`).value;
  return { name: g("name"), description: g("description"), price: num(g("price")), calories: num(g("calories")), prep_min: num(g("prep_min"), 10),
    protein: num(g("protein")), carbs: num(g("carbs")), fat: num(g("fat")), spice: Math.min(3, num(g("spice"))),
    tags: csv(g("tags")), allergens: csv(g("allergens")), chef_note: g("chef_note") };
}

/* ------------------------------------------------------------------ home */
VIEWS.home = async view => {
  const [logs, teams, st] = await Promise.all([api("/logs?days=7"), api("/teams/mine"), api("/status")]);
  S.status = st;
  const today = logs.days[logs.days.length - 1];
  const hour = new Date().getHours();
  const hi = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  view.innerHTML = `
    <div class="page-head"><div><h1>${hi}, <span class="grad-text">${esc(S.user.name.split(" ")[0])}</span></h1><p class="muted">What are we eating today?</p></div>
      </div>
    <div class="grid g3" style="margin-bottom:16px">
      <a class="card flat tile" href="#/team"><img src="/static/img/soup.jpg" alt=""><div><h3> Plan a team lunch</h3><p class="muted small">Create a team, share the code, eat together or separately.</p></div></a>
      <a class="card flat tile" href="#/menu"><img src="/static/img/salad.jpg" alt=""><div><h3> Browse or add a dish</h3><p class="muted small">See today's menu, or add a dish of your own.</p></div></a>
      <a class="card flat tile" href="#/nutrition"><img src="/static/img/asparagus.jpg" alt=""><div><h3> Scan your meal</h3><p class="muted small">Photo or voice to calories and macros in seconds.</p></div></a>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Today</h2><div class="row" style="gap:24px">${ring(today.kcal, logs.target, "of " + logs.target + " kcal")}
        <div class="grow">${macroBar(today.protein, today.carbs, today.fat)}<p class="small muted" style="margin-top:10px">${today.kcal ? "" : "Nothing logged yet. "}<a href="#/nutrition">Log a meal →</a></p></div></div></div>
      <div class="card"><div class="ch"><h2>Your teams</h2><a href="#/team" class="small">Manage →</a></div>
        ${teams.teams.length ? `<div class="list">${teams.teams.map(t => `<a class="it" href="#/team/${t.code}"><div><b>${esc(t.name)}</b><div class="small muted">${t.members} member${t.members > 1 ? "s" : ""}</div></div><span class="chip">${esc(t.code)}</span></a>`).join("")}</div>` : empty("", "No teams yet. Create one or join with a code.")}</div>
    </div>`;
};

/* ------------------------------------------------------------------ profile */
VIEWS.profile = async view => {
  const p = await api("/profile");
  const DIETS = ["halal", "vegetarian", "vegan", "healthy"];
  let allergies = [...p.allergies];
  let dislikes = [...(p.dislikes || [])];
  const diet = new Set(p.diet);
  view.innerHTML = `
  <div class="page-head"><div><h1>Your profile</h1><p class="muted">Used to personalise suggestions. Never shown to teammates.</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Health profile</h2>
      <div class="grid g3">
        <div class="field"><label class="f">Age</label><input id="age" type="number" min="1" max="120" value="${p.age ?? ""}"></div>
        <div class="field"><label class="f">Height (cm)</label><input id="h" type="number" value="${p.height_cm ?? ""}"></div>
        <div class="field"><label class="f">Weight (kg)</label><input id="w" type="number" value="${p.weight_kg ?? ""}"></div>
      </div>
      <div class="grid g2">
        <div class="field"><label class="f">Activity level</label><select id="act">${["sedentary", "light", "moderate", "active"].map(a => `<option ${p.activity === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
        <div class="field"><label class="f">Goal</label><select id="goal">${[["maintain", "Maintain weight"], ["lose", "Lose weight"], ["gain", "Gain weight"], ["muscle", "Build muscle"]].map(([k, l]) => `<option value="${k}" ${p.goal === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label class="f">Daily calorie target</label><input id="kcal" type="number" min="800" max="6000" value="${p.kcal_target}"></div>
      <div class="field"><label class="f">Dietary preferences</label><div class="chips" id="diets">${DIETS.map(d => `<span class="chip btnlike ${diet.has(d) ? "on" : ""}" data-d="${d}" role="button" tabindex="0">${d}</span>`).join("")}</div></div>
      <div class="field"><label class="f">Allergies (type and press Enter)</label><div class="chips" id="alg" style="margin-bottom:8px"></div><input id="algin" placeholder="e.g. peanuts, shellfish, milk"></div>
      <div class="field"><label class="f">Disliked ingredients (type and press Enter)</label><div class="chips" id="dis" style="margin-bottom:8px"></div><input id="disin" placeholder="e.g. mushrooms, coriander"></div>
      <div class="field"><label class="f">Budget per meal (Rs, optional)</label><input id="bud" type="number" min="0" placeholder="e.g. 800" value="${p.budget ?? ""}"></div>
      <div class="field"><label class="f">Health conditions you want us to consider (optional)</label><textarea id="cond" maxlength="500" placeholder="e.g. type 2 diabetes, high blood pressure">${esc(p.conditions)}</textarea></div>
      <p class="msg info small">We give general food information only, not medical advice. Talk to a doctor or dietitian about health conditions.</p>
      <button class="btn" id="save">Save profile</button>
    </div>
    <div>
      <div class="card"><h2>Voice input language</h2><p class="small muted" style="margin-bottom:10px">Used by the  buttons. Support depends on your browser.</p>
        <select id="vl">${[["en-US", "English"], ["ur-PK", "اردو (Urdu)"], ["en-GB", "English (UK)"]].map(([k, l]) => `<option value="${k}" ${store.get("ff_voice") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="card"><h2>Account & privacy</h2>
        <p class="small muted" style="margin-bottom:12px">${esc(S.user.email)} · ${S.user.role === "chef" ? "Chef" : "Member"}. Passwords are hashed with scrypt. Your health data is only used to filter and explain your own suggestions.</p>
        <button class="btn danger sm" id="del">Delete my account and all data</button></div>
    </div>
  </div>`;
  const drawAlg = () => { $("#alg").innerHTML = allergies.map((a, i) => `<span class="chip btnlike" data-a="${i}" title="Remove">${esc(a)} ×</span>`).join("") || '<span class="small muted">None added</span>'; $$("[data-a]").forEach(c => c.onclick = () => { allergies.splice(+c.dataset.a, 1); drawAlg(); }); };
  drawAlg();
  $("#algin").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const v = e.target.value.trim().toLowerCase(); if (v && !allergies.includes(v)) allergies.push(v); e.target.value = ""; drawAlg(); } };
  const drawDis = () => { $("#dis").innerHTML = dislikes.map((a, i) => `<span class="chip btnlike" data-x="${i}" title="Remove">${esc(a)} ×</span>`).join("") || '<span class="small muted">None added</span>'; $$("[data-x]", $("#dis")).forEach(c => c.onclick = () => { dislikes.splice(+c.dataset.x, 1); drawDis(); }); };
  drawDis();
  $("#disin").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const v = e.target.value.trim().toLowerCase(); if (v && !dislikes.includes(v)) dislikes.push(v); e.target.value = ""; drawDis(); } };
  $$("[data-d]").forEach(c => { const t = () => { const d = c.dataset.d; diet.has(d) ? diet.delete(d) : diet.add(d); c.classList.toggle("on"); }; c.onclick = t; c.onkeydown = e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), t()); });
  $("#vl").onchange = e => { store.set("ff_voice", e.target.value); toast("Voice language saved", "ok"); };
  $("#save").onclick = e => busy(e.target, "Saving…", async () => {
    const pending = $("#algin").value.trim().toLowerCase(); if (pending && !allergies.includes(pending)) { allergies.push(pending); $("#algin").value = ""; drawAlg(); }
    await api("/profile", { method: "PUT", body: { age: $("#age").value ? num($("#age").value) : null, height_cm: $("#h").value ? num($("#h").value) : null, weight_kg: $("#w").value ? num($("#w").value) : null,
      activity: $("#act").value, goal: $("#goal").value, kcal_target: num($("#kcal").value, 2000), diet: [...diet], allergies, dislikes, budget: $("#bud").value ? num($("#bud").value) : null, conditions: $("#cond").value } });
    toast("Profile saved", "ok");
  });
  $("#del").onclick = async () => { if (!confirm("Delete your account and all your data? This cannot be undone.")) return; await api("/account", { method: "DELETE" }); store.set("ff_token", null); S.user = null; location.hash = ""; route(); };
};

/* ------------------------------------------------------------------ chef console */
VIEWS.chef = async view => {
  let tab = "requests";
  const draw = async () => {
    const [rq, menu] = await Promise.all([api("/menu/requests"), api("/menu")]);
    const pending = rq.requests.filter(r => r.status === "pending");
    view.innerHTML = `
    <div class="page-head"><div><h1>Chef console</h1><p class="muted">Approve requests, set price and calories, manage the menu.</p></div></div>
    <div class="tabs2"><div class="seg" style="display:inline-flex">
      <button data-t="requests" class="${tab === "requests" ? "on" : ""}">Requests${pending.length ? ` (${pending.length})` : ""}</button>
      <button data-t="menu" class="${tab === "menu" ? "on" : ""}">Menu items</button>
      <button data-t="scan" class="${tab === "scan" ? "on" : ""}">Scan menu photo</button></div></div>
    <div id="pane"></div>`;
    $$("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const pane = $("#pane");
    if (tab === "requests") {
      pane.innerHTML = rq.requests.length ? rq.requests.map(r => `
        <div class="card" data-id="${r.id}"><div class="ch"><div><h2>${esc(r.name)} <span class="badge ${r.status}">${r.status}</span></h2>
          <p class="small muted">Requested by ${esc(r.requester || "unknown")}${r.description ? ` · “${esc(r.description)}”` : ""}</p></div></div>
          <div style="margin-top:12px">${itemForm(r)}</div>
          <div class="row"><button class="btn ok sm" data-ap>${ico("check")} Approve</button><button class="btn danger sm" data-rj>${ico("x")} Reject</button></div></div>`).join("")
        : `<div class="card">${empty("", "No requests yet.")}</div>`;
      $$("[data-id]", pane).forEach(card => {
        const id = card.dataset.id;
        const send = (approve, btn) => busy(btn, "Saving…", async () => {
          await api(`/menu/requests/${id}/decide`, { method: "POST", body: { ...readItem(card), approve } });
          toast(approve ? "Approved and added to the menu" : "Rejected", "ok"); draw();
        });
        $("[data-ap]", card).onclick = e => send(true, e.currentTarget);
        $("[data-rj]", card).onclick = e => send(false, e.currentTarget);
      });
    } else if (tab === "menu") {
      pane.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn sm" id="add">${ico("plus")} Add dish</button></div>
        <div class="card"><table><tr><th>Dish</th><th class="n">Rs</th><th class="n">kcal</th><th class="n">Prep</th><th></th></tr>
        ${menu.items.map(i => `<tr><td>${esc(i.name)}${i.source === "custom" ? ' <span class="chip info">custom</span>' : ""}</td><td class="n">${i.price}</td><td class="n">${i.calories}</td><td class="n">${i.prep_min}m</td>
          <td class="right"><button class="icon-btn" data-e="${i.id}" aria-label="Edit">${ico("edit")}</button> <button class="icon-btn" data-x="${i.id}" aria-label="Delete">${ico("trash")}</button></td></tr>`).join("")}</table></div>`;
      const edit = it => modal(`<h2 style="margin-bottom:14px">${it ? "Edit dish" : "Add dish"}</h2><form id="mf">${itemForm(it || {})}</form>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="ms">Save</button></div>`, (m, close) => {
        $("[data-close]", m).onclick = close;
        $("#ms", m).onclick = e => busy(e.target, "Saving…", async () => {
          const body = readItem($("#mf", m));
          await api(it ? `/menu/items/${it.id}` : "/menu/items", { method: it ? "PUT" : "POST", body });
          close(); toast("Saved", "ok"); draw();
        });
      });
      $("#add", pane).onclick = () => edit(null);
      $$("[data-e]", pane).forEach(b => b.onclick = () => edit(menu.items.find(i => i.id == b.dataset.e)));
      $$("[data-x]", pane).forEach(b => b.onclick = async () => { if (confirm("Remove this dish from the menu?")) { await api(`/menu/items/${b.dataset.x}`, { method: "DELETE" }); draw(); } });
    } else {
      pane.innerHTML = `<div class="card"><h2>Scan a menu photo</h2><p class="muted small" style="margin-bottom:12px">We read the menu (English or Urdu). Review the draft, then import.</p>
        <div class="row"><input type="file" id="mf" accept="image/*" class="grow"><button class="btn" id="go">${ico("camera")} Scan</button></div><div id="draft" style="margin-top:16px"></div></div>`;
      $("#go", pane).onclick = e => busy(e.currentTarget, "Reading menu…", async () => {
        const f = $("#mf", pane).files[0]; if (!f) throw new Error("Choose a menu photo first.");
        const fd = new FormData(); fd.append("file", f);
        const d = await api("/menu/scan", { method: "POST", form: fd });
        $("#draft", pane).innerHTML = `<p class="msg info small">Found ${d.items.length} items. Check prices and calories, then import.</p>
          <table><tr><th>Dish</th><th class="n">Rs</th><th class="n">kcal</th><th class="n">Prep</th></tr>${d.items.map(i => `<tr><td>${esc(i.name)}</td><td class="n">${i.price}</td><td class="n">${i.calories}</td><td class="n">${i.prep_min}m</td></tr>`).join("")}</table>
          <button class="btn" id="imp" style="margin-top:12px">Import ${d.items.length} items</button>`;
        $("#imp", pane).onclick = ev => busy(ev.currentTarget, "Importing…", async () => {
          const items = d.items.map(i => ({ name: String(i.name).slice(0, 80), price: num(i.price), calories: num(i.calories), prep_min: num(i.prep_min, 10), spice: Math.min(3, num(i.spice)), tags: i.tags || [], allergens: i.allergens || [] }));
          await api("/menu/bulk", { method: "POST", body: { items } }); toast("Imported", "ok"); tab = "menu"; draw();
        });
      });
    }
  };
  await draw();
};

/* ------------------------------------------------------------------ boot */
window.addEventListener("load", route);
