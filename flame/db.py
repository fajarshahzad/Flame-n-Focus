"""SQLite storage. One small file, no ORM, so judges can run it with zero setup."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("FLAME_DB", ROOT / "data" / "flame.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  pw_hash BLOB NOT NULL, salt BLOB NOT NULL, role TEXT NOT NULL DEFAULT 'member',
  created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER, height_cm INTEGER, weight_kg INTEGER, activity TEXT DEFAULT 'light',
  diet TEXT DEFAULT '[]', allergies TEXT DEFAULT '[]', conditions TEXT DEFAULT '',
  goal TEXT DEFAULT 'maintain', kcal_target INTEGER DEFAULT 2000);
CREATE TABLE IF NOT EXISTS menu_items(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
  price INTEGER DEFAULT 0, prep_min INTEGER DEFAULT 10, spice INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]', allergens TEXT DEFAULT '[]',
  calories INTEGER DEFAULT 0, protein INTEGER DEFAULT 0, carbs INTEGER DEFAULT 0, fat INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved', source TEXT NOT NULL DEFAULT 'menu',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, chef_note TEXT DEFAULT '',
  created INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS teams(
  code TEXT PRIMARY KEY, name TEXT NOT NULL, host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_text TEXT DEFAULT '', break_start TEXT DEFAULT '13:00', break_minutes INTEGER DEFAULT 20,
  created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS team_members(
  team_code TEXT NOT NULL REFERENCES teams(code) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT DEFAULT '', mode TEXT NOT NULL DEFAULT 'team',
  PRIMARY KEY(team_code, user_id));
CREATE TABLE IF NOT EXISTS food_logs(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL, name TEXT NOT NULL, kcal INTEGER DEFAULT 0, protein INTEGER DEFAULT 0,
  carbs INTEGER DEFAULT 0, fat INTEGER DEFAULT 0, source TEXT DEFAULT 'manual', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS favorites(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, item_id));
CREATE TABLE IF NOT EXISTS meal_plans(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL, updated INTEGER NOT NULL);
"""

LIST_COLS = ("tags", "allergens")


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def item(row) -> dict:
    d = dict(row)
    for k in LIST_COLS:
        d[k] = json.loads(d[k] or "[]")
    return d


def estimate_macros(kcal: int) -> tuple[int, int, int]:
    """Rough 20/45/35 split, only used to seed sample data."""
    return round(kcal * 0.20 / 4), round(kcal * 0.45 / 4), round(kcal * 0.35 / 9)


def init():
    with db() as c:
        c.executescript(SCHEMA)
        have = {r[1] for r in c.execute("PRAGMA table_info(profiles)")}
        for col, ddl in (("dislikes", "TEXT DEFAULT '[]'"), ("budget", "INTEGER")):
            if col not in have:  # lightweight migration for databases created before these fields existed
                c.execute(f"ALTER TABLE profiles ADD COLUMN {col} {ddl}")
        if c.execute("SELECT COUNT(*) FROM menu_items").fetchone()[0] == 0:
            sample = json.loads((ROOT / "data" / "sample_menu.json").read_text(encoding="utf-8"))
            for it in sample["items"]:
                p, cb, f = estimate_macros(it["calories"])
                c.execute(
                    "INSERT INTO menu_items(name,price,prep_min,spice,tags,allergens,calories,protein,carbs,fat,status,source,created)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,'approved','menu',0)",
                    (it["name"], it["price"], it["prep_min"], it["spice"], json.dumps(it["tags"]),
                     json.dumps(it["allergens"]), it["calories"], p, cb, f),
                )
