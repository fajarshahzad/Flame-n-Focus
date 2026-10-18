"""HTTP API + static frontend. Business logic lives in flame/; this file is glue only.

Every data endpoint requires a signed-in user and only touches that user's own rows
(or a team they belong to). Chef-only endpoints check the role server-side.
"""
import json
import logging
import os
import secrets
import string
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from flame import auth, llm, planner, profile as prof
from flame.db import db, init, item as item_row

ROOT = Path(__file__).parent
MAX_UPLOAD = 8 * 1024 * 1024

init()
app = FastAPI(title="Flame-n-Focus")
User = Depends(auth.current_user)


def chef(user: dict = User) -> dict:
    return auth.chef_only(user)


def _llm_fail(e: Exception) -> HTTPException:
    logging.getLogger("uvicorn.error").error("model call failed: %r", e, exc_info=e)
    return HTTPException(502, f"The AI model could not answer right now ({type(e).__name__}). Try again.")


def _need_model():
    if not llm.backend():
        raise HTTPException(503, "No AI model configured. Set GEMINI_API_KEY or OLLAMA_MODEL in .env.")


async def _read_image(f: UploadFile | None):
    if not f:
        return None
    data = await f.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Image too large (max 8 MB).")
    if not (f.content_type or "").startswith("image/"):
        raise HTTPException(415, "Please upload an image file.")
    return data, f.content_type


# ------------------------------------------------------------------ auth

class SignUp(BaseModel):
    name: str
    email: str
    password: str
    role: str = "member"


class Login(BaseModel):
    email: str
    password: str


@app.get("/api/status")
def status():
    return {"backend": llm.backend() or "offline-fallback"}


@app.post("/api/auth/signup")
def signup(b: SignUp):
    u = auth.create_user(b.email, b.name, b.password, "member")  # no self-service chef role
    return {"token": auth.new_session(u["id"]), "user": u}


@app.post("/api/auth/login")
def login(b: Login):
    u = auth.login(b.email, b.password)
    return {"token": auth.new_session(u["id"]), "user": u}


@app.post("/api/auth/logout")
def logout(user: dict = User):
    with db() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (user["token"],))
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = User):
    return {k: user[k] for k in ("id", "email", "name", "role")}


@app.delete("/api/account")
def delete_account(user: dict = User):
    """Privacy: removes the user and everything tied to them."""
    with db() as c:
        c.execute("DELETE FROM users WHERE id=?", (user["id"],))
    return {"ok": True}


# ------------------------------------------------------------------ profile

class Profile(BaseModel):
    age: int | None = Field(None, ge=1, le=120)
    height_cm: int | None = Field(None, ge=50, le=250)
    weight_kg: int | None = Field(None, ge=10, le=400)
    activity: str = "light"
    diet: list[str] = []
    allergies: list[str] = []
    conditions: str = Field("", max_length=500)
    goal: str = "maintain"
    kcal_target: int = Field(2000, ge=800, le=6000)
    dislikes: list[str] = []
    budget: int | None = Field(None, ge=0, le=100000)  # per-meal budget, Rs


def get_profile(uid: int) -> dict:
    with db() as c:
        row = c.execute("SELECT * FROM profiles WHERE user_id=?", (uid,)).fetchone()
    return prof.load(row) if row else prof.load({"user_id": uid})


@app.get("/api/profile")
def read_profile(user: dict = User):
    return get_profile(user["id"])


@app.put("/api/profile")
def write_profile(b: Profile, user: dict = User):
    if b.activity not in prof.ACTIVITY or b.goal not in prof.GOALS:
        raise HTTPException(422, "Invalid activity or goal.")
    clean = lambda xs: [x.strip().lower()[:40] for x in xs if x.strip()][:20]
    with db() as c:
        c.execute(
            "UPDATE profiles SET age=?,height_cm=?,weight_kg=?,activity=?,diet=?,allergies=?,conditions=?,goal=?,kcal_target=?,"
            "dislikes=?,budget=? "
            "WHERE user_id=?",
            (b.age, b.height_cm, b.weight_kg, b.activity, json.dumps(clean(b.diet)), json.dumps(clean(b.allergies)),
             b.conditions.strip(), b.goal, b.kcal_target, json.dumps(clean(b.dislikes)), b.budget, user["id"]),
        )
    return get_profile(user["id"])


# ------------------------------------------------------------------ menu

def approved_menu() -> dict:
    with db() as c:
        rows = c.execute("SELECT * FROM menu_items WHERE status='approved' ORDER BY id").fetchall()
    return {"restaurant": "Today's Menu", "currency": "Rs", "items": [item_row(r) for r in rows]}


@app.get("/api/menu")
def menu(user: dict = User):
    return approved_menu()


@app.get("/api/menu/search")
def search_menu(q: str = "", max_cal: int | None = None, max_price: int | None = None,
                diet: str = "", free_of: str = "", user: dict = User):
    items = approved_menu()["items"]
    out = []
    for i in items:
        if q and q.lower() not in (i["name"] + " " + " ".join(i["tags"]) + " " + i.get("description", "")).lower():
            continue
        if max_cal and i["calories"] > max_cal:
            continue
        if max_price and i["price"] > max_price:
            continue
        if diet and diet.lower() not in i["tags"]:
            continue
        if free_of and any(a.strip() and a.strip().lower() in i["allergens"] for a in free_of.split(",")):
            continue
        out.append(i)
    return {"items": out}


class DishRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field("", max_length=400)


@app.post("/api/menu/requests")
def request_dish(b: DishRequest, user: dict = User):
    """Member adds an off-menu dish. It is approved automatically with AI-estimated price, calories and allergens."""
    with db() as c:
        recent = c.execute("SELECT COUNT(*) FROM menu_items WHERE requested_by=? AND source='custom' AND created>?",
                           (user["id"], int(time.time()) - 86400)).fetchone()[0]
    if recent >= 10:
        raise HTTPException(429, "You can add up to 10 dishes per day.")
    draft = {}
    if llm.backend():
        try:
            draft = llm.estimate_dish(b.name, b.description)
        except Exception:
            draft = {}
    price = min(max(_to_int(draft.get("price")), 0), 20000) or 500  # fallback when the model gave no price
    note = "Auto-approved. Price and nutrition are AI estimates." if draft else "Auto-approved with default estimates (AI offline)."
    with db() as c:
        cur = c.execute(
            "INSERT INTO menu_items(name,description,price,prep_min,spice,tags,allergens,calories,protein,carbs,fat,"
            "chef_note,status,source,requested_by,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'approved','custom',?,?)",
            (b.name.strip(), b.description.strip(), price, int(draft.get("prep_min") or 15), int(draft.get("spice") or 0),
             json.dumps(draft.get("tags") or []), json.dumps(draft.get("allergens") or []),
             int(draft.get("calories") or 0), int(draft.get("protein") or 0), int(draft.get("carbs") or 0),
             int(draft.get("fat") or 0), note, user["id"], int(time.time())),
        )
        row = c.execute("SELECT * FROM menu_items WHERE id=?", (cur.lastrowid,)).fetchone()
    return item_row(row)


@app.get("/api/menu/requests")
def list_requests(user: dict = User):
    """Chefs see every custom request; members see only their own."""
    with db() as c:
        if user["role"] == "chef":
            rows = c.execute(
                "SELECT m.*,u.name AS requester FROM menu_items m LEFT JOIN users u ON u.id=m.requested_by "
                "WHERE m.source='custom' ORDER BY (m.status='pending') DESC, m.created DESC").fetchall()
        else:
            rows = c.execute(
                "SELECT m.*,u.name AS requester FROM menu_items m LEFT JOIN users u ON u.id=m.requested_by "
                "WHERE m.source='custom' AND m.requested_by=? ORDER BY m.created DESC", (user["id"],)).fetchall()
    return {"requests": [item_row(r) for r in rows]}


class ItemBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""
    price: int = Field(0, ge=0, le=100000)
    prep_min: int = Field(10, ge=0, le=240)
    spice: int = Field(0, ge=0, le=3)
    tags: list[str] = []
    allergens: list[str] = []
    calories: int = Field(0, ge=0, le=5000)
    protein: int = Field(0, ge=0, le=500)
    carbs: int = Field(0, ge=0, le=1000)
    fat: int = Field(0, ge=0, le=500)
    chef_note: str = Field("", max_length=300)


class Decision(ItemBody):
    approve: bool


def _item_params(b: ItemBody):
    lc = lambda xs: json.dumps([x.strip().lower() for x in xs if x.strip()])
    return (b.name.strip(), b.description, b.price, b.prep_min, b.spice, lc(b.tags), lc(b.allergens),
            b.calories, b.protein, b.carbs, b.fat, b.chef_note)


@app.post("/api/menu/requests/{rid}/decide")
def decide(rid: int, b: Decision, user: dict = Depends(chef)):
    with db() as c:
        row = c.execute("SELECT * FROM menu_items WHERE id=? AND source='custom'", (rid,)).fetchone()
        if not row:
            raise HTTPException(404, "Request not found.")
        if b.approve and b.price <= 0:
            raise HTTPException(422, "Set a price before approving.")
        c.execute(
            "UPDATE menu_items SET name=?,description=?,price=?,prep_min=?,spice=?,tags=?,allergens=?,calories=?,"
            "protein=?,carbs=?,fat=?,chef_note=?,status=? WHERE id=?",
            (*_item_params(b), "approved" if b.approve else "rejected", rid))
        return item_row(c.execute("SELECT * FROM menu_items WHERE id=?", (rid,)).fetchone())


@app.post("/api/menu/items")
def add_item(b: ItemBody, user: dict = Depends(chef)):
    with db() as c:
        cur = c.execute(
            "INSERT INTO menu_items(name,description,price,prep_min,spice,tags,allergens,calories,protein,carbs,fat,"
            "chef_note,status,source,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'approved','menu',?)",
            (*_item_params(b), int(time.time())))
        return item_row(c.execute("SELECT * FROM menu_items WHERE id=?", (cur.lastrowid,)).fetchone())


@app.put("/api/menu/items/{iid}")
def edit_item(iid: int, b: ItemBody, user: dict = Depends(chef)):
    with db() as c:
        if not c.execute("SELECT 1 FROM menu_items WHERE id=?", (iid,)).fetchone():
            raise HTTPException(404, "Item not found.")
        c.execute("UPDATE menu_items SET name=?,description=?,price=?,prep_min=?,spice=?,tags=?,allergens=?,calories=?,"
                  "protein=?,carbs=?,fat=?,chef_note=? WHERE id=?", (*_item_params(b), iid))
        return item_row(c.execute("SELECT * FROM menu_items WHERE id=?", (iid,)).fetchone())


@app.delete("/api/menu/items/{iid}")
def delete_item(iid: int, user: dict = Depends(chef)):
    with db() as c:
        c.execute("DELETE FROM menu_items WHERE id=?", (iid,))
    return {"ok": True}


@app.post("/api/menu/scan")
async def scan_menu(file: UploadFile = File(...), user: dict = Depends(chef)):
    img = await _read_image(file)
    _need_model()
    try:
        return llm.scan_menu(*img)
    except Exception as e:
        raise _llm_fail(e)


class Bulk(BaseModel):
    items: list[ItemBody]


@app.post("/api/menu/bulk")
def bulk_import(b: Bulk, user: dict = Depends(chef)):
    with db() as c:
        for it in b.items[:100]:
            c.execute(
                "INSERT INTO menu_items(name,description,price,prep_min,spice,tags,allergens,calories,protein,carbs,fat,"
                "chef_note,status,source,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'approved','menu',?)",
                (*_item_params(it), int(time.time())))
    return {"imported": len(b.items[:100])}


# ------------------------------------------------------------------ teams

def _code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


def _team_for(code: str, uid: int) -> dict:
    with db() as c:
        t = c.execute("SELECT * FROM teams WHERE code=?", (code.upper(),)).fetchone()
        if not t or not c.execute("SELECT 1 FROM team_members WHERE team_code=? AND user_id=?", (t["code"], uid)).fetchone():
            raise HTTPException(404, "Team not found, or you are not a member.")
        members = c.execute(
            "SELECT m.user_id,m.text,m.mode,u.name FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_code=?",
            (t["code"],)).fetchall()
    return {"team": dict(t), "members": [dict(m) for m in members]}


class TeamBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    shared_text: str = Field("", max_length=300)
    break_start: str = "13:00"
    break_minutes: int = Field(20, ge=10, le=120)


class JoinBody(BaseModel):
    code: str


class MyChoice(BaseModel):
    text: str = Field("", max_length=300)
    mode: str = "team"


@app.post("/api/teams")
def create_team(b: TeamBody, user: dict = User):
    code = _code()
    with db() as c:
        c.execute("INSERT INTO teams(code,name,host_id,shared_text,break_start,break_minutes,created) VALUES(?,?,?,?,?,?,?)",
                  (code, b.name.strip(), user["id"], b.shared_text, b.break_start, b.break_minutes, int(time.time())))
        c.execute("INSERT INTO team_members(team_code,user_id) VALUES(?,?)", (code, user["id"]))
    return _team_for(code, user["id"])


@app.post("/api/teams/join")
def join_team(b: JoinBody, user: dict = User):
    code = b.code.strip().upper()
    with db() as c:
        if not c.execute("SELECT 1 FROM teams WHERE code=?", (code,)).fetchone():
            raise HTTPException(404, "No team with that code.")
        c.execute("INSERT OR IGNORE INTO team_members(team_code,user_id) VALUES(?,?)", (code, user["id"]))
    return _team_for(code, user["id"])


@app.get("/api/teams/mine")
def my_teams(user: dict = User):
    with db() as c:
        rows = c.execute(
            "SELECT t.code,t.name,t.host_id,(SELECT COUNT(*) FROM team_members x WHERE x.team_code=t.code) AS members "
            "FROM teams t JOIN team_members m ON m.team_code=t.code WHERE m.user_id=? ORDER BY t.created DESC",
            (user["id"],)).fetchall()
    return {"teams": [dict(r) for r in rows]}


@app.get("/api/teams/{code}")
def get_team(code: str, user: dict = User):
    return _team_for(code, user["id"])


@app.put("/api/teams/{code}")
def update_team(code: str, b: TeamBody, user: dict = User):
    t = _team_for(code, user["id"])["team"]
    if t["host_id"] != user["id"]:
        raise HTTPException(403, "Only the team host can change team settings.")
    with db() as c:
        c.execute("UPDATE teams SET name=?,shared_text=?,break_start=?,break_minutes=? WHERE code=?",
                  (b.name.strip(), b.shared_text, b.break_start, b.break_minutes, t["code"]))
    return _team_for(code, user["id"])


@app.put("/api/teams/{code}/me")
def my_choice(code: str, b: MyChoice, user: dict = User):
    t = _team_for(code, user["id"])["team"]
    if b.mode not in ("team", "solo"):
        raise HTTPException(422, "mode must be 'team' or 'solo'.")
    with db() as c:
        c.execute("UPDATE team_members SET text=?,mode=? WHERE team_code=? AND user_id=?",
                  (b.text, b.mode, t["code"], user["id"]))
    return _team_for(code, user["id"])


@app.delete("/api/teams/{code}/me")
def leave_team(code: str, user: dict = User):
    t = _team_for(code, user["id"])["team"]
    with db() as c:
        c.execute("DELETE FROM team_members WHERE team_code=? AND user_id=?", (t["code"], user["id"]))
    return {"ok": True}


class PlanOpts(BaseModel):
    tax_pct: float = Field(0, ge=0, le=30)
    delivery_fee: int = Field(0, ge=0, le=5000)


@app.post("/api/teams/{code}/plan")
def team_plan(code: str, o: PlanOpts, user: dict = User):
    data = _team_for(code, user["id"])
    t, members = data["team"], data["members"]
    menu_ = approved_menu()
    cur = menu_["currency"]
    profiles = {m["user_id"]: get_profile(m["user_id"]) for m in members}
    parse_all = ThreadPoolExecutor(max_workers=8)
    team_f = parse_all.submit(llm.parse_preferences, t["shared_text"])  # runs alongside the members' parses

    def build(m):
        own = llm.parse_preferences(m["text"])
        c = prof.merge(own, team_f.result()) if m["mode"] == "team" else own
        c = prof.merge(c, prof.constraints_from_profile(profiles[m["user_id"]]))  # health profile always applies
        return {"name": m["name"], "constraints": c, "mode": m["mode"], "uid": m["user_id"]}

    people = list(parse_all.map(build, members))
    parse_all.shutdown(wait=False)

    results = planner.build_order(menu_, people)
    bill = planner.split_bill(results, o.tax_pct, o.delivery_fee)
    try:
        tl = planner.timeline(results, t["break_start"], t["break_minutes"])
    except ValueError:
        raise HTTPException(422, "Team break time must look like HH:MM.")
    feast = planner.team_feast(menu_, people, o.tax_pct, o.delivery_fee)
    summary = planner.summary_text(results, bill, tl, cur)

    # Health cautions go only to the person they concern, never to the team.
    mine = next((r for r in results if r["item"] and next(p for p in people if p["name"] == r["name"])["uid"] == user["id"]), None)
    notes = []
    if mine:
        try:
            notes = llm.health_notes(profiles[user["id"]], [mine["item"]["name"]]) if llm.backend() else []
        except Exception:
            notes = []
    return {
        "individual": {"results": [{k: v for k, v in r.items()} for r in results],
                       "batch": planner.batch_summary(results), "bill": bill},
        "feast": feast,
        "timeline": tl,
        "alerts": planner.group_alerts(results, people),
        "modes": {p["name"]: p["mode"] for p in people},
        "summary": summary,
        "my_health_notes": notes,
        "disclaimer": llm.DISCLAIMER,
    }


class Explain(BaseModel):
    summary: str = Field(max_length=2000)


@app.post("/api/explain")
def explain(b: Explain, user: dict = User):
    """Loaded after the plan is shown so the plan itself returns fast."""
    return {"explanation": llm.explain_plan(b.summary)}


# ------------------------------------------------------------------ solo quick bite

class Focus(BaseModel):
    text: str = Field(max_length=300)


@app.post("/api/focus")
def focus(b: Focus, user: dict = User):
    c = prof.merge(llm.parse_preferences(b.text), prof.constraints_from_profile(get_profile(user["id"])))
    return {"items": planner.quick_bites(approved_menu(), c), "constraints": c}


# ------------------------------------------------------------------ nutrition + logs

@app.post("/api/nutrition/analyze")
async def analyze(file: UploadFile | None = File(None), text: str = Form(""), user: dict = User):
    img = await _read_image(file)
    if not img and not text.strip():
        raise HTTPException(422, "Add a photo or describe your meal.")
    if llm.backend():
        try:
            d = llm.analyze_food(text, img)
            d["flags"] = _food_flags(get_profile(user["id"]), [i["name"] for i in d["items"]])
            d["disclaimer"] = llm.DISCLAIMER
            return d
        except Exception as e:
            if img:
                raise _llm_fail(e)
    # Text-only offline fallback: match dish names from the menu.
    hits = [i for i in approved_menu()["items"] if i["name"].lower() in text.lower()]
    if not hits:
        raise HTTPException(503, "No AI model available and no menu dish matched your description.")
    items = [{"name": i["name"], "portion": "1 serving", "kcal": i["calories"], "protein_g": i["protein"],
              "carbs_g": i["carbs"], "fat_g": i["fat"]} for i in hits]
    return {"items": items, "confidence": "medium", "notes": "Matched from the menu.", "flags": [],
            "total": {k: sum(i[k] for i in items) for k in ("kcal", "protein_g", "carbs_g", "fat_g")},
            "disclaimer": llm.DISCLAIMER}


def _food_flags(p: dict, names: list[str]) -> list[str]:
    flags = []
    c = prof.constraints_from_profile(p)
    low = " ".join(names).lower()
    for w in c["avoid_words"]:
        if w in low:
            flags.append(f"Contains {w}, which is on your avoid list.")
    try:
        flags += [f"{n['dish']}: {n['note']}" for n in llm.health_notes(p, names)]
    except Exception:
        pass
    return flags


class LogBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kcal: int = Field(0, ge=0, le=5000)
    protein: int = Field(0, ge=0, le=500)
    carbs: int = Field(0, ge=0, le=1000)
    fat: int = Field(0, ge=0, le=500)
    source: str = "manual"


@app.post("/api/logs")
def add_log(b: LogBody, user: dict = User):
    with db() as c:
        cur = c.execute("INSERT INTO food_logs(user_id,day,name,kcal,protein,carbs,fat,source,created) VALUES(?,?,?,?,?,?,?,?,?)",
                        (user["id"], date.today().isoformat(), b.name, b.kcal, b.protein, b.carbs, b.fat, b.source[:20], int(time.time())))
    return {"id": cur.lastrowid}


@app.delete("/api/logs/{lid}")
def del_log(lid: int, user: dict = User):
    with db() as c:
        c.execute("DELETE FROM food_logs WHERE id=? AND user_id=?", (lid, user["id"]))
    return {"ok": True}


@app.get("/api/logs")
def logs(days: int = 7, user: dict = User):
    days = max(1, min(days, 90))
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    with db() as c:
        rows = c.execute("SELECT * FROM food_logs WHERE user_id=? AND day>=? ORDER BY created DESC", (user["id"], start)).fetchall()
    by_day = {(date.today() - timedelta(days=i)).isoformat(): {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0}
              for i in range(days - 1, -1, -1)}
    for r in rows:
        for k in ("kcal", "protein", "carbs", "fat"):
            by_day[r["day"]][k] += r[k]
    p = get_profile(user["id"])
    return {"target": p["kcal_target"], "goal": p["goal"], "days": [{"day": d, **v} for d, v in by_day.items()],
            "today": [dict(r) for r in rows if r["day"] == date.today().isoformat()]}


# ------------------------------------------------------------------ meal plans, chat, recipes

class PlanReq(BaseModel):
    days: int = Field(1, ge=1, le=7)
    wishes: str = Field("", max_length=300)
    budget: int | None = Field(None, ge=0, le=1_000_000)  # total for all days
    budget: int | None = Field(None, ge=0, le=1_000_000)  # total for all days


class ReplaceReq(BaseModel):
    day: int
    index: int
    request: str = Field("", max_length=200)


def _menu_lines(items: list[dict]) -> list[str]:
    return [f'{i["name"]} (Rs {i["price"]}, {i["calories"]} kcal)' for i in items]


def _to_int(v) -> int:
    try:
        return max(0, int(float(str(v).lower().replace("rs", "").replace(",", "").strip() or 0)))
    except ValueError:
        return 0


def _finalize(plan: dict, items: list[dict], budget: int | None) -> dict:
    """Use real menu prices where a meal is a menu dish; total the cost against the budget."""
    by_name = {i["name"].lower(): i for i in items}
    total = 0
    for d in plan.get("days", []):
        day_total = 0
        for m in d.get("meals", []):
            hit = by_name.get(str(m.get("name", "")).lower())
            m["price"] = hit["price"] if hit else _to_int(m.get("price"))
            day_total += m["price"]
        d["total"] = day_total
        total += day_total
    plan["total_cost"] = total
    plan["budget"] = budget
    plan["over_budget"] = bool(budget) and total > budget
    return plan


@app.post("/api/mealplan/generate")
def gen_plan(b: PlanReq, user: dict = User):
    _need_model()
    p = get_profile(user["id"])
    items = approved_menu()["items"]
    lines = _menu_lines(items)
    share = b.budget // b.days if b.budget else None

    def day(n: int, budget, avoid=None):
        return llm.meal_day(p, n, b.days, b.wishes, lines, budget, avoid)

    try:
        with ThreadPoolExecutor(max_workers=b.days) as ex:
            days = list(ex.map(lambda n: day(n, share), range(1, b.days + 1)))
        plan = _finalize({"days": days, "notes": ""}, items, b.budget)
        if share:  # repair days that blew their share: feed the real cost back, up to 2 rounds
            by_day = {d["day"]: d for d in plan["days"]}
            for _ in range(2):
                over = [d for d in by_day.values() if d["total"] > share]
                if not over:
                    break
                with ThreadPoolExecutor(max_workers=len(over)) as ex:
                    redo = list(ex.map(lambda d: llm.meal_day(
                        p, d["day"], b.days, b.wishes, lines, share, None,
                        {"meals": d["meals"], "total": d["total"]}), over))
                for r in redo:
                    _finalize({"days": [r]}, items, None)
                    if r["total"] < by_day[r["day"]]["total"]:
                        by_day[r["day"]] = r
            plan = _finalize({"days": [by_day[k] for k in sorted(by_day)], "notes": ""}, items, b.budget)
    except Exception as e:
        raise _llm_fail(e)
    with db() as c:
        c.execute("INSERT INTO meal_plans(user_id,plan,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,updated=excluded.updated",
                  (user["id"], json.dumps(plan), int(time.time())))
    return {"plan": plan, "disclaimer": llm.DISCLAIMER}


@app.get("/api/mealplan")
def get_plan(user: dict = User):
    with db() as c:
        row = c.execute("SELECT plan FROM meal_plans WHERE user_id=?", (user["id"],)).fetchone()
    return {"plan": json.loads(row["plan"]) if row else None, "disclaimer": llm.DISCLAIMER}


@app.post("/api/mealplan/replace")
def replace(b: ReplaceReq, user: dict = User):
    _need_model()
    with db() as c:
        row = c.execute("SELECT plan FROM meal_plans WHERE user_id=?", (user["id"],)).fetchone()
        if not row:
            raise HTTPException(404, "Generate a plan first.")
        plan = json.loads(row["plan"])
        try:
            meal = plan["days"][b.day]["meals"][b.index]
        except (IndexError, KeyError, TypeError):
            raise HTTPException(404, "Meal not found.")
        budget = plan.get("budget")
        cap = None
        if budget:  # the new meal may use this meal's price plus whatever budget is left
            cap = _to_int(meal.get("price")) + max(budget - plan.get("total_cost", 0), 0)
        try:
            plan["days"][b.day]["meals"][b.index] = llm.replace_meal(get_profile(user["id"]), meal, b.request, cap)
        except Exception as e:
            raise _llm_fail(e)
        plan = _finalize(plan, approved_menu()["items"], budget)
        c.execute("UPDATE meal_plans SET plan=?,updated=? WHERE user_id=?", (json.dumps(plan), int(time.time()), user["id"]))
    return {"plan": plan}


class ChatMsg(BaseModel):
    role: str
    text: str = Field(max_length=1000)


class ChatReq(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatMsg] = []


@app.post("/api/chat")
def chat(b: ChatReq, user: dict = User):
    _need_model()
    try:
        reply = llm.chat(get_profile(user["id"]), [m.model_dump() for m in b.history],
                         b.message, _menu_lines(approved_menu()["items"]))
    except Exception as e:
        raise _llm_fail(e)
    return {"reply": reply}


class RecipeReq(BaseModel):
    ingredients: str = Field(min_length=2, max_length=200)
    max_kcal: int | None = None


@app.post("/api/recipes")
def recipes(b: RecipeReq, user: dict = User):
    _need_model()
    p = get_profile(user["id"])
    try:
        return {"recipes": llm.recipes(b.ingredients, ", ".join(p["diet"]), b.max_kcal)}
    except Exception as e:
        raise _llm_fail(e)


# ------------------------------------------------------------------ favorites, dish info, add-to-plan

@app.get("/api/favorites")
def list_favorites(user: dict = User):
    with db() as c:
        rows = c.execute("SELECT item_id FROM favorites WHERE user_id=?", (user["id"],)).fetchall()
    return {"ids": [r["item_id"] for r in rows]}


@app.post("/api/favorites/{iid}")
def add_favorite(iid: int, user: dict = User):
    with db() as c:
        if not c.execute("SELECT 1 FROM menu_items WHERE id=? AND status='approved'", (iid,)).fetchone():
            raise HTTPException(404, "Dish not found.")
        c.execute("INSERT OR IGNORE INTO favorites(user_id,item_id) VALUES(?,?)", (user["id"], iid))
    return {"ok": True}


@app.delete("/api/favorites/{iid}")
def remove_favorite(iid: int, user: dict = User):
    with db() as c:
        c.execute("DELETE FROM favorites WHERE user_id=? AND item_id=?", (user["id"], iid))
    return {"ok": True}


class DishInfoReq(BaseModel):
    id: int


@app.post("/api/dish-info")
def dish_info(b: DishInfoReq, user: dict = User):
    """Ingredients and swaps for a menu dish (model-generated, so labelled as estimates in the UI)."""
    with db() as c:
        row = c.execute("SELECT name,description FROM menu_items WHERE id=? AND status='approved'", (b.id,)).fetchone()
    if not row:
        raise HTTPException(404, "Dish not found.")
    _need_model()
    try:
        return llm.dish_info(row["name"], row["description"] or "")
    except Exception as e:
        raise _llm_fail(e)


class AddMeal(BaseModel):
    item_id: int
    day: int = Field(0, ge=0, le=6)
    type: str = "lunch"


@app.post("/api/mealplan/add")
def add_to_plan(b: AddMeal, user: dict = User):
    """Add a menu dish to the saved plan (creates a one-day plan if there is none)."""
    items = approved_menu()["items"]
    it = next((i for i in items if i["id"] == b.item_id), None)
    if not it:
        raise HTTPException(404, "Dish not found.")
    meal = {"type": b.type if b.type in ("breakfast", "lunch", "dinner", "snack") else "lunch", "name": it["name"],
            "price": it["price"], "ingredients": [], "portion": "1 serving", "kcal": it["calories"],
            "protein_g": it["protein"], "carbs_g": it["carbs"], "fat_g": it["fat"], "alternatives": []}
    with db() as c:
        row = c.execute("SELECT plan FROM meal_plans WHERE user_id=?", (user["id"],)).fetchone()
        plan = json.loads(row["plan"]) if row else {"days": [], "notes": "", "budget": None}
        while len(plan["days"]) <= b.day:
            plan["days"].append({"day": len(plan["days"]) + 1, "meals": []})
        plan["days"][b.day]["meals"].append(meal)
        plan = _finalize(plan, items, plan.get("budget"))
        c.execute("INSERT INTO meal_plans(user_id,plan,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,updated=excluded.updated",
                  (user["id"], json.dumps(plan), int(time.time())))
    return {"plan": plan}


# ------------------------------------------------------------------ frontend

@app.get("/")
def index():
    return FileResponse(ROOT / "web" / "index.html")


app.mount("/static", StaticFiles(directory=ROOT / "web"), name="static")
