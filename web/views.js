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
      ${teams.length ? `<div class="list">${teams.map(t => `<a class="it" href="#/team/${t.code}"><div><b>${esc(t.name)}</b><div class="small muted">${t.members} member${t.members > 1 ? "s" : ""}</div></div><span class="chip">${esc(t.code)}</span></a>`).join("")}</div>` : empty("", "No teams yet.")}</div>
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
        <div class="seg"><button data-md="team" class="${mode === "team" ? "on" : ""}"> With the team</button><button data-md="solo" class="${mode === "solo" ? "on" : ""}"> Separately</button></div>
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
      <div style="align-self:end"><button class="btn" id="plan"> Plan our break</button></div></div></div>
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
      <div class="seg" style="min-width:300px"><button data-w="ind" class="${which === "ind" ? "on" : ""}"> Individual picks</button><button data-w="feast" class="${which === "feast" ? "on" : ""}"> Team feast</button></div></div>
      ${which === "ind" ? indPanel() : feastPanel()}</div>
    <div class="grid g2">
      <div class="card"><h2>Break timeline</h2><ul class="tl">
        <li><span class="d">1</span><div>Order by <b>${esc(t.order_by)}</b></div></li><li><span class="d">2</span><div>Food arrives <b>${esc(t.food_arrives)}</b></div></li>
        <li><span class="d">3</span><div>Eat until <b>${esc(t.eating_until)}</b></div></li><li><span class="d">4</span><div>Back at desk <b>${esc(t.back_at_desk)}</b></div></li></ul>
        ${t.fits_break ? `<p class="msg ok">Fits your break with ${t.slack_min} min to spare.</p>` : `<p class="msg bad">Too tight. Lengthen the break or pick faster dishes.</p>`}
        ${r.alerts.map(a => `<p class="msg warn"> ${esc(a)}</p>`).join("")}
        ${r.my_health_notes.map(n => `<p class="msg info"> ${esc(n.dish)}: ${esc(n.note)}</p>`).join("")}
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
    <div class="grid g2"><div>${f.dishes.map(d => `<div class="list"><div class="it"><div><b>${d.qty} × ${esc(d.item.name)}</b><div class="small muted">${d.item.calories} kcal each · ${d.item.prep_min} min</div></div><b>${c} ${d.item.price * d.qty}</b></div></div>`).join("") || empty("", "No shared dishes available.")}</div>
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
    <div id="log">${L.today.length ? `<div class="list">${L.today.map(l => `<div class="it"><div><b>${esc(l.name)}</b><div class="small muted">${l.kcal} kcal · P ${l.protein} · C ${l.carbs} · F ${l.fat}</div></div><button class="icon-btn" data-del="${l.id}" aria-label="Delete">${ico("trash")}</button></div>`).join("")}</div>` : empty("", "Nothing logged today.")}</div>
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
      ${(r.healthier_alternatives || []).length ? `<p class="small" style="margin:8px 0 4px"><b>Lighter swaps:</b></p><div class="chips">${r.healthier_alternatives.map(a => `<span class="chip">${esc(a)}</span>`).join("")}</div>` : ""}
      ${r.notes ? `<p class="small muted">${esc(r.notes)}</p>` : ""}${(r.flags || []).map(x => `<p class="msg warn"> ${esc(x)}</p>`).join("")}
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
  let day = 0, days = 1, servings = 1;
  const draw = () => {
    view.innerHTML = `
    <div class="page-head"><div><h1>Meal plan</h1><p class="muted">Built around your goal, diet and allergies. Swap any meal.</p></div></div>
    <div class="card"><div class="row">
      <div style="width:150px"><label class="f">Plan length</label><select id="pd">${[1, 3, 7].map(n => `<option value="${n}" ${n === days ? "selected" : ""}>${n} day${n > 1 ? "s" : ""}</option>`).join("")}</select></div>
      <div style="width:190px"><label class="f">Budget, all days (Rs)</label><input id="pb" type="number" min="0" placeholder="optional" value="${plan && plan.budget ? plan.budget : ""}"></div>
      <div class="grow"><label class="f">Wishes (optional)</label><div class="with-mic"><input id="pw" maxlength="300" placeholder="e.g. high protein, no fried food, budget friendly">${mic("#pw")}</div></div>
      <div style="align-self:end"><button class="btn" id="gp"> ${plan ? "Regenerate" : "Generate"}</button></div></div></div>
    <div id="pl">${plan ? "" : `<div class="card">${empty("", "No plan yet. Generate one above.")}</div>`}</div>`;
    $("#gp").onclick = e => busy(e.target, "Planning… (up to 30s)", async () => {
      days = num($("#pd").value, 1); const r = await api("/mealplan/generate", { method: "POST", body: { days, wishes: $("#pw").value, budget: $("#pb").value ? num($("#pb").value) : null } });
      plan = r.plan; day = 0; draw();
    });
    if (plan) show();
  };
  const show = () => {
    const d0 = plan.days[day] || plan.days[0];
    const sc = v => Math.round((v || 0) * servings);
    const d = { ...d0, total: sc(d0.total ?? d0.meals.reduce((a, m) => a + (m.price || 0), 0)),
      meals: d0.meals.map(m => ({ ...m, kcal: sc(m.kcal), protein_g: sc(m.protein_g), carbs_g: sc(m.carbs_g), fat_g: sc(m.fat_g), price: sc(m.price) })) };
    const tot = d.meals.reduce((a, m) => ({ k: a.k + (m.kcal || 0), p: a.p + (m.protein_g || 0), c: a.c + (m.carbs_g || 0), f: a.f + (m.fat_g || 0) }), { k: 0, p: 0, c: 0, f: 0 });
    $("#pl").innerHTML = `
      <div class="row" style="margin-bottom:16px"><div style="width:140px"><label class="f">Servings</label><select id="sv">${[1, 2, 3, 4, 6].map(n => `<option value="${n}" ${n === servings ? "selected" : ""}>${n} ${n > 1 ? "people" : "person"}</option>`).join("")}</select></div>
        <div style="align-self:end"><button class="btn ghost" id="shop">Shopping list</button></div></div>
      ${plan.days.length > 1 ? `<div class="chips" style="margin-bottom:14px">${plan.days.map((_, i) => `<span class="chip btnlike ${i === day ? "on" : ""}" data-day="${i}" role="button" tabindex="0">Day ${i + 1}</span>`).join("")}</div>` : ""}
      ${plan.total_cost ? budgetCard(plan) : ""}
      <div class="card"><div class="ch"><h2>Day ${day + 1} · ${tot.k} kcal</h2><span class="price" style="font-size:1.1rem">Rs ${d.total ?? d.meals.reduce((a, m) => a + (m.price || 0), 0)}</span></div>${macroBar(tot.p, tot.c, tot.f)}</div>
      <div class="grid auto">${d.meals.map((m, i) => `<article class="card dish"><div class="top"><div><span class="chip">${esc(m.type)}</span><h3 style="margin-top:6px">${esc(m.name)}</h3></div><div class="right"><b>${m.kcal} kcal</b><div class="price">Rs ${m.price || 0}</div></div></div>
        <p class="small muted">${esc(m.portion || "")}</p>${macroBar(m.protein_g || 0, m.carbs_g || 0, m.fat_g || 0)}
        <p class="small"><b>Ingredients:</b> ${(m.ingredients || []).map(esc).join(", ")}</p>
        ${(m.alternatives || []).length ? `<div class="chips"><span class="small muted">Or:</span>${m.alternatives.map(a => `<span class="chip">${esc(a)}</span>`).join("")}</div>` : ""}
        <button class="btn ghost sm" data-rp="${i}">${ico("refresh")} Replace this meal</button></article>`).join("")}</div>
      ${plan.notes ? `<p class="msg info">${esc(plan.notes)}</p>` : ""}<p class="small muted">${esc(disclaimer)}</p>`;
    $("#sv").onchange = e => { servings = +e.target.value; show(); };
    $("#shop").onclick = () => shoppingList(plan, servings);
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
  const followUps = () => {
    $$(".fu", box).forEach(x => x.remove());
    const f = document.createElement("div"); f.className = "chips fu";
    f.innerHTML = ["Give me a lighter alternative", "How much protein is that?", "Suggest a vegetarian option"].map(s => `<span class="chip btnlike" role="button" tabindex="0">${s}</span>`).join("");
    $$(".chip", f).forEach(c => c.onclick = () => send(c.textContent));
    box.appendChild(f); box.scrollTop = box.scrollHeight;
  };
  const send = async text => {
    $$(".fu", box).forEach(x => x.remove());
    text = text.trim(); if (!text) return;
    add("user", text); const wait = add("assistant", "…");
    try {
      const r = await api("/chat", { method: "POST", body: { message: text, history: chatHistory } });
      chatHistory.push({ role: "user", text }, { role: "assistant", text: r.reply }); wait.innerHTML = md(r.reply); followUps();
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
    <div style="width:140px"><label class="f">Max kcal</label><input id="mk" type="number" min="100" placeholder="any"></div>
    <div style="align-self:end"><button class="btn" id="go">Find recipes</button></div></div></div>
  <div id="out"></div>`;
  $("#go").onclick = e => busy(e.target, "Cooking up ideas…", async () => {
    const r = await api("/recipes", { method: "POST", body: { ingredients: $("#ing").value, max_kcal: $("#mk").value ? num($("#mk").value) : null } });
    $("#out").innerHTML = r.recipes.length ? `<div class="grid auto">${r.recipes.map(x => `<article class="card dish"><div class="top"><h3>${esc(x.name)}</h3><span class="chip">${x.minutes} min · ${x.kcal} kcal</span></div>
      <p class="small"><b>Ingredients:</b> ${(x.ingredients || []).map(esc).join(", ")}</p><ol style="margin:0;padding-left:18px" class="small">${(x.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol></article>`).join("")}</div>`
      : `<div class="card">${empty("", "No recipes found. Try different ingredients.")}</div>`;
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

/* ------------------------------------------------------------------ menu (categories, favourites, detail) */
const CATS = [["all", "All"], ["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"],
  ["vegetarian", "Vegetarian"], ["protein", "High protein"], ["favs", "Favourites"]];

function dishCats(i) {
  const n = i.name.toLowerCase(), t = i.tags || [], c = new Set();
  if (/\b(eggs?|omelet+e?|paratha|oats|pancakes?|yogurt|toast|breakfast)\b/.test(n)) c.add("breakfast");
  const side = t.includes("drink") || t.includes("dessert") || t.includes("shareable") || /fries|coffee|brownie/.test(n);
  if (side || i.calories <= 350) c.add("snacks");
  if (!side && !c.has("breakfast")) { c.add("lunch"); c.add("dinner"); }
  if (t.includes("vegetarian")) c.add("vegetarian");
  if (i.protein >= 30) c.add("protein");
  return c;
}

async function toggleFav(id, btn) {
  const on = !S.favs.has(id);
  on ? S.favs.add(id) : S.favs.delete(id);
  if (btn) { btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on); }
  try { await api("/favorites/" + id, { method: on ? "POST" : "DELETE" }); }
  catch (e) { on ? S.favs.delete(id) : S.favs.add(id); if (btn) btn.classList.toggle("on", !on); toast(e.message, "bad"); }
}

function openDish(i) {
  const warns = dishWarnings(i);
  modal(`
    <img src="/static/img/${dishImg(i.name)}.jpg" alt="" style="width:calc(100% + 56px);margin:-28px -28px 18px;height:220px;object-fit:cover;display:block">
    <div class="ch"><h2>${esc(i.name)}</h2><span class="price" style="font-size:1.4rem">Rs ${i.price}</span></div>
    ${i.description ? `<p class="muted" style="margin:6px 0 10px">${esc(i.description)}</p>` : ""}
    <div class="chips" style="margin:10px 0"><span class="chip">${i.calories} kcal</span><span class="chip">${i.prep_min} min</span>${i.spice ? `<span class="chip">Spice ${i.spice}/3</span>` : ""}
      ${(i.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    ${macroBar(i.protein, i.carbs, i.fat)}
    ${warns.map(w => `<p class="msg bad"> ${esc(w)}</p>`).join("")}
    ${(i.allergens || []).length ? `<p class="small" style="margin-top:10px"><b>Allergens:</b> ${i.allergens.map(esc).join(", ")}</p>` : ""}
    ${i.chef_note ? `<p class="small muted"> ${esc(i.chef_note)}</p>` : ""}
    <h3 style="margin:16px 0 6px">Ingredients</h3><div id="ing" class="small muted">Loading…</div>
    <div class="row" style="margin-top:20px">
      <select id="mt" style="width:130px" aria-label="Meal type"><option>breakfast</option><option selected>lunch</option><option>dinner</option><option>snack</option></select>
      <button class="btn sm" id="addp">Add to meal plan</button>
      <button class="btn ghost sm" id="logit">Log this meal</button>
      <button class="btn ghost sm" id="favb" aria-pressed="${S.favs.has(i.id)}">${S.favs.has(i.id) ? "Saved" : "Save"}</button>
    </div>`,
  (m, close) => {
    api("/dish-info", { method: "POST", body: { id: i.id } }).then(d => {
      $("#ing", m).classList.remove("muted");
      $("#ing", m).innerHTML = `<div class="chips">${(d.ingredients || []).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>
        ${(d.alternatives || []).length ? `<p style="margin-top:10px"><b>Swaps:</b> ${d.alternatives.map(esc).join(" · ")}</p>` : ""}
        ${d.tip ? `<p style="margin-top:6px"> ${esc(d.tip)}</p>` : ""}<p class="muted" style="margin-top:6px">AI-generated, may vary by kitchen.</p>`;
    }).catch(() => { $("#ing", m).textContent = "Ingredient details are unavailable right now."; });
    $("#addp", m).onclick = e => busy(e.currentTarget, "Adding…", async () => { await api("/mealplan/add", { method: "POST", body: { item_id: i.id, day: 0, type: $("#mt", m).value } }); toast("Added to your meal plan", "ok"); });
    $("#logit", m).onclick = e => busy(e.currentTarget, "Logging…", async () => { await api("/logs", { method: "POST", body: { name: i.name, kcal: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat, source: "menu" } }); toast("Logged to today", "ok"); });
    $("#favb", m).onclick = async e => { await toggleFav(i.id, null); e.currentTarget.textContent = S.favs.has(i.id) ? "Saved" : "Save"; $$(`[data-fav="${i.id}"]`).forEach(b => b.classList.toggle("on", S.favs.has(i.id))); };
  });
}

VIEWS.menu = async view => {
  const [menu, reqs, favs, profile] = await Promise.all([api("/menu"), api("/menu/requests"), api("/favorites"), api("/profile")]);
  S.favs = new Set(favs.ids); S.profile = profile;
  let q = "", maxCal = "", diet = "", cat = "all"; const free = new Set();
  const draw = () => {
    const items = menu.items.filter(i =>
      (cat === "all" || (cat === "favs" ? S.favs.has(i.id) : dishCats(i).has(cat))) &&
      (!q || (i.name + " " + i.tags.join(" ")).toLowerCase().includes(q.toLowerCase())) &&
      (!maxCal || i.calories <= +maxCal) && (!diet || i.tags.includes(diet)) && ![...free].some(a => i.allergens.includes(a)));
    $("#count").textContent = `${items.length} of ${menu.items.length} dishes`;
    $("#dishes").innerHTML = items.length ? items.map(i => dishCard(i)).join("")
      : `<div class="card" style="grid-column:1/-1">${empty("", cat === "favs" ? "No favourites yet. Tap the heart on a dish." : "No dishes match. Try fewer filters, or add your own dish.")}</div>`;
  };
  view.innerHTML = `
  <div class="page-head"><div><h1>Menu</h1><p class="muted" id="count"></p></div>
    <button class="btn" id="suggest">${ico("plus")} Add your own dish</button></div>
  <div class="chips cats" role="tablist" aria-label="Categories">${CATS.map(([k, l]) => `<button class="catbtn ${k === cat ? "on" : ""}" data-cat="${k}" role="tab">${l}</button>`).join("")}</div>
  <div class="card"><div class="row">
    <div class="grow"><label class="f" for="q">Search</label><div class="with-mic"><input id="q" placeholder="burger, healthy, halal…">${mic("#q")}</div></div>
    <div style="width:130px"><label class="f" for="mc">Max kcal</label><input id="mc" type="number" min="0" placeholder="any"></div>
    <div style="width:160px"><label class="f" for="df">Diet</label><select id="df"><option value="">Any</option>${["halal", "vegetarian", "healthy", "chicken", "beef"].map(d => `<option>${d}</option>`).join("")}</select></div>
  </div><div class="chips" style="margin-top:12px"><span class="small muted" style="align-self:center">Free of:</span>${["gluten", "dairy", "egg", "nuts", "seafood"].map(a => `<span class="chip btnlike" data-f="${a}" role="button" tabindex="0">${a}</span>`).join("")}</div></div>
  <div class="grid auto" id="dishes"></div>
  <div class="card" style="margin-top:20px"><h2>Dishes you added</h2><div id="mine"></div></div>`;
  draw();
  $("#q").oninput = e => { q = e.target.value; draw(); };
  $("#mc").oninput = e => { maxCal = e.target.value; draw(); };
  $("#df").onchange = e => { diet = e.target.value; draw(); };
  $$("[data-f]").forEach(c => c.onclick = () => { const a = c.dataset.f; free.has(a) ? free.delete(a) : free.add(a); c.classList.toggle("on"); draw(); });
  $$("[data-cat]").forEach(b => b.onclick = () => { cat = b.dataset.cat; $$("[data-cat]").forEach(x => x.classList.toggle("on", x === b)); draw(); });
  const open = card => { const it = menu.items.find(i => i.id == card.dataset.id); if (it) openDish(it); };
  $("#dishes").onclick = e => {
    const fb = e.target.closest("[data-fav]");
    if (fb) { e.stopPropagation(); toggleFav(+fb.dataset.fav, fb).then(() => cat === "favs" && draw()); return; }
    const card = e.target.closest(".dish"); if (card) open(card);
  };
  $("#dishes").onkeydown = e => { if (e.key === "Enter" && e.target.classList.contains("dish")) open(e.target); };
  const mine = () => $("#mine").innerHTML = reqs.requests.length ? `<div class="list">${reqs.requests.map(r => `
    <div class="it"><div><b>${esc(r.name)}</b> <span class="badge ${r.status}">${r.status}</span>
      <div class="small muted">${esc(r.description || "")}${r.status === "approved" ? ` · Rs ${r.price} · ${r.calories} kcal` : ""}</div>
      ${r.chef_note ? `<div class="small"> ${esc(r.chef_note)}</div>` : ""}</div></div>`).join("")}</div>` : '<p class="muted small">You have not added any dishes yet.</p>';
  mine();
  $("#suggest").onclick = () => modal(`
    <h2 style="margin-bottom:6px">Add your own dish</h2><p class="muted small" style="margin-bottom:16px">AI estimates the price, calories and allergens and adds the dish to the menu straight away.</p>
    <div class="field"><label class="f" for="rn">What would you like?</label><div class="with-mic"><input id="rn" maxlength="80" placeholder="e.g. Daal chawal bowl">${mic("#rn")}</div></div>
    <div class="field"><label class="f" for="rd">Details (optional)</label><textarea id="rd" maxlength="400" placeholder="Ingredients, spice level, portion, dietary needs…"></textarea></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="rs">Add to menu</button></div>`,
  (m, close) => {
    $("[data-close]", m).onclick = close;
    $("#rs", m).onclick = e => busy(e.target, "Estimating…", async () => {
      const r = await api("/menu/requests", { method: "POST", body: { name: $("#rn", m).value, description: $("#rd", m).value } });
      reqs.requests.unshift(r); menu.items.push(r); mine(); draw(); close(); toast("Added to the menu", "ok");
    });
  });
};

/* ------------------------------------------------------------------ shopping list */
function shoppingList(plan, servings) {
  const ing = new Map(), orders = new Map();
  for (const d of plan.days) for (const m of d.meals) {
    const list = (m.ingredients || []).filter(Boolean);
    if (list.length) list.forEach(x => { const k = String(x).trim().toLowerCase(); ing.set(k, (ing.get(k) || 0) + 1); });
    else orders.set(m.name, (orders.get(m.name) || 0) + 1);
  }
  const lines = [...ing].map(([k, n]) => `${k}${n > 1 ? ` (used in ${n} meals)` : ""}`);
  const orderLines = [...orders].map(([k, n]) => `${k} × ${n * servings}`);
  const text = [`Shopping list (${servings} ${servings > 1 ? "people" : "person"})`, ...lines.map(l => "- " + l), ...(orderLines.length ? ["", "Order from the menu:", ...orderLines.map(l => "- " + l)] : [])].join("\n");
  modal(`<h2 style="margin-bottom:6px">Shopping list</h2><p class="muted small" style="margin-bottom:14px">For ${servings} ${servings > 1 ? "people" : "person"}. Scale the quantities yourself. Ingredient amounts are not estimated.</p>
    ${lines.length ? `<h3 style="margin-bottom:6px">Ingredients</h3><div class="list">${lines.map((l, n) => `<label class="it" style="cursor:pointer"><span>${esc(l)}</span><input type="checkbox" style="width:auto" aria-label="Got ${esc(l)}"></label>`).join("")}</div>` : ""}
    ${orderLines.length ? `<h3 style="margin:14px 0 6px">Order from the menu</h3><div class="list">${orderLines.map(l => `<div class="it">${esc(l)}</div>`).join("")}</div>` : ""}
    ${!lines.length && !orderLines.length ? empty("", "Your plan has no meals yet.") : ""}
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" id="cps">Copy list</button><button class="btn" data-close>Done</button></div>`,
  (m, close) => { $("[data-close]", m).onclick = close; $("#cps", m).onclick = () => copyText(text); });
}

/* ------------------------------------------------------------------ productivity: focus timer, hydration, meal-prep reminders */
const FF = {
  get(k, d) { try { const v = JSON.parse(store.get("ff_" + k)); return v ?? d; } catch { return d; } },
  set(k, v) { store.set("ff_" + k, JSON.stringify(v)); },
};
function notify(msg) {
  toast(msg);
  try { if ("Notification" in window && Notification.permission === "granted") new Notification("Flame n Focus", { body: msg }); } catch {}
}
const fmtTime = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
const timerState = () => FF.get("timer", { mode: "focus", running: false, end: 0, left: 25 * 60, focusMin: 25, breakMin: 5 });

function finishTimer() {
  const t = timerState();
  if (t.mode === "focus") {
    const s = FF.get("sessions", {}); s[todayStr()] = (s[todayStr()] || 0) + 1; FF.set("sessions", s);
    notify("Focus session complete. Take a break and have a snack or some water.");
    Object.assign(t, { mode: "break", running: false, left: t.breakMin * 60 });
  } else {
    notify("Break over. Ready for the next focus session?");
    Object.assign(t, { mode: "focus", running: false, left: t.focusMin * 60 });
  }
  FF.set("timer", t);
}

// background engine: runs while any page of the app is open and the user is signed in
setInterval(() => {
  if (!S.user) return;
  const now = Date.now(), t = timerState();
  if (t.running && now >= t.end) finishTimer();
  const hyd = FF.get("hydration", { on: false, mins: 60, last: 0 });
  if (hyd.on && now - hyd.last >= hyd.mins * 60000) { hyd.last = now; FF.set("hydration", hyd); notify("Time to drink some water "); }
  const hm = new Date().toTimeString().slice(0, 5), today = todayStr();
  const preps = FF.get("preps", []); let changed = false;
  preps.forEach(r => { if (r.time === hm && r.fired !== today) { r.fired = today; changed = true; notify(`Meal prep: ${r.label}`); } });
  if (changed) FF.set("preps", preps);
}, 15000);

VIEWS.focus = async view => {
  const [logs, plan] = await Promise.all([api("/logs?days=1"), api("/mealplan")]);
  const today = logs.days[logs.days.length - 1];
  const sessions = FF.get("sessions", {})[todayStr()] || 0;
  const planMeals = plan.plan ? plan.plan.days.reduce((a, d) => a + d.meals.length, 0) : 0;
  const hyd = FF.get("hydration", { on: false, mins: 60, last: 0 });
  view.innerHTML = `
  <div class="page-head"><div><h1>Focus</h1><p class="muted">Eat well, drink water, and work in focused sprints.</p></div></div>
  <div class="grid g2">
    <div class="card"><h2>Focus timer</h2>
      <div class="timer" id="tdisp" role="timer" aria-live="off">25:00</div><p class="center small muted" id="tmode"></p>
      <div class="row" style="justify-content:center;margin:14px 0">
        <button class="btn" id="tgo">Start</button><button class="btn ghost" id="trs">Reset</button></div>
      <div class="grid g2"><div class="field"><label class="f" for="fm">Focus (min)</label><input id="fm" type="number" min="1" max="120"></div>
        <div class="field"><label class="f" for="bm">Break (min)</label><input id="bm" type="number" min="1" max="60"></div></div></div>
    <div class="card"><h2>Today's summary</h2>
      <div class="grid g2" style="margin-bottom:10px">
        <div><p class="stat">${today.kcal}</p><p class="small muted">of ${logs.target} kcal eaten</p></div>
        <div><p class="stat">${sessions}</p><p class="small muted">focus sessions</p></div>
        <div><p class="stat">${logs.today.length}</p><p class="small muted">meals logged</p></div>
        <div><p class="stat">${planMeals}</p><p class="small muted">meals in your plan</p></div></div>
      ${macroBar(today.protein, today.carbs, today.fat)}</div>
    <div class="card"><h2>Hydration reminder</h2>
      <p class="small muted" style="margin-bottom:12px">A nudge to drink water. Works while this app is open in a browser tab.</p>
      <div class="row"><div style="width:140px"><label class="f" for="hm">Every (min)</label><input id="hm" type="number" min="15" max="240" value="${hyd.mins}"></div>
        <label class="row" style="gap:8px;align-self:end;margin-bottom:12px"><input type="checkbox" id="hon" style="width:auto" ${hyd.on ? "checked" : ""}> Remind me</label></div></div>
    <div class="card"><h2>Meal prep reminders</h2>
      <div class="row" style="margin-bottom:12px"><input type="time" id="pt" style="width:140px" value="12:30"><input id="pl" class="grow" maxlength="60" placeholder="e.g. Prep lunch bowls"><button class="btn sm" id="pa">Add</button></div>
      <div id="plist"></div></div>
  </div>`;
  const disp = $("#tdisp");
  const paint = () => {
    const t = timerState(), left = t.running ? Math.max(0, Math.round((t.end - Date.now()) / 1000)) : t.left;
    disp.textContent = fmtTime(left); $("#tmode").textContent = t.mode === "focus" ? "Focus session" : "Break";
    $("#tgo").textContent = t.running ? "Pause" : "Start"; document.title = t.running ? `${fmtTime(left)} · Flame n Focus` : "Flame-n-Focus";
  };
  paint(); const tick = setInterval(() => { if (!$("#tdisp")) { clearInterval(tick); document.title = "Flame-n-Focus"; return; } paint(); }, 1000);
  const t0 = timerState(); $("#fm").value = t0.focusMin; $("#bm").value = t0.breakMin;
  $("#tgo").onclick = () => {
    const t = timerState();
    if (t.running) { t.left = Math.max(0, Math.round((t.end - Date.now()) / 1000)); t.running = false; }
    else { t.end = Date.now() + t.left * 1000; t.running = true; try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} }
    FF.set("timer", t); paint();
  };
  $("#trs").onclick = () => { const t = timerState(); t.running = false; t.left = (t.mode === "focus" ? t.focusMin : t.breakMin) * 60; FF.set("timer", t); paint(); };
  const durations = () => { const t = timerState(); t.focusMin = Math.min(120, Math.max(1, num($("#fm").value, 25))); t.breakMin = Math.min(60, Math.max(1, num($("#bm").value, 5)));
    if (!t.running) t.left = (t.mode === "focus" ? t.focusMin : t.breakMin) * 60; FF.set("timer", t); paint(); };
  $("#fm").onchange = durations; $("#bm").onchange = durations;
  const saveHyd = () => { const h = FF.get("hydration", { on: false, mins: 60, last: 0 }); h.mins = Math.min(240, Math.max(15, num($("#hm").value, 60))); h.on = $("#hon").checked; if (h.on) h.last = Date.now();
    FF.set("hydration", h); if (h.on) { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} } };
  $("#hm").onchange = saveHyd; $("#hon").onchange = () => { saveHyd(); toast($("#hon").checked ? "Hydration reminders on" : "Hydration reminders off", "ok"); };
  const drawPreps = () => { const l = FF.get("preps", []);
    $("#plist").innerHTML = l.length ? `<div class="list">${l.map((r, i) => `<div class="it"><div><b>${esc(r.time)}</b> ${esc(r.label)}</div><button class="icon-btn" data-d="${i}" aria-label="Delete reminder">${ico("trash")}</button></div>`).join("")}</div>` : '<p class="small muted">No reminders yet.</p>';
    $$("[data-d]", $("#plist")).forEach(b => b.onclick = () => { const x = FF.get("preps", []); x.splice(+b.dataset.d, 1); FF.set("preps", x); drawPreps(); }); };
  drawPreps();
  $("#pa").onclick = () => { const label = $("#pl").value.trim(); if (!label) return toast("Add a short label.", "bad");
    const l = FF.get("preps", []); l.push({ time: $("#pt").value || "12:30", label, fired: "" }); l.sort((a, b) => a.time.localeCompare(b.time)); FF.set("preps", l); $("#pl").value = ""; drawPreps(); };
};
