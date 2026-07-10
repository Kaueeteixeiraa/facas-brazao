import hashlib
import hmac
from time import monotonic

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import Usuario
from app.services.produto_service import create_id, now_iso

bp = Blueprint("auth", __name__, url_prefix="/api")
login_attempts = {}


def normalize_email(email):
    return str(email or "").strip().lower()


def login_limit_key(email):
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    return f"{forwarded or request.remote_addr or 'local'}:{email}"


def recent_login_attempts(key):
    now = monotonic()
    window = int(current_app.config.get("LOGIN_RATE_LIMIT_WINDOW_SECONDS", 600))
    attempts = [stamp for stamp in login_attempts.get(key, []) if now - stamp < window]
    login_attempts[key] = attempts
    return attempts


def login_rate_limited(key):
    limit = int(current_app.config.get("LOGIN_RATE_LIMIT_ATTEMPTS", 6))
    return len(recent_login_attempts(key)) >= limit


def record_failed_login(key):
    attempts = recent_login_attempts(key)
    attempts.append(monotonic())
    login_attempts[key] = attempts


def verify_password(user, password):
    saved = user.password_hash or ""
    if check_password_hash(saved, password):
        return True
    parts = saved.split(":")
    if len(parts) == 2:
        salt, expected = parts
        attempt = hashlib.pbkdf2_hmac("sha256", str(password).encode(), salt.encode(), 120000, 32).hex()
        if hmac.compare_digest(attempt, expected):
            user.password_hash = generate_password_hash(password)
            db.session.commit()
            return True
    return False


@bp.get("/me")
def me():
    return jsonify({"user": current_user.to_public_dict() if current_user.is_authenticated else None})


@bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name") or "").strip()
    email = normalize_email(body.get("email"))
    password = str(body.get("password") or "")
    if len(name) < 2:
        return jsonify({"error": "Informe seu nome."}), 400
    if "@" not in email:
        return jsonify({"error": "Informe um e-mail valido."}), 400
    if len(password) < 6:
        return jsonify({"error": "A senha precisa ter pelo menos 6 caracteres."}), 400
    if Usuario.query.filter_by(email=email).first():
        return jsonify({"error": "Ja existe uma conta com esse e-mail."}), 409
    user = Usuario(
        id=create_id("usr"),
        role="customer",
        name=name,
        email=email,
        phone=str(body.get("phone") or "").strip(),
        password_hash=generate_password_hash(password),
        created_at=now_iso(),
    )
    db.session.add(user)
    db.session.commit()
    login_user(user)
    session.permanent = True
    return jsonify({"user": user.to_public_dict()}), 201


@bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = normalize_email(body.get("email"))
    key = login_limit_key(email)
    if login_rate_limited(key):
        return jsonify({"error": "Muitas tentativas. Aguarde alguns minutos e tente novamente."}), 429
    user = Usuario.query.filter_by(email=email).first()
    if not user or not verify_password(user, str(body.get("password") or "")):
        record_failed_login(key)
        return jsonify({"error": "E-mail ou senha invalidos."}), 401
    login_user(user)
    session.permanent = True
    login_attempts.pop(key, None)
    return jsonify({"user": user.to_public_dict()})


@bp.post("/logout")
def logout():
    logout_user()
    return jsonify({"ok": True})
