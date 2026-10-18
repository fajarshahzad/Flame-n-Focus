"""Gemma 4 calls (Gemini API or local Ollama), with offline fallbacks so the demo never dies."""
import base64
import json
import os
import re
import time
import urllib.request

from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")
THINKING = os.getenv("GEMMA_THINKING", "minimal")  # Gemma 4 default "thinking" takes ~25s per call; minimal ~1s
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "")  # e.g. the Gemma 4 tag you pulled; enables local mode


def backend() -> str | None:
    """'gemini' if a key is set, else 'ollama' if OLLAMA_MODEL is set, else None (offline fallback)."""
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    if OLLAMA_MODEL:
        return "ollama"
    return None


def _generate(prompt: str, image: tuple[bytes, str] | None = None) -> str:
    """Single entry point for model calls. Raises if no backend or the call fails."""
    b = backend()
    if b == "gemini":
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        contents = [prompt]
        if image:
            contents.insert(0, types.Part.from_bytes(data=image[0], mime_type=image[1]))
        cfg = types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level=THINKING)) if THINKING else None
        for attempt in range(3):
            try:
                return client.models.generate_content(model=MODEL, contents=contents, config=cfg).text
            except Exception as e:
                msg = str(e)
                if cfg is not None and "hinking" in msg:  # a model without thinking levels
                    cfg = None
                    continue
                transient = any(code in msg for code in ("500", "503", "429", "UNAVAILABLE", "INTERNAL"))
                if not transient or attempt == 2:
                    raise
                time.sleep(1.5 * (attempt + 1))
    if b == "ollama":
        msg = {"role": "user", "content": prompt}
        if image:
            msg["images"] = [base64.b64encode(image[0]).decode()]
        body = json.dumps({"model": OLLAMA_MODEL, "messages": [msg], "stream": False}).encode()
        req = urllib.request.Request(f"{OLLAMA_URL}/api/chat", body, {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)["message"]["content"]
    raise RuntimeError("No model backend: set GEMINI_API_KEY or OLLAMA_MODEL")


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i != -1], default=-1)
    if start == -1:
        raise ValueError("no JSON in response")
    return json.JSONDecoder().raw_decode(text[start:])[0]


def scan_menu(image_bytes: bytes, mime: str = "image/jpeg") -> dict:
    """Menu photo (English/Urdu) -> structured menu dict. Raises on failure."""
    prompt = (
        "Read this restaurant menu photo (text may be English, Urdu or both). "
        'Return ONLY JSON: {"restaurant": str, "currency": "Rs", "items": ['
        '{"name": str (English), "price": int, "prep_min": int (estimate), '
        '"spice": 0-3 (estimate), "tags": [from halal, vegetarian, chicken, beef, healthy, dessert, drink, shareable], '
        '"allergens": [from gluten, dairy, egg, nuts, seafood], "calories": int (estimate)}]}'
    )
    menu = _extract_json(_generate(prompt, (image_bytes, mime)))
    if not menu.get("items"):
        raise ValueError("no items found")
    menu.setdefault("restaurant", "Scanned menu")
    menu.setdefault("currency", "Rs")
    for it in menu["items"]:
        it.setdefault("prep_min", 10)
        it.setdefault("spice", 0)
        it.setdefault("tags", [])
        it.setdefault("allergens", [])
        it.setdefault("calories", 0)
    return menu


_SYSTEM = (
    "You turn a person's lunch request (English, Urdu or Roman Urdu) into JSON constraints. "
    'Return ONLY JSON: {"budget": int|null, "max_prep_min": int|null, "max_spice": 0-3|null, "min_spice": 0-3|null (only if they want it hot), "max_calories": int|null, '
    '"must_tags": [halal|vegetarian|healthy...], "avoid_allergens": [gluten|dairy|egg|nuts|seafood], '
    '"avoid_words": [food words to avoid], "likes": [food words they want]}.'
)


_PREF_CACHE: dict[str, dict] = {}


def parse_preferences(text: str) -> dict:
    """Free text -> constraints. Falls back to keyword rules if the API is unavailable."""
    key = text.strip().lower()
    if key in _PREF_CACHE:
        return dict(_PREF_CACHE[key])
    if not key:
        return _normalise({})
    out = None
    if backend():
        try:
            out = _normalise(_extract_json(_generate(f"{_SYSTEM}\n\nRequest: {text}")))
        except Exception:
            pass
    rules = _normalise(_fallback_parse(text))
    if out is None:
        out = rules
    else:  # the model sometimes misses plain numbers; the regex rules do not
        for k in ("budget", "max_prep_min", "max_calories"):
            if out.get(k) is None:
                out[k] = rules[k]
    _PREF_CACHE[key] = out
    return dict(out)


def _fallback_parse(text: str) -> dict:
    t = text.lower()
    out = {"must_tags": [], "avoid_allergens": [], "avoid_words": [], "likes": []}
    m = re.search(r"(?:rs\.?|under|budget|within)\s*(\d{3,5})|(\d{3,5})\s*(?:rs|rupees|tak)", t)
    if m:
        out["budget"] = int(m.group(1) or m.group(2))
    m = re.search(r"(\d{2,4})\s*(?:kcal|cal|calories)", t)
    if m:
        out["max_calories"] = int(m.group(1))
    m = re.search(r"(\d{1,2})\s*(?:min|minute|mins)", t)
    if m:
        out["max_prep_min"] = int(m.group(1))
    if any(w in t for w in ("mild", "no spice", "bina mirch", "not spicy")):
        out["max_spice"] = 0
    elif any(w in t for w in ("medium", "thora", "kam mirch")):
        out["max_spice"] = 1
    elif any(w in t for w in ("spicy", "teekha", "zyada mirch", "hot")):
        out["min_spice"] = 2
    if any(w in t for w in ("veg", "sabzi", "no meat")) and "non-veg" not in t:
        out["must_tags"].append("vegetarian")
    if "healthy" in t or "diet" in t:
        out["must_tags"].append("healthy")
    if "halal" in t:
        out["must_tags"].append("halal")
    for a in ("gluten", "dairy", "egg", "nuts", "seafood"):
        if re.search(rf"(no|avoid|allergic to|without)\s+{a}", t):
            out["avoid_allergens"].append(a)
    for w in ("mayo", "beef", "chicken", "fries", "burger", "wrap", "salad", "coffee", "steak"):
        if re.search(rf"(no|avoid|without)\s+{w}", t):
            out["avoid_words"].append(w)
        elif w in t:
            out["likes"].append(w)
    return out


def _normalise(c: dict) -> dict:
    return {
        "budget": c.get("budget"),
        "max_prep_min": c.get("max_prep_min"),
        "max_spice": c.get("max_spice"),
        "min_spice": c.get("min_spice"),
        "max_calories": c.get("max_calories"),
        "must_tags": [s.lower() for s in c.get("must_tags") or []],
        "avoid_allergens": [s.lower() for s in c.get("avoid_allergens") or []],
        "avoid_words": [s.lower() for s in c.get("avoid_words") or []],
        "likes": [s.lower() for s in c.get("likes") or []],
    }


def explain_plan(plan_summary: str) -> str:
    """Short friendly explanation of the group plan; plain text fallback."""
    if backend():
        try:
            return _generate(
                "In 3 short friendly sentences, explain why this group lunch plan works "
                "(mention savings from batching and the timeline). Plan:\n" + plan_summary
            ).strip()
        except Exception:
            pass
    return "Orders are batched so the kitchen prepares them together, and everyone is back at their desks on time."


# ---------------------------------------------------------------- nutrition & coaching

DISCLAIMER = "General wellness information, not medical advice."


def _profile_blurb(p: dict) -> str:
    return (
        f"age {p.get('age') or 'unknown'}, activity {p.get('activity')}, goal {p.get('goal')}, "
        f"daily target {p.get('kcal_target')} kcal, diet {p.get('diet') or 'none'}, "
        f"allergies {p.get('allergies') or 'none'}, declared conditions: {p.get('conditions') or 'none'}"
    )


def analyze_food(text: str = "", image: tuple[bytes, str] | None = None) -> dict:
    """Food photo and/or description -> items with estimated portion and macros."""
    prompt = (
        "Identify the food in this meal and estimate portion and nutrition. "
        f"User description: {text or '(none)'}. "
        'Return ONLY JSON: {"items": [{"name": str, "portion": str, "kcal": int, "protein_g": int, '
        '"carbs_g": int, "fat_g": int}], "confidence": "low|medium|high", "notes": str}. '
        "Estimates only; say so in notes if the photo is unclear."
    )
    d = _extract_json(_generate(prompt, image))
    items = d.get("items") or []
    for i in items:
        for k in ("kcal", "protein_g", "carbs_g", "fat_g"):
            i[k] = int(i.get(k) or 0)
    d["items"] = items
    d["total"] = {k: sum(i[k] for i in items) for k in ("kcal", "protein_g", "carbs_g", "fat_g")}
    return d


def estimate_dish(name: str, description: str) -> dict:
    """Draft nutrition/allergen estimate for a member-suggested dish; the chef reviews it."""
    prompt = (
        f"A customer wants this dish: {name}. {description}. Estimate for one serving. "
        'Return ONLY JSON: {"price": int (realistic restaurant price in Pakistani rupees), "calories": int, "protein": int, "carbs": int, "fat": int, "spice": 0-3, '
        '"prep_min": int, "tags": [from halal, vegetarian, chicken, beef, healthy, dessert, drink, shareable], '
        '"allergens": [from gluten, dairy, egg, nuts, seafood]}'
    )
    return _extract_json(_generate(prompt))


def meal_day(profile: dict, day: int, total_days: int, goal_text: str, menu_lines: list[str],
             day_budget: int | None = None, avoid: list[str] | None = None, fix: dict | None = None) -> dict:
    """One day of a meal plan. Days are generated in parallel, which is faster and always returns every day."""
    money = (
        f"HARD LIMIT: the prices of all meals in this day must add up to at most Rs {day_budget}. Add them up before "
        "answering. The restaurant dishes below are pricey, so when the limit is tight prefer cheap home-style meals "
        "(eggs, daal, rice, roti, yogurt, fruit, chana) at roughly Rs 80-250 each. " if day_budget else ""
    )
    if fix and day_budget:
        prev = ", ".join(f"{m['name']} Rs {m['price']}" for m in fix["meals"])
        money += (f"Your previous attempt cost Rs {fix['total']} ({prev}), which is Rs {fix['total'] - day_budget} over. "
                  "Replace the most expensive meals with cheaper ones so the total fits. ")
    variety = f"Do not repeat these meals from other days: {', '.join(avoid)}. " if avoid else ""
    prompt = (
        f"Create day {day} of a {total_days}-day meal plan for a person: {_profile_blurb(profile)}. "
        f"Extra wishes: {goal_text or 'none'}. Respect allergies and diet strictly. {money}{variety}"
        f"Restaurant menu with prices (reuse these dishes and their exact prices where sensible): {'; '.join(menu_lines[:25])}. "
        "Other meals need a realistic price in Pakistani rupees. "
        'Return ONLY JSON: {"day": ' + str(day) + ', "meals": [{"type": "breakfast|lunch|dinner|snack", '
        '"name": str, "price": int (Rs), "ingredients": [str], "portion": str, "kcal": int, "protein_g": int, '
        '"carbs_g": int, "fat_g": int, "alternatives": [str]}]}. Keep the day near the daily calorie target.'
    )
    d = _extract_json(_generate(prompt))
    if not d.get("meals"):
        raise ValueError("empty day")
    d["day"] = day
    return d


def replace_meal(profile: dict, meal: dict, request: str, max_price: int | None = None) -> dict:
    cap = f"The replacement must cost at most Rs {max_price}. " if max_price else ""
    prompt = (
        f"Person: {_profile_blurb(profile)}. Replace this meal: {json.dumps(meal)}. "
        f"Their request: {request or 'something different'}. Respect allergies and diet strictly. {cap}"
        "Return ONLY the replacement meal as JSON with the same keys."
    )
    return _extract_json(_generate(prompt))


def chat(profile: dict, history: list[dict], message: str, menu_lines: list[str]) -> str:
    convo = "\n".join(f"{m['role']}: {m['text']}" for m in history[-8:])
    prompt = (
        "You are Flame, a friendly food and nutrition assistant inside a coworking lunch app. "
        f"The user: {_profile_blurb(profile)}. Today's menu with prices and calories: {'; '.join(menu_lines[:30])}. "
        "When asked about the menu, always include each dish's price in Rs. "
        "Answer briefly (max 5 sentences). Never diagnose or give medical advice; for health "
        "conditions suggest talking to a doctor or dietitian. Reply in the user's language "
        f"(English, Urdu or Roman Urdu).\n{convo}\nuser: {message}\nassistant:"
    )
    return _generate(prompt).strip()


def health_notes(profile: dict, dishes: list[str]) -> list[dict]:
    """Flag dishes that may not suit a declared condition. Returns [] when nothing to flag."""
    if not profile.get("conditions") or not dishes:
        return []
    prompt = (
        f"Declared conditions: {profile['conditions']}. Dishes: {dishes}. For each dish that may be "
        'unsuitable, give a short caution. Return ONLY JSON: [{"dish": str, "note": str}]. '
        "Return [] if all look fine. This is general information, not medical advice."
    )
    out = _extract_json(_generate(prompt))
    return out if isinstance(out, list) else []


def recipes(ingredients: str, diet: str, max_kcal: int | None) -> list[dict]:
    prompt = (
        f"Suggest 3 simple recipes using: {ingredients}. Diet: {diet or 'any'}. "
        f"Max calories per serving: {max_kcal or 'any'}. "
        'Return ONLY JSON: [{"name": str, "minutes": int, "kcal": int, "ingredients": [str], "steps": [str]}]'
    )
    out = _extract_json(_generate(prompt))
    return out if isinstance(out, list) else out.get("recipes", [])
