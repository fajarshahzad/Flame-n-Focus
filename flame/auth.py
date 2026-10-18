"""Password hashing and bearer-token sessions (stdlib only)."""
import hashlib
import hmac
import os
import re
import secrets
import time

from fastapi import Header, HTTPException

from .db import db

SESSION_TTL = 60 * 60 * 24 * 14
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or os.urandom(16)
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1), salt


def verify_password(password: str, pw_hash: bytes, salt: bytes) -> bool:
    return hmac.compare_digest(hash_password(password, salt)[0], pw_hash)


def create_user(email: str, name: str, password: str, role: str) -> dict:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if len(password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters.")
    if not name.strip():
        raise HTTPException(422, "Name is required.")
    h, salt = hash_password(password)
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists.")
        cur = c.execute(
            "INSERT INTO users(email,name,pw_hash,salt,role,created) VALUES(?,?,?,?,?,?)",
            (email, name.strip(), h, salt, role, int(time.time())),
        )
        uid = cur.lastrowid
        c.execute("INSERT INTO profiles(user_id) VALUES(?)", (uid,))
    return {"id": uid, "email": email, "name": name.strip(), "role": role}


def login(email: str, password: str) -> dict:
    with db() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (email.strip().lower(),)).fetchone()
        if not row or not verify_password(password, row["pw_hash"], row["salt"]):
            raise HTTPException(401, "Wrong email or password.")
        return {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"]}


def new_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with db() as c:
        c.execute("INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)", (token, user_id, int(time.time())))
    return token


def current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please sign in.")
    token = authorization[7:].strip()
    with db() as c:
        row = c.execute(
            "SELECT u.id,u.email,u.name,u.role,s.created FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
            (token,),
        ).fetchone()
        if not row or time.time() - row["created"] > SESSION_TTL:
            if row:
                c.execute("DELETE FROM sessions WHERE token=?", (token,))
            raise HTTPException(401, "Session expired. Please sign in again.")
    return {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"], "token": token}


def chef_only(user: dict) -> dict:
    if user["role"] != "chef":
        raise HTTPException(403, "Chef access only.")
    return user
