# Flame-n-Focus 🔥

Lunch that fits everyone on the team. Each person says what they want (English, Urdu or Roman Urdu), and the app builds one smart order, splits the bill and plans the break so everyone is back at their desks on time. Members can also add dishes that are not on the menu.

Built at Hacktoberfest Hack Day Lahore. Open source, Apache-2.0.

## What it does
- **Sign up / sign in.**
- **Health profile:** age, activity, goal, diet, allergies and declared conditions. It is applied automatically to every suggestion and is never shown to teammates.
- **Team lunch:** create a team and share a 6-character code. Each person chooses to eat **with the team** (their request is combined with the team-wide wish) or **separately**. The planner shows **individual picks** (batched for the kitchen, with a bill split) or a **team feast** (shared dishes everyone can eat), plus a break timeline and a WhatsApp-ready summary.
- **Menu + your own dishes:** browse and filter the menu (calories, diet, allergen-free). Add an off-menu dish and Gemma estimates the price, calories, macros and allergens. It is approved automatically and joins the menu for everyone (limit 10 per user per day), labelled as AI-estimated.
- **Nutrition:** food photo, text or voice, then estimated items, calories and macros, with warnings for your allergies and conditions. Log meals and track 7-day progress against your goal.
- **Meal plans:** 1, 3 or 7 days based on your profile and an optional total budget (e.g. Rs 3000 for 3 days), with a price on every meal, a running total against the budget, alternatives and one-tap meal replacement.
- **Ask Flame:** a chat assistant for food and nutrition questions. **Recipes:** ideas from the ingredients you have.
- **Voice input** (Web Speech API) on every text field, including Urdu.

## Models
Open model: **Gemma 4** by Google DeepMind (default `gemma-4-26b-a4b-it`).
- **Gemini API (default):** set `GEMINI_API_KEY` in `.env` (free key at https://aistudio.google.com).
- **Local with Ollama (no key):** install Ollama, pull a Gemma 4 model, set `OLLAMA_MODEL=<tag>` in `.env`.
- **No model:** sign-in, menu, teams, planning and logging still work with a keyword parser. AI-only features (food photo analysis, meal plans, chat, recipes, menu scanning) show a clear message.

Gemma 4's default "thinking" makes each call take about 25 seconds. The app sets `thinking_level=minimal` (about 1 second). Set `GEMMA_THINKING=` (empty) to turn that off.

## Run
```
pip install -r requirements.txt
cp .env.example .env        # add your Gemini key
uvicorn server:app --port 8000
```
Open http://localhost:8000 and create an account.

## Layout
- `web/`: the frontend (plain HTML, CSS and JS, no build step)
- `server.py`: FastAPI endpoints only
- `flame/llm.py`: all model calls (Gemini API / Ollama) and fallbacks
- `flame/planner.py`: ordering, bill split, timeline, team feast, allergen guard (no model needed)
- `flame/profile.py`: health profile to constraints; `flame/auth.py`, `flame/db.py`: accounts and SQLite storage
- `skills/group-lunch-planner/SKILL.md`: the planning logic packaged as an Agent Skill

## Privacy and safety
- Passwords are hashed with scrypt. Sessions are random bearer tokens that expire after 14 days.
- Every data endpoint requires sign-in and returns only your own data or your team's. Chef actions are checked on the server.
- Team allergen warnings are anonymous. Health notes are shown only to the person they concern.
- "Delete my account" in Profile removes the account and all its data.
- Nutrition and health text is general information, **not medical advice**.

The bundled menu is invented demo data, not any real restaurant's menu.
