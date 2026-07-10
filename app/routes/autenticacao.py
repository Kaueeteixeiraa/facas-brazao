import hashlib
import hmac

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import Usuario
from app.services.produto_service import create_id, now_iso

bp = Blueprint("auth", __name__, url_prefix="/api")


def normalize_email(email):
    return str(email or "").strip().lower()


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
    return jsonify({"user": user.to_public_dict()}), 201


@bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    user = Usuario.query.filter_by(email=normalize_email(body.get("email"))).first()
    if not user or not verify_password(user, str(body.get("password") or "")):
        return jsonify({"error": "E-mail ou senha invalidos."}), 401
    login_user(user)
    return jsonify({"user": user.to_public_dict()})


@bp.post("/logout")
def logout():
    logout_user()
    return jsonify({"ok": True})
