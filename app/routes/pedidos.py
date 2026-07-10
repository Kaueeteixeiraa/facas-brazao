import json
import urllib.error
import urllib.request

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user

from app.extensions import db
from app.models import Avaliacao, ItemPedido, Pedido, Produto
from app.routes.loja import public_product
from app.services.configuracao_service import get_settings
from app.services.pedido_service import create_order
from app.services.produto_service import create_id, now_iso

bp = Blueprint("pedidos", __name__, url_prefix="/api")


def require_user():
    if not current_user.is_authenticated:
        return jsonify({"error": "Entre na conta para continuar."}), 401
    return None


def public_base_url():
    settings = get_settings()
    return current_app.config["PUBLIC_SITE_URL"] or settings.get("publicUrl") or request.host_url.rstrip("/")


def create_mp_preference(order):
    token = current_app.config["MERCADO_PAGO_ACCESS_TOKEN"]
    if not token:
        raise ValueError("Mercado Pago ainda nao esta configurado.")
    base = public_base_url()
    payload = {
        "external_reference": order.id,
        "items": [
            {
                "id": item.product_id,
                "title": item.name,
                "quantity": item.quantity,
                "unit_price": float(item.price),
                "currency_id": "BRL",
            }
            for item in order.items
        ],
        "payer": {"name": order.customer_name, "email": order.customer_email},
        "back_urls": {
            "success": f"{base}/?payment=success",
            "pending": f"{base}/?payment=pending",
            "failure": f"{base}/?payment=failure",
        },
        "notification_url": f"{base}/api/payments/mercadopago/webhook",
        "auto_return": "approved",
    }
    if order.shipping:
        payload["shipments"] = {"cost": float(order.shipping), "mode": "not_specified"}
    req = urllib.request.Request(
        "https://api.mercadopago.com/checkout/preferences",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        raise ValueError(body or "Nao foi possivel criar o pagamento no Mercado Pago.") from exc


@bp.get("/my/orders")
def my_orders():
    error = require_user()
    if error:
        return error
    query = Pedido.query.order_by(Pedido.created_at.desc())
    orders = query.all() if current_user.role == "admin" else query.filter_by(customer_id=current_user.id).all()
    return jsonify({"orders": [order.to_dict(public=current_user.role != "admin") for order in orders]})


@bp.post("/orders")
def orders_create():
    body = request.get_json(silent=True) or {}
    try:
        order = create_order(body, current_user if current_user.is_authenticated else None)
        payment = None
        if "mercado" in str(order.payment_method or "").lower():
            pref = create_mp_preference(order)
            payment = {
                "provider": "Mercado Pago",
                "preferenceId": pref.get("id"),
                "redirectUrl": pref.get("init_point") or pref.get("sandbox_init_point"),
                "sandboxRedirectUrl": pref.get("sandbox_init_point"),
            }
            order.payment = {
                "provider": "Mercado Pago",
                "preferenceId": pref.get("id"),
                "initPoint": pref.get("init_point"),
                "sandboxInitPoint": pref.get("sandbox_init_point"),
                "status": "preference_created",
            }
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"order": order.to_dict(public=True), "payment": payment}), 201


@bp.post("/reviews")
def reviews_create():
    error = require_user()
    if error:
        return error
    body = request.get_json(silent=True) or {}
    product = Produto.query.filter_by(id=body.get("productId"), active=True).first()
    rating = int(body.get("rating") or 0)
    comment = str(body.get("comment") or "").strip()
    if not product:
        return jsonify({"error": "Produto nao encontrado."}), 404
    if rating < 1 or rating > 5:
        return jsonify({"error": "Informe uma nota de 1 a 5."}), 400
    if len(comment) < 8:
        return jsonify({"error": "Escreva um comentario com pelo menos 8 caracteres."}), 400
    purchased = (
        db.session.query(ItemPedido)
        .join(Pedido)
        .filter(Pedido.customer_id == current_user.id, Pedido.status != "Cancelado", ItemPedido.product_id == product.id)
        .first()
    )
    if not purchased:
        return jsonify({"error": "Voce so pode avaliar produtos que comprou."}), 403
    review = Avaliacao.query.filter_by(customer_id=current_user.id, product_id=product.id).first()
    if review:
        review.rating = rating
        review.comment = comment
        review.status = "pending"
        review.updated_at = now_iso()
    else:
        review = Avaliacao(
            id=create_id("rev"),
            product_id=product.id,
            product_name=product.name,
            customer_id=current_user.id,
            customer_name=current_user.name,
            rating=rating,
            comment=comment,
            status="pending",
            created_at=now_iso(),
        )
        db.session.add(review)
    db.session.commit()
    return jsonify({"review": review.to_dict(), "product": public_product(product)}), 201
