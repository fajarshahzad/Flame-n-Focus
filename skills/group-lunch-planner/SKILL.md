---
name: group-lunch-planner
description: Plans a group lunch for a coworking team. Use when several people each state food preferences, budget and break time and need one combined order, a bill split and a break timeline.
---

# Group lunch planner

Turn each person's request into constraints, pick one dish per person from a menu, batch identical dishes, split the bill and schedule the break.

## Steps
1. Get the menu as JSON: `{"restaurant", "currency", "items": [{"name", "price", "prep_min", "spice", "tags", "allergens", "calories"}]}`. If you only have a photo, read it and produce this JSON first (English or Urdu text).
2. For each person, convert the free text (English, Urdu or Roman Urdu) into constraints: `budget`, `max_prep_min`, `max_spice`, `min_spice`, `must_tags`, `avoid_allergens`, `avoid_words`, `likes`.
3. Reject any item that breaks a hard constraint (budget, allergens, must_tags, prep time, spice). Among the rest, prefer liked items and dishes teammates already picked, so the kitchen can batch them. Choose mains before drinks or desserts.
4. Split the bill in proportion to each person's item price, adding tax and delivery fee pro rata.
5. Timeline: food arrives 5 minutes after break start, allow 12 minutes to eat, and order early enough for the longest prep time. Warn if eating does not fit inside the break.
6. Warn when someone avoids nuts, seafood or egg and a teammate's dish contains it.

The reference implementation is `flame/planner.py` and `flame/llm.py` in this repository.
