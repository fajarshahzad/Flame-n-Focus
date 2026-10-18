"""Plain-Python group ordering, bill split, timeline and safety checks."""
from collections import Counter
from datetime import datetime, timedelta

EAT_MIN = 12
DELIVERY_BUFFER_MIN = 5
SEVERE = {"nuts", "seafood", "egg"}


def feasible(item: dict, c: dict) -> list[str]:
    """Reasons an item fails a person's constraints (empty list = OK)."""
    why = []
    if c.get("budget") and item["price"] > c["budget"]:
        why.append(f"over budget ({item['price']} > {c['budget']})")
    if c.get("max_prep_min") and item["prep_min"] > c["max_prep_min"]:
        why.append("takes too long")
    if c.get("max_spice") is not None and item["spice"] > c["max_spice"]:
        why.append("too spicy")
    if c.get("max_calories") and item.get("calories") and item["calories"] > c["max_calories"]:
        why.append(f"over {c['max_calories']} kcal")
    if c.get("min_spice") and item["spice"] < c["min_spice"]:
        why.append("not spicy enough")
    for t in c.get("must_tags", []):
        if t not in item["tags"]:
            why.append(f"not {t}")
    for a in c.get("avoid_allergens", []):
        if a in item["allergens"]:
            why.append(f"contains {a}")
    name = item["name"].lower()
    for w in c.get("avoid_words", []):
        if w in name or w in item["tags"]:
            why.append(f"contains {w}")
    return why


def _score(item: dict, c: dict, already: Counter) -> float:
    s = 0.0
    name = item["name"].lower()
    for w in c.get("likes", []):
        if w in name or w in item["tags"]:
            s += 3
    s += 1.5 * already[item["name"]]  # batching bonus: same dish as teammates
    if c.get("budget"):
        s += 0.5 * (1 - item["price"] / c["budget"])
    if "drink" in item["tags"] or "dessert" in item["tags"]:
        liked = any(w in item["tags"] or w in name for w in c.get("likes", []))
        s -= 0 if liked else 10  # mains first unless asked for
    return s


def build_order(menu: dict, people: list[dict]) -> list[dict]:
    """people: [{name, constraints}] -> [{name, item|None, reasons}]"""
    items = menu["items"]
    chosen: Counter = Counter()
    results = []
    for p in people:
        c = p["constraints"]
        ok = [i for i in items if not feasible(i, c)]
        if not ok:
            # report the closest miss so the user knows what to relax
            best = min(items, key=lambda i: len(feasible(i, c)))
            results.append({"name": p["name"], "item": None, "reasons": feasible(best, c)})
            continue
        pick = max(ok, key=lambda i: _score(i, c, chosen))
        chosen[pick["name"]] += 1
        results.append({"name": p["name"], "item": pick, "reasons": []})
    return results


def split_bill(results: list[dict], tax_pct: float = 0.0, delivery_fee: int = 0) -> dict:
    served = [r for r in results if r["item"]]
    if not served:
        return {"per_person": {}, "subtotal": 0, "total": 0}
    subtotal = sum(r["item"]["price"] for r in served)
    extra = subtotal * tax_pct / 100 + delivery_fee
    per = {}
    for r in served:
        share = r["item"]["price"] + extra * r["item"]["price"] / subtotal
        per[r["name"]] = round(share)
    return {"per_person": per, "subtotal": subtotal, "total": round(subtotal + extra)}


def timeline(results: list[dict], break_start: str, break_minutes: int) -> dict:
    served = [r["item"] for r in results if r["item"]]
    start = datetime.strptime(break_start, "%H:%M")
    end = start + timedelta(minutes=break_minutes)
    prep = max((i["prep_min"] for i in served), default=0)
    ready_by = start + timedelta(minutes=DELIVERY_BUFFER_MIN)
    order_by = ready_by - timedelta(minutes=prep + DELIVERY_BUFFER_MIN)
    eat_end = ready_by + timedelta(minutes=EAT_MIN)
    return {
        "order_by": order_by.strftime("%H:%M"),
        "food_arrives": ready_by.strftime("%H:%M"),
        "eating_until": eat_end.strftime("%H:%M"),
        "back_at_desk": end.strftime("%H:%M"),
        "fits_break": eat_end <= end,
        "slack_min": int((end - eat_end).total_seconds() // 60),
        "longest_prep": prep,
    }


def group_alerts(results: list[dict], people: list[dict]) -> list[str]:
    """Allergen guard. Anonymous on purpose: health details stay private."""
    alerts = []
    served = [r["item"] for r in results if r["item"]]
    for a in sorted(SEVERE):
        has_avoider = any(a in p["constraints"].get("avoid_allergens", []) for p in people)
        sharing = sorted({it["name"] for it in served if a in it["allergens"]})
        if has_avoider and sharing:
            alerts.append(f"Someone on the team avoids {a}. {', '.join(sharing)} contain it - order and label separately.")
    return alerts


def batch_summary(results: list[dict]) -> list[dict]:
    counts = Counter(r["item"]["name"] for r in results if r["item"])
    price = {r["item"]["name"]: r["item"]["price"] for r in results if r["item"]}
    return [{"item": n, "qty": q, "line_total": q * price[n]} for n, q in counts.most_common()]


def summary_text(results, bill, tl, cur="Rs") -> str:
    lines = [f"- {r['name']}: {r['item']['name']} ({cur} {r['item']['price']})" for r in results if r["item"]]
    return "\n".join(lines) + (
        f"\nTotal {cur} {bill['total']}. Order by {tl['order_by']}, "
        f"eat until {tl['eating_until']}, back at {tl['back_at_desk']}."
    )


def quick_bites(menu: dict, c: dict, limit: int = 4) -> list[dict]:
    """Solo mode: items that fit the constraints, mains first, then fastest and cheapest."""
    ok = [i for i in menu["items"] if not feasible(i, c)]
    side = lambda i: "drink" in i["tags"] or "dessert" in i["tags"]
    ok.sort(key=lambda i: (side(i), i["prep_min"], i["price"]))
    return ok[:limit]


def team_feast(menu: dict, people: list[dict], tax_pct: float = 0.0, delivery_fee: int = 0) -> dict:
    """Alternative to individual picks: shared dishes the whole team can eat."""
    items = menu["items"]
    n = max(len(people), 1)
    side = lambda i: "drink" in i["tags"] or "dessert" in i["tags"]
    ok_all = [i for i in items if all(not feasible(i, p["constraints"]) for p in people)]
    mains = sorted([i for i in ok_all if not side(i)],
                   key=lambda i: (0 if "shareable" in i["tags"] else 1, i["price"]))
    dishes, unserved, mode = [], [], "all"
    if mains:
        picks = mains[:max(1, min(3, n))]
        per = -(-n // len(picks))
        dishes = [{"item": i, "qty": per} for i in picks]
        extras = [i for i in ok_all if "shareable" in i["tags"] and i not in picks]
        if extras and n >= 3:
            dishes.append({"item": extras[0], "qty": max(1, n // 3)})
    else:
        mode = "cover"
        left = {p["name"] for p in people}
        pool = [i for i in items if not side(i)]
        while left:
            def gain(i):
                return {p["name"] for p in people if p["name"] in left and not feasible(i, p["constraints"])}
            best = max(pool, key=lambda i: (len(gain(i)), -i["price"]), default=None)
            g = gain(best) if best else set()
            if not g:
                unserved = sorted(left)
                break
            dishes.append({"item": best, "qty": len(g)})
            left -= g
    subtotal = sum(d["item"]["price"] * d["qty"] for d in dishes)
    total = round(subtotal * (1 + tax_pct / 100) + delivery_fee)
    portions = sum(d["qty"] for d in dishes) or 1
    avg_kcal = round(sum(d["item"]["calories"] * d["qty"] for d in dishes) / portions)
    return {"mode": mode, "dishes": dishes, "subtotal": subtotal, "total": total,
            "per_head": round(total / n), "avg_kcal": avg_kcal, "unserved": unserved}
