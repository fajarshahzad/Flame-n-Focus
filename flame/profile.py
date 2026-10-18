"""Turn a stored health profile into planner constraints, and merge constraint sets."""
import json

ALLERGEN_WORDS = {
    "gluten": ["gluten", "wheat", "celiac", "coeliac"],
    "dairy": ["dairy", "milk", "lactose", "cheese"],
    "egg": ["egg"],
    "nuts": ["nut", "peanut", "almond", "cashew", "walnut", "pistachio"],
    "seafood": ["seafood", "fish", "shrimp", "prawn", "shellfish"],
}
DIETS = {"halal": "halal", "vegetarian": "vegetarian", "healthy": "healthy"}
ACTIVITY = ["sedentary", "light", "moderate", "active"]
GOALS = ["maintain", "lose", "gain", "muscle"]


def load(row) -> dict:
    d = dict(row)
    d["diet"] = json.loads(d.get("diet") or "[]")
    d["allergies"] = json.loads(d.get("allergies") or "[]")
    d["dislikes"] = json.loads(d.get("dislikes") or "[]")
    return d


def constraints_from_profile(p: dict) -> dict:
    c = {"budget": None, "max_prep_min": None, "max_spice": None, "min_spice": None, "max_calories": None,
         "must_tags": [], "avoid_allergens": [], "avoid_words": [], "likes": []}
    for d in p.get("diet", []):
        d = d.lower().strip()
        if d == "vegan":
            c["must_tags"].append("vegetarian")
            c["avoid_allergens"] += ["dairy", "egg"]
        elif d in DIETS:
            c["must_tags"].append(DIETS[d])
    for a in p.get("allergies", []):
        a = a.lower().strip()
        matched = [k for k, words in ALLERGEN_WORDS.items() if any(w in a for w in words)]
        if matched:
            c["avoid_allergens"] += matched
        elif a:
            c["avoid_words"].append(a)
    c["avoid_words"] += [w.lower().strip() for w in p.get("dislikes", []) if w.strip()]
    if p.get("budget"):
        c["budget"] = p["budget"]  # per-meal budget
    if p.get("goal") == "lose" and p.get("kcal_target"):
        c["max_calories"] = round(p["kcal_target"] / 3 * 1.15)
    return c


def _min(a, b):
    vals = [v for v in (a, b) if v is not None]
    return min(vals) if vals else None


def _max(a, b):
    vals = [v for v in (a, b) if v is not None]
    return max(vals) if vals else None


def merge(a: dict, b: dict) -> dict:
    """Strictest combination of two constraint sets."""
    return {
        "budget": _min(a.get("budget"), b.get("budget")),
        "max_prep_min": _min(a.get("max_prep_min"), b.get("max_prep_min")),
        "max_spice": _min(a.get("max_spice"), b.get("max_spice")),
        "min_spice": _max(a.get("min_spice"), b.get("min_spice")),
        "max_calories": _min(a.get("max_calories"), b.get("max_calories")),
        **{k: sorted(set(a.get(k, [])) | set(b.get(k, []))) for k in
           ("must_tags", "avoid_allergens", "avoid_words", "likes")},
    }
