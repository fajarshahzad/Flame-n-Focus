# Flame-n-Focus

Flame-n-Focus is a team lunch-planning and food wellness application. It combines individual food requests into a practical group order, estimates cost and timing, and provides tools for menu browsing, nutrition logging, meal planning, food questions, recipes, and focus and hydration reminders.

Built at Hacktoberfest Hack Day Lahore. Licensed under Apache-2.0. The bundled menu contains fictional demo data and does not represent a real restaurant.

## Product design

[Open the published Flame-n-Focus UI design in Figma](https://www.figma.com/design/QLzjU0EbcApWHn8bfRVWvv/FoodZero-Restaurant-and-Food-for-Figma-Web-Template--Community-?node-id=0-1&p=f&t=Od9LJVB286DzxFEU-0)

The colours, typography and photography follow the exported frames of that design. Images in `web/img/` are cropped from the export.

## User experience

Visitors arrive at the sign-in page, where they can also create an account, then arrive at Home. The primary pages are available from the sidebar. Home summarizes teams and nutrition activity; the Chef Console appears only for chef accounts.

```mermaid
flowchart TD
	Auth[Log in or sign up] --> Home[Home]
	Home --> Team[Team Lunch]
	Home --> Menu[Menu]
	Home --> Nutrition[Nutrition]
	Home --> Plan[Meal Plan]
	Home --> Ask[Ask Flame]
	Home --> Recipes[Recipes]
	Home --> Focus[Focus]
	Home --> Profile[Profile]
	Home --> Chef[Chef Console: chef role]
	Team --> Setup[Create or join team]
	Setup --> Request[Add request and choose team or separate]
	Request --> Results[Review picks, shared feast, bill, and timeline]
	Menu --> Browse[Browse by category, filter, save favourites]
	Browse --> Detail[Dish detail: add to plan or log meal]
	Menu --> Suggest[Add your own dish: auto-approved with estimates]
	Nutrition --> Analyze[Describe or photograph meal]
	Analyze --> Log[Review estimate and log meal]
	Plan --> Generate[Choose plan length, budget, and wishes]
	Generate --> Review[Review plan, replace meals, shopping list]
	Ask --> Chat[Ask a food question]
	Recipes --> RecipeIdeas[Enter ingredients and review ideas]
	Focus --> Timer[Focus timer and reminders]
	Profile --> Preferences[Diet, allergies, dislikes, budget, goals]
	Chef --> MenuAdmin[Edit menu items and import scanned menus]
```

| Page | Primary user task |
| --- | --- |
| Login / Sign up | Sign in or create a member account. New accounts cannot assign themselves the chef role. |
| Home | Review teams and today's nutrition; navigate to the main tasks. |
| Team Lunch | Create or join a team, submit a request, choose team or separate mode, and review orders, cost, and timing. |
| Menu | Browse by category (breakfast, lunch, dinner, snacks, vegetarian, high protein), search and filter, save favourites, open a dish for ingredients and swaps, add it to a plan or log it, or add an off-menu dish. |
| Nutrition | Analyze a meal, review estimated nutrition and lighter swaps, log it, and view recent progress. |
| Meal Plan | Generate a 1-, 3-, or 7-day plan with optional wishes and total budget; see prices per meal; replace meals; change servings; open a shopping list. |
| Ask Flame | Ask food and nutrition questions in a chat. |
| Recipes | Request recipe ideas from available ingredients. |
| Focus | Run a focus timer, set hydration and meal-prep reminders, and see a daily summary. Reminders run while the app is open in a browser tab. |
| Profile | Manage diet, allergies, disliked ingredients, per-meal budget, nutrition goals, optional health notes, voice-input language, and account deletion. |
| Chef Console | For chef accounts: edit or remove menu items, review earlier dish requests, and import scanned menu drafts. |

## Team lunch workflow

1. A host creates a team, sets the shared request and break time, then shares the six-character team code.
2. Members join and save individual requests. **With the team** combines the member's request with the shared request; **Separately** ignores the shared request. Profile diet preferences, recognized allergies, dislikes and budget apply in either mode.
3. The app parses requests into constraints using the configured AI model or a basic keyword and number parser when offline.
4. The Python planner filters out menu items that violate hard constraints and scores eligible items using stated likes, price, and a preference for batching the same dishes. Mains are preferred over drinks and desserts unless asked for.
5. The API returns individual picks, kitchen batch quantities, a bill split, a shared-feast option, a break timeline, and anonymous severe-allergen alerts. Users can compare options and copy a summary to share.

```mermaid
sequenceDiagram
	actor Host
	actor Member
	participant UI as Browser
	participant API as FastAPI
	participant LLM as Model (optional)
	participant P as Planner
	Host->>UI: Create team, set shared request and break
	UI->>API: POST /api/teams
	API-->>UI: Team code
	Member->>UI: Join with code, save request and mode
	UI->>API: POST /api/teams/join, PUT /api/teams/{code}/me
	Host->>UI: Plan our break
	UI->>API: POST /api/teams/{code}/plan
	API->>LLM: Parse each request (parallel; keyword fallback if offline)
	LLM-->>API: Constraints
	API->>P: Constraints, profiles, approved menu
	P-->>API: Picks, batch, bill, feast, timeline, alerts
	API-->>UI: Plan JSON
	UI->>API: POST /api/explain (after the plan is shown)
	API-->>UI: Short explanation
```

The planner, not the language model, chooses the final dishes and calculates the bill and timeline. Team plans are computed when requested and are not stored as a history.

## Architecture

```mermaid
flowchart LR
	Browser[Browser: HTML, CSS, JavaScript] -->|HTTP and JSON| API[FastAPI application]
	API --> Auth[Authentication and roles]
	API --> Profile[Profile constraints]
	API --> Planner[Deterministic planner]
	API --> LLM[Optional model adapter]
	API --> DB[(SQLite database)]
	LLM --> Gemini[Gemini API]
	LLM --> Ollama[Ollama]
	API -->|Serves frontend files| Browser
```

The browser frontend is plain HTML, CSS, and JavaScript with no build step. FastAPI serves the frontend and the `/api/...` endpoints. `server.py` validates requests, applies authentication and role checks, reads and writes data, and calls the feature modules.

| Component | Responsibility |
| --- | --- |
| `server.py` | HTTP routes, request validation, authorization, and feature orchestration. |
| `flame/auth.py` | Password hashing, bearer-token sessions, and chef authorization. |
| `flame/db.py` | SQLite schema and light migrations; loads the sample menu when the menu table is empty. |
| `flame/profile.py` | Converts saved diet, allergy, dislike and budget settings into planning constraints. |
| `flame/planner.py` | Filters and scores menu items; computes orders, batches, bill splits, feasts, timelines, and alerts. |
| `flame/llm.py` | Gemini/Ollama integration, structured model tasks, and preference parsing fallback. |
| `web/` | Sign-in page, app shell, styles, navigation, page views, and images. |
| `data/sample_menu.json` | Fictional starter menu. |
| `skills/group-lunch-planner/SKILL.md` | Agent Skill describing the group-lunch workflow. |

### Request and data flow

For a signed-in request, the browser sends an HTTP request to FastAPI with a bearer session token. FastAPI validates the request and user access, loads the relevant menu/profile/team data from SQLite, and calls the planner or model adapter as needed. The resulting JSON is returned to the page and rendered in the browser.

The default database path is `data/flame.db`; set `FLAME_DB` to use a different SQLite file. Accounts, profiles, menus, favourites, team memberships and requests, food logs, and each user's latest meal plan are stored. Meal plans are persisted per user; team lunch results are generated on demand and are not persisted. Focus-timer and reminder settings are stored in the browser only.

```mermaid
erDiagram
	USERS ||--|| PROFILES : has
	USERS ||--o{ SESSIONS : signs_in_with
	USERS ||--o{ FOOD_LOGS : logs
	USERS ||--o| MEAL_PLANS : saves
	USERS ||--o{ FAVORITES : saves
	USERS ||--o{ TEAM_MEMBERS : joins
	TEAMS ||--o{ TEAM_MEMBERS : has
	USERS ||--o{ TEAMS : hosts
	MENU_ITEMS ||--o{ FAVORITES : saved_as
	USERS ||--o{ MENU_ITEMS : adds
```

## AI configuration and availability

The default Gemini model is Gemma 4 (`gemma-4-26b-a4b-it`). When `GEMINI_API_KEY` is set, the app uses Gemini. Otherwise, it uses Ollama when `OLLAMA_MODEL` is set. Optional settings are `GEMMA_MODEL` (Gemini model), `OLLAMA_URL` (Ollama server address), and `GEMMA_THINKING` (Gemini thinking level; defaults to `minimal`, which is much faster than the model default).

| Capability | With a model | Without a model |
| --- | --- | --- |
| Team preference parsing | Model parsing with rule-based completion of budget, prep time and calorie limits. | Basic keyword and number parsing. |
| Order selection, bill, and timeline | Deterministic Python planner. | Deterministic Python planner. |
| Meal plans, chat, recipes, dish ingredients, menu-photo scanning | Available. | Requires a model. |
| Meal-plan budget | Each day is generated in parallel with its share of the budget; over-budget days are regenerated with the real cost fed back, up to two rounds. A plan can still end over budget, and the UI says so. | Not available. |
| Nutrition analysis | Text or image-based estimates. | Text can only match known menu dishes; image analysis is unavailable. |
| Custom dish | Estimates price, calories, macros and allergens, and adds the dish to the menu immediately. | Adds the dish with default estimates and marks them accordingly. |

Dishes added by members are approved automatically, labelled as AI-estimated, and limited to 10 per user per day.

## Local development

Requires Python 3.10 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000) and create an account. To enable Gemini, create a local `.env` file in the project root containing your own key:

```dotenv
GEMINI_API_KEY=your_api_key
```

Alternatively, install Ollama, download a compatible model, and set `OLLAMA_MODEL` in `.env`. Do not commit API keys or other credentials.

To try the chef pages, promote an account in the database, for example `UPDATE users SET role='chef' WHERE email='you@example.com';`.

## Security, privacy, and limitations

- Passwords are hashed with scrypt. Bearer sessions expire after 14 days.
- Authenticated users can access their own private data and teams they belong to. Chef-only operations are authorized on the server.
- Self-service registration always creates a member account. Chef accounts must be provisioned by an operator.
- Health profile details are not included in team member data. Individual health cautions, when generated, are returned only to the person they concern. Severe team allergen alerts do not identify the person with the allergy.
- Account deletion removes the profile, sessions, food logs, meal plan, favourites, team memberships, and any teams the user hosted. Dishes the user added stay on the menu, with the author removed.
- Nutrition values, health cautions, model estimates, and menu allergen data may be inaccurate. This application is for general wellness information and is not medical advice or a medical product.
