/* Flame-n-Focus web app: team lunch, nutrition, meal plan, chat, recipes. Depends on app.js. */
"use strict";

/* ------------------------------------------------------------------ team lunch */
VIEWS.team = async (view, code) => {
  if (!code) return teamList(view);
  return teamDetail(view, code);
};

async function teamList(view) {
  const { teams } = await api("/teams/mine");
  view.innerHTML = `
  <div class="page-head"><div><h1>Team lunch</h1><p class="muted">Create a team, share the code, and everyone adds what they want.</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Create a team</h2>
      <div class="field"><label class="f">Team name</label><input id="tn" maxlength="60" placeholder="e.g. Design squad"></div>
      <div class="field"><label class="f">Team-wide wish (everyone who joins “as team” follows this)</label>
        <div class="with-mic"><input id="ts" maxlength="300" placeholder="e.g. halal, under 900, not too spicy">${mic("#ts")}</div></div>
      <div class="grid g2"><div class="field"><label class="f">Break starts</label><input id="tb" type="time" value="13:00"></div>
        <div class="field"><label class="f">Break ends</label><input id="te" type="time" value="13:20"></div></div>
      <button class="btn" id="mk">Create team</button></div>
    <div class="card"><h2>Join with a code</h2>
      <div class="field"><label class="f">6-character code</label><input id="jc" maxlength="6" style="text-transform:uppercase;letter-spacing:.2em;font-weight:700" placeholder="ABC123"></div>
      <button class="btn" id="jn">Join team</button>
      <h2 style="margin-top:24px">Your teams</h2>
      ${teams.length ? `<div class="list">${teams.map(t => `<a class="it" href="#/team/${t.code}"><div><b>${esc(t.name)}</b><div class="small muted">${t.members} member${t.members > 1 ? "s" : ""}</div></div><span class="chip">${esc(t.code)}</span></a>`).join("")}</div>` : empty("👥", "No teams yet.")}</div>
  </div>`;
  $("#mk").onclick = e => busy(e.target, "Creating…", async () => {
    const d = await api("/teams", { method: "POST", body: { name: $("#tn").value || "My team", shared_text: $("#ts").value, break_start: $("#tb").value || "13:00", break_minutes: spanMins($("#tb").value || "13:00", $("#te").value || "13:20") } });
    location.hash = "#/team/" + d.team.code;
  });
  $("#jn").onclick = e => busy(e.target, "Joining…", async () => {
    const d = await api("/teams/join", { method: "POST", body: { code: $("#jc").value } });
    location.hash = "#/team/" + d.team.code;
  });
}

async function teamDetail(view, code) {
  const d = await api("/teams/" + code);
  const t = d.team, host = t.host_id === S.user.id;
  const mine = d.members.find(m => m.user_id === S.user.id);
  let mode = mine.mode;
  view.innerHTML = `
  <div class="page-head"><div><a href="#/team" class="small">← All teams</a><h1>${esc(t.name)}</h1>
    <p class="muted">Break ${esc(t.break_start)} to ${addMins(t.break_start, t.break_minutes)} (${t.break_minutes} min) · ${d.members.length} member${d.members.length > 1 ? "s" : ""}</p></div>
    <div class="row"><span class="small muted">Invite code</span><span class="code">${esc(t.code)}</span><button class="icon-btn" id="cc" title="Copy code" aria-label="Copy code">${ico("copy")}</button></div></div>
  <div class="grid g2">
    <div class="card"><h2>What do you want?</h2>
      <p class="small muted" style="margin-bottom:12px">Write naturally in English, Urdu or Roman Urdu. Your allergies and diet from your profile always apply.</p>
      <div class="field"><div class="with-mic"><input id="my" maxlength="300" value="${esc(mine.text)}" placeholder="e.g. kam mirch, veg wrap, 600 tak">${mic("#my")}</div></div>
      <div class="field"><label class="f">How are you eating?</label>
        <div class="seg"><button data-md="team" class="${mode === "team" ? "on" : ""}">👥 With the team</button><button data-md="solo" class="${mode === "solo" ? "on" : ""}">🙋 Separately</button></div>
        <p class="small muted" style="margin-top:6px" id="mdh"></p></div>
      <button class="btn" id="sv">Save my choice</button></div>
    <div class="card"><div class="ch"><h2>Team wish</h2></div>
      ${host ? `<div class="field"><div class="with-mic"><input id="sh" maxlength="300" value="${esc(t.shared_text)}" placeholder="e.g. halal, under 900">${mic("#sh")}</div></div>
        <div class="grid g2"><div class="field"><label class="f">Break starts</label><input id="bs" type="time" value="${esc(t.break_start)}"></div><div class="field"><label class="f">Break ends</label><input id="be" type="time" value="${addMins(t.break_start, t.break_minutes)}"></div></div>
        <button class="btn ghost sm" id="ut">Update team</button>`
        : `<p>${t.shared_text ? esc(t.shared_text) : '<span class="muted">The host has not set a team-wide wish.</span>'}</p>`}
      <h3 style="margin-top:18px;margin-bottom:6px">Members</h3>
      <div class="list">${d.members.map(m => `<div class="it"><div><b>${esc(m.name)}</b>${m.user_id === t.host_id ? ' <span class="chip">host</span>' : ""}<div class="small muted">${m.text ? esc(m.text) : "No request yet"}</div></div>
        <span class="chip ${m.mode === "team" ? "ok" : "info"}">${m.mode === "team" ? "with team" : "separate"}</span></div>`).join("")}</div>
      <button class="btn ghost sm" id="lv" style="margin-top:12px">Leave team</button></div>
  </div>
  <div class="card"><h2>Plan our break</h2>
    <div class="row"><div style="width:120px"><label class="f">Tax %</label><input id="tx" type="number" min="0" max="30" value="0"></div>
      <div style="width:150px"><label class="f">Delivery fee (Rs)</label><input id="fee" type="number" min="0" value="0"></div>
      <div style="align-self:end"><button class="btn" id="plan">🔥 Plan our break</button></div></div></div>
  <div id="result"></div>`;
  const hint = () => $("#mdh").textContent = mode === "team" ? "Your request is combined with the team wish (the stricter limit wins)." : "Only your own request and profile are used. The team wish is ignored for you.";
  hint();
  $$("[data-md]").forEach(b => b.onclick = () => { mode = b.dataset.md; $$("[data-md]").forEach(x => x.classList.toggle("on", x === b)); hint(); });
  $("#cc").onclick = () => copyText(t.code);
  $("#sv").onclick = e => busy(e.target, "Saving…", async () => { await api(`/teams/${code}/me`, { method: "PUT", body: { text: $("#my").value, mode } }); toast("Saved", "ok"); teamDetail(view, code); });
  if (host) $("#ut").onclick = e => busy(e.target, "Saving…", async () => { await api("/teams/" + code, { method: "PUT", body: { name: t.name, shared_text: $("#sh").value, break_start: $("#bs").value || "13:00", break_minutes: spanMins($("#bs").value || "13:00", $("#be").value || "13:20") } }); toast("Team updated", "ok"); teamDetail(view, code); });
  $("#lv").onclick = async () => { if (confirm("Leave this team?")) { await api(`/teams/${code}/me`, { method: "DELETE" }); location.hash = "#/team"; } };
  $("#plan").onclick = e => busy(e.target, "Planning…", async () => {
    const r = await api(`/teams/${code}/plan`, { method: "POST", body: { tax_pct: +$("#tx").value || 0, delivery_fee: num($("#fee").value) } });
    renderTeamPlan($("#result"), r);
    $("#result").scrollIntoView({ behavior: "smooth" });
  });
}

function renderTeamPlan(box, r) {
  const c = cur(), t = r.timeline, f = r.feast, ind = r.individual;
  let which = "ind", why = "";
  api("/explain", { method: "POST", body: { summary: r.summary } })
    .then(x => { why = x.explanation; const w = $("#why", box); if (w) { w.textContent = why; w.classList.remove("muted"); } })
    .catch(() => { why = "Orders are batched so the kitchen prepares them together, and everyone is back on time."; const w = $("#why", box); if (w) w.textContent = why; });
  const feastText = () => f.dishes.map(d => `- ${d.qty} × ${d.item.name} (${c} ${d.item.price} each)`).join("\n") + `\nTotal ${c} ${f.total} (${c} ${f.per_head} each). Order by ${t.order_by}, back at ${t.back_at_desk}.`;
  const draw = () => {
    box.innerHTML = `
    <div class="card"><div class="ch"><h2>Choose how to eat</h2>
      <div class="seg" style="min-width:300px"><button data-w="ind" class="${which === "ind" ? "on" : ""}">🙋 Individual picks</button><button data-w="feast" class="${which === "feast" ? "on" : ""}">🍽 Team feast</button></div></div>
      ${which === "ind" ? indPanel() : feastPanel()}</div>
    <div class="grid g2">
      <div class="card"><h2>Break timeline</h2><ul class="tl">
        <li><span class="d">🛒</span><div>Order by <b>${esc(t.order_by)}</b></div></li><li><span class="d">🍔</span><div>Food arrives <b>${esc(t.food_arrives)}</b></div></li>
        <li><span class="d">😋</span><div>Eat until <b>${esc(t.eating_until)}</b></div></li><li><span class="d">💻</span><div>Back at desk <b>${esc(t.back_at_desk)}</b></div></li></ul>
        ${t.fits_break ? `<p class="msg ok">Fits your break with ${t.slack_min} min to spare.</p>` : `<p class="msg bad">Too tight. Lengthen the break or pick faster dishes.</p>`}
        ${r.alerts.map(a => `<p class="msg warn">⚠ ${esc(a)}</p>`).join("")}
        ${r.my_health_notes.map(n => `<p class="msg info">💡 ${esc(n.dish)}: ${esc(n.note)}</p>`).join("")}
        ${r.my_health_notes.length ? `<p class="small muted">${esc(r.disclaimer)} Only you can see these notes.</p>` : ""}</div>
      <div class="card"><h2>Why this works</h2><p id="why" class="muted">Thinking…</p>
        <h3 style="margin:18px 0 8px">Share</h3><pre class="share" id="sh">${esc(which === "ind" ? r.summary : feastText())}</pre>
        <button class="btn ghost sm" id="cp">${ico("copy")} Copy for WhatsApp</button></div>
    </div>`;
    const w = $("#why", box); w.textContent = why || w.textContent;
    $$("[data-w]", box).forEach(b => b.onclick = () => { which = b.dataset.w; draw(); });
    $("#cp", box).onclick = () => copyText($("#sh", box).textContent);
  };
  const indPanel = () => `<div class="grid g2"><div>
      ${ind.results.map(x => x.item
        ? `<div class="list"><div class="it"><div><b>${esc(x.name)}</b> <span class="chip ${r.modes[x.name] === "team" ? "ok" : "info"}">${r.modes[x.name] === "team" ? "team" : "separate"}</span><div class="small muted">${esc(x.item.name)} · ${x.item.calories} kcal · ${x.item.prep_min} min</div></div><b>${c} ${x.item.price}</b></div></div>`
        : `<div class="list"><div class="it"><div><b>${esc(x.name)}</b><div class="small" style="color:var(--bad)">Nothing fits: ${esc(x.reasons.join(", "))}. Relax a limit or add a custom dish on the Menu page.</div></div></div></div>`).join("")}
    </div><div>
      <h3 style="margin-bottom:6px">Kitchen batch</h3><table><tr><th>Dish</th><th class="n">Qty</th><th class="n">${c}</th></tr>${ind.batch.map(b => `<tr><td>${esc(b.item)}</td><td class="n">${b.qty}</td><td class="n">${b.line_total}</td></tr>`).join("")}</table>
      <h3 style="margin:14px 0 6px">Bill split</h3><table>${Object.entries(ind.bill.per_person).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${c} ${v}</td></tr>`).join("")}</table>
      <p style="margin-top:10px">Total <span class="stat" style="font-size:1.5rem">${c} ${ind.bill.total}</span></p></div></div>`;
  const feastPanel = () => `
    ${f.mode === "cover" ? `<p class="msg info">No single dish suits everyone, so this is the smallest set where everybody has something to eat.</p>` : `<p class="msg ok">Every dish here works for everyone on the team.</p>`}
    ${f.unserved.length ? `<p class="msg warn">Nothing on the menu fits: ${f.unserved.map(esc).join(", ")}. Add a custom dish on the Menu page.</p>` : ""}
    <div class="grid g2"><div>${f.dishes.map(d => `<div class="list"><div class="it"><div><b>${d.qty} × ${esc(d.item.name)}</b><div class="small muted">${d.item.calories} kcal each · ${d.item.prep_min} min</div></div><b>${c} ${d.item.price * d.qty}</b></div></div>`).join("") || empty("🍽", "No shared dishes available.")}</div>
    <div><p class="muted small">Per person</p><p class="stat">${c} ${f.per_head}</p><p class="small muted">≈ ${f.avg_kcal} kcal each · Team total ${c} ${f.total}</p></div></div>`;
  draw();
}

/* ------------------------------------------------------------------ nutrition */
VIEWS.nutrition = async view => {
  const L = await api("/logs?days=7");
  const max = Math.max(L.target, ...L.days.map(d => d.kcal)) * 1.1 || 1;
  const today = L.days[L.days.length - 1];
  const wk = L.days.reduce((a, d) => ({ kcal: a.kcal + d.kcal, protein: a.protein + d.protein, carbs: a.carbs + d.carbs, fat: a.fat + d.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  view.innerHTML = `
  <div class="page-head"><div><h1>Nutrition</h1><p class="muted">Snap, speak or type your meal. Log it. Watch your progress.</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Analyse a meal</h2>
      <label class="drop" id="drop"><input type="file" id="img" accept="image/*" class="hidden"><div id="pv">${ico("camera")}<p>Drop a food photo here or tap to choose</p></div></label>
      <div class="field" style="margin-top:14px"><label class="f">Or describe it</label><div class="with-mic"><input id="desc" maxlength="300" placeholder="e.g. 2 rotis with chicken karahi and raita">${mic("#desc")}</div></div>
      <button class="btn block" id="an">Estimate calories</button><div id="ares" style="margin-top:14px"></div></div>
    <div class="card"><h2>Progress</h2>
      <div class="row" style="gap:24px;margin-bottom:16px">${ring(today.kcal, L.target, "of " + L.target + " kcal")}
        <div class="grow"><p class="small muted">Goal: ${esc(L.goal)}</p><p class="small muted" style="margin-bottom:8px">7-day average ${Math.round(wk.kcal / 7)} kcal</p>${macroBar(Math.round(wk.protein / 7), Math.round(wk.carbs / 7), Math.round(wk.fat / 7))}</div></div>
      <div class="bars" aria-label="Calories per day">
        <div class="tgt" style="bottom:${Math.round(26 + L.target / max * 0.78 * 142)}px"></div>
        ${L.days.map(d => `<div class="col"><div class="bar ${d.kcal > L.target ? "over" : ""}" style="height:${d.kcal / max * 78}%" title="${d.kcal} kcal"></div><span>${new Date(d.day + "T00:00").toLocaleDateString(undefined, { weekday: "short" })}</span></div>`).join("")}</div>
      <p class="small muted" style="margin-top:8px">Dashed line = your daily target.</p></div>
  </div>
  <div class="card"><div class="ch"><h2>Today's log</h2></div>
    <div id="log">${L.today.length ? `<div class="list">${L.today.map(l => `<div class="it"><div><b>${esc(l.name)}</b><div class="small muted">${l.kcal} kcal · P ${l.protein} · C ${l.carbs} · F ${l.fat}</div></div><button class="icon-btn" data-del="${l.id}" aria-label="Delete">${ico("trash")}</button></div>`).join("")}</div>` : empty("🍽", "Nothing logged today.")}</div>
    <h3 style="margin:18px 0 8px">Quick add</h3>
    <div class="row"><input id="ln" class="grow" placeholder="Meal name" maxlength="100"><input id="lk" type="number" min="0" placeholder="kcal" style="width:100px">
      <input id="lp" type="number" min="0" placeholder="P g" style="width:80px"><input id="lc" type="number" min="0" placeholder="C g" style="width:80px"><input id="lf" type="number" min="0" placeholder="F g" style="width:80px">
      <button class="btn" id="la">Add</button></div></div>`;
  const drop = $("#drop"), inp = $("#img");
  const preview = f => { if (!f) return; const u = URL.createObjectURL(f); $("#pv").innerHTML = `<img src="${u}" alt="Your meal">`; };
  inp.onchange = () => preview(inp.files[0]);
  ["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) { const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; preview(f); } });
  $("#an").onclick = e => busy(e.target, "Analysing…", async () => {
    const fd = new FormData(); if (inp.files[0]) fd.append("file", inp.files[0]); fd.append("text", $("#desc").value);
    const r = await api("/nutrition/analyze", { method: "POST", form: fd });
    $("#ares").innerHTML = `<div class="list">${r.items.map(i => `<div class="it"><div><b>${esc(i.name)}</b><div class="small muted">${esc(i.portion || "")}</div></div><div class="right"><b>${i.kcal} kcal</b><div class="small muted">P ${i.protein_g} · C ${i.carbs_g} · F ${i.fat_g}</div></div></div>`).join("")}</div>
      <p style="margin:10px 0"><b>Total ${r.total.kcal} kcal</b> <span class="chip">${esc(r.confidence)} confidence</span></p>
      ${r.notes ? `<p class="small muted">${esc(r.notes)}</p>` : ""}${(r.flags || []).map(x => `<p class="msg warn">⚠ ${esc(x)}</p>`).join("")}
      <p class="small muted">${esc(r.disclaimer)} Estimates only.</p><button class="btn ok sm" id="lg" style="margin-top:8px">${ico("plus")} Log this meal</button>`;
    $("#lg").onclick = ev => busy(ev.currentTarget, "Logging…", async () => {
      await api("/logs", { method: "POST", body: { name: r.items.map(i => i.name).join(", ").slice(0, 100) || "Meal", kcal: r.total.kcal, protein: r.total.protein_g, carbs: r.total.carbs_g, fat: r.total.fat_g, source: "ai" } });
      toast("Logged", "ok"); VIEWS.nutrition(view);
    });
  });
  $("#la").onclick = e => busy(e.target, "Adding…", async () => {
    if (!$("#ln").value.trim()) throw new Error("Enter a meal name.");
    await api("/logs", { method: "POST", body: { name: $("#ln").value, kcal: num($("#lk").value), protein: num($("#lp").value), carbs: num($("#lc").value), fat: num($("#lf").value) } });
    VIEWS.nutrition(view);
  });
  $$("[data-del]").forEach(b => b.onclick = async () => { await api("/logs/" + b.dataset.del, { method: "DELETE" }); VIEWS.nutrition(view); });
};

/* ------------------------------------------------------------------ meal plan */
VIEWS.plan = async view => {
  let { plan, disclaimer } = await api("/mealplan");
  let day = 0, days = 1;
  const draw = () => {
    view.innerHTML = `
    <div class="page-head"><div><h1>Meal plan</h1><p class="muted">Built around your goal, diet and allergies. Swap any meal.</p></div></div>
    <div class="card"><div class="row">
      <div style="width:150px"><label class="f">Plan length</label><select id="pd">${[1, 3, 7].map(n => `<option value="${n}" ${n === days ? "selected" : ""}>${n} day${n > 1 ? "s" : ""}</option>`).join("")}</select></div>
      <div style="width:190px"><label class="f">Total budget, all days (Rs)</label><input id="pb" type="number" min="0" placeholder="optional" value="${plan && plan.budget ? plan.budget : ""}"></div>
      <div class="grow"><label class="f">Wishes (optional)</label><div class="with-mic"><input id="pw" maxlength="300" placeholder="e.g. high protein, no fried food, budget friendly">${mic("#pw")}</div></div>
      <div style="align-self:end"><button class="btn" id="gp">✨ ${plan ? "Regenerate" : "Generate"}</button></div></div></div>
    <div id="pl">${plan ? "" : `<div class="card">${empty("🥗", "No plan yet. Generate one above.")}</div>`}</div>`;
    $("#gp").onclick = e => busy(e.target, "Planning… (up to 30s)", async () => {
      days = num($("#pd").value, 1); const r = await api("/mealplan/generate", { method: "POST", body: { days, wishes: $("#pw").value, budget: $("#pb").value ? num($("#pb").value) : null } });
      plan = r.plan; day = 0; draw();
    });
    if (plan) show();
  };
  const show = () => {
    const d = plan.days[day] || plan.days[0];
    const tot = d.meals.reduce((a, m) => ({ k: a.k + (m.kcal || 0), p: a.p + (m.protein_g || 0), c: a.c + (m.carbs_g || 0), f: a.f + (m.fat_g || 0) }), { k: 0, p: 0, c: 0, f: 0 });
    $("#pl").innerHTML = `
      ${plan.days.length > 1 ? `<div class="chips" style="margin-bottom:14px">${plan.days.map((_, i) => `<span class="chip btnlike ${i === day ? "on" : ""}" data-day="${i}" role="button" tabindex="0">Day ${i + 1}</span>`).join("")}</div>` : ""}
      ${plan.total_cost ? budgetCard(plan) : ""}
      <div class="card"><div class="ch"><h2>Day ${day + 1} · ${tot.k} kcal</h2><span class="price" style="font-size:1.1rem">Rs ${d.total ?? d.meals.reduce((a, m) => a + (m.price || 0), 0)}</span></div>${macroBar(tot.p, tot.c, tot.f)}</div>
      <div class="grid auto">${d.meals.map((m, i) => `<article class="card dish"><div class="top"><div><span class="chip">${esc(m.type)}</span><h3 style="margin-top:6px">${esc(m.name)}</h3></div><div class="right"><b>${m.kcal} kcal</b><div class="price">Rs ${m.price || 0}</div></div></div>
        <p class="small muted">${esc(m.portion || "")}</p>${macroBar(m.protein_g || 0, m.carbs_g || 0, m.fat_g || 0)}
        <p class="small"><b>Ingredients:</b> ${(m.ingredients || []).map(esc).join(", ")}</p>
        ${(m.alternatives || []).length ? `<div class="chips"><span class="small muted">Or:</span>${m.alternatives.map(a => `<span class="chip">${esc(a)}</span>`).join("")}</div>` : ""}
        <button class="btn ghost sm" data-rp="${i}">${ico("refresh")} Replace this meal</button></article>`).join("")}</div>
      ${plan.notes ? `<p class="msg info">${esc(plan.notes)}</p>` : ""}<p class="small muted">${esc(disclaimer)}</p>`;
    $$("[data-day]").forEach(c => c.onclick = () => { day = +c.dataset.day; show(); });
    $$("[data-rp]").forEach(b => b.onclick = () => modal(`<h2 style="margin-bottom:12px">Replace meal</h2><div class="field"><label class="f">What would you prefer? (optional)</label><div class="with-mic"><input id="rq" maxlength="200" placeholder="e.g. something vegetarian, lighter">${mic("#rq")}</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="rr">Replace</button></div>`, (m, close) => {
      $("[data-close]", m).onclick = close;
      $("#rr", m).onclick = e => busy(e.target, "Replacing…", async () => { const r = await api("/mealplan/replace", { method: "POST", body: { day, index: +b.dataset.rp, request: $("#rq", m).value } }); plan = r.plan; close(); show(); });
    }));
  };
  draw();
};

/* ------------------------------------------------------------------ chat */
const chatHistory = [];
VIEWS.chat = async view => {
  view.innerHTML = `
  <div class="page-head"><div><h1>Ask Flame</h1><p class="muted">Questions about food, nutrition, today's menu or your plan. English, اردو or Roman Urdu.</p></div></div>
  <div class="card chat"><div class="msgs" id="msgs"></div>
    <div class="chips" id="sug" style="margin-bottom:10px">${["What is a healthy lunch under 600 kcal?", "Which dish has the most protein?", "Mujhe kam mirch wala kya khana chahiye?"].map(s => `<span class="chip btnlike" role="button" tabindex="0">${esc(s)}</span>`).join("")}</div>
    <form class="with-mic" id="cf"><input id="ci" maxlength="1000" placeholder="Ask anything about food…" autocomplete="off">${mic("#ci")}<button class="btn" aria-label="Send">${ico("send")}</button></form>
    <p class="small muted" style="margin-top:8px">General wellness information, not medical advice.</p></div>`;
  const box = $("#msgs");
  const add = (role, text) => { const d = document.createElement("div"); d.className = "bub " + (role === "user" ? "u" : "a"); d.innerHTML = md(text); box.appendChild(d); box.scrollTop = box.scrollHeight; return d; };
  if (!chatHistory.length) add("assistant", `Hi ${S.user.name.split(" ")[0]}! I'm Flame. Ask me about today's menu, calories, or what to eat.`);
  else chatHistory.forEach(m => add(m.role, m.text));
  const send = async text => {
    text = text.trim(); if (!text) return;
    add("user", text); const wait = add("assistant", "…");
    try {
      const r = await api("/chat", { method: "POST", body: { message: text, history: chatHistory } });
      chatHistory.push({ role: "user", text }, { role: "assistant", text: r.reply }); wait.innerHTML = md(r.reply);
    } catch (e) { wait.textContent = "Sorry, " + e.message; }
    box.scrollTop = box.scrollHeight;
  };
  $("#cf").onsubmit = e => { e.preventDefault(); const v = $("#ci").value; $("#ci").value = ""; send(v); };
  $$("#sug .chip").forEach(c => c.onclick = () => send(c.textContent));
};

/* ------------------------------------------------------------------ recipes / search */
VIEWS.recipes = async view => {
  view.innerHTML = `
  <div class="page-head"><div><h1>Recipes</h1><p class="muted">Tell us what's in your kitchen. We'll suggest meals that fit your diet.</p></div></div>
  <div class="card"><div class="row"><div class="grow"><label class="f">Ingredients</label><div class="with-mic"><input id="ing" maxlength="200" placeholder="e.g. chicken, rice, yogurt, tomatoes">${mic("#ing")}</div></div>
    <div style="width:140px"><label class="f">Max kcal / serving</label><input id="mk" type="number" min="100" placeholder="any"></div>
    <div style="align-self:end"><button class="btn" id="go">Find recipes</button></div></div></div>
  <div id="out"></div>`;
  $("#go").onclick = e => busy(e.target, "Cooking up ideas…", async () => {
    const r = await api("/recipes", { method: "POST", body: { ingredients: $("#ing").value, max_kcal: $("#mk").value ? num($("#mk").value) : null } });
    $("#out").innerHTML = r.recipes.length ? `<div class="grid auto">${r.recipes.map(x => `<article class="card dish"><div class="top"><h3>${esc(x.name)}</h3><span class="chip">${x.minutes} min · ${x.kcal} kcal</span></div>
      <p class="small"><b>Ingredients:</b> ${(x.ingredients || []).map(esc).join(", ")}</p><ol style="margin:0;padding-left:18px" class="small">${(x.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol></article>`).join("")}</div>`
      : `<div class="card">${empty("🤔", "No recipes found. Try different ingredients.")}</div>`;
  });
};

function budgetCard(plan) {
  const b = plan.budget, t = plan.total_cost;
  if (!b) return `<div class="card"><div class="ch"><h2>Plan cost</h2><span class="price" style="font-size:1.3rem">Rs ${t}</span></div></div>`;
  const pct = Math.min(100, Math.round(t / b * 100));
  return `<div class="card"><div class="ch"><h2>Budget</h2><span class="price" style="font-size:1.3rem">Rs ${t} <span class="muted small">of Rs ${b}</span></span></div>
    <div class="macros" style="height:10px"><i style="width:${pct}%;background:${plan.over_budget ? "var(--bad)" : "var(--ok)"}"></i></div>
    ${plan.over_budget ? `<p class="msg warn" style="margin-bottom:0">Over budget by Rs ${t - b}. Try replacing the pricier meals.</p>` : `<p class="small muted" style="margin:8px 0 0">Rs ${b - t} left across the whole plan.</p>`}</div>`;
}
