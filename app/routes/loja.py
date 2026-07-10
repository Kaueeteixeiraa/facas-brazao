import json
import urllib.error
import urllib.parse
import urllib.request

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user

from app.extensions import db
from app.models import Pedido, Produto
from app.services.configuracao_service import get_settings
from app.services.pedido_service import review_stats

bp = Blueprint("loja", __name__, url_prefix="/api")


def public_product(product):
    return product.to_dict(include_private=False, review_stats=review_stats(product.id))


@bp.get("/bootstrap")
def bootstrap():
    settings = get_settings()
    products = Produto.query.filter_by(active=True).order_by(Produto.featured.asc(), Produto.name.asc()).all()
    return jsonify(
        {
            "settings": settings,
            "products": [public_product(product) for product in products],
            "user": current_user.to_public_dict() if current_user.is_authenticated else None,
            "csrfToken": session.setdefault("csrf_token", __import__("secrets").token_urlsafe(32)),
            "payment": {
                "mercadoPagoConfigured": bool(current_app.config["MERCADO_PAGO_ACCESS_TOKEN"]),
                "publicUrl": current_app.config["PUBLIC_SITE_URL"] or settings.get("publicUrl") or "",
            },
        },
    )


@bp.get("/products/<key>")
def product_detail(key):
    product = Produto.query.filter(
        Produto.active.is_(True),
        (Produto.id == key) | (Produto.slug == key),
    ).first()
    if not product:
        return jsonify({"error": "Produto nao encontrado."}), 404
    return jsonify({"product": public_product(product)})


def mp_request(path, payload=None):
    token = current_app.config["MERCADO_PAGO_ACCESS_TOKEN"]
    if not token:
        raise ValueError("Mercado Pago nao configurado.")
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"https://api.mercadopago.com{path}",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        raise ValueError(body or "Nao foi possivel consultar o Mercado Pago.") from exc


def map_mp_status(status):
    return {
        "approved": "Pago",
        "authorized": "Pago",
        "pending": "Aguardando pagamento",
        "in_process": "Aguardando pagamento",
        "rejected": "Pagamento recusado",
        "cancelled": "Cancelado",
        "refunded": "Cancelado",
        "charged_back": "Cancelado",
    }.get(status, "Aguardando pagamento")


def sync_payment(payment_id):
    payment = mp_request(f"/v1/payments/{urllib.parse.quote(str(payment_id))}")
    order = Pedido.query.filter(Pedido.payment["paymentId"].as_string() == str(payment_id)).first()
    order_id = (payment.get("external_reference") or "").strip()
    if not order and order_id:
        order = db.session.get(Pedido, order_id)
    if not order:
        raise ValueError("Pedido nao encontrado para este pagamento.")
    order.payment = {
        **(order.payment or {}),
        "provider": "Mercado Pago",
        "paymentId": str(payment_id),
        "status": payment.get("status") or "",
        "paidAt": payment.get("date_approved") or "",
    }
    order.status = map_mp_status(payment.get("status"))
    db.session.commit()
    return order


@bp.route("/payments/mercadopago/webhook", methods=["GET", "POST"])
def mercado_pago_webhook():
    payment_id = request.args.get("data.id") or request.args.get("id")
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        payment_id = payment_id or (body.get("data") or {}).get("id") or body.get("id")
    if payment_id:
        sync_payment(payment_id)
    return jsonify({"ok": True})


@bp.post("/payments/mercadopago/sync")
def mercado_pago_sync():
    body = request.get_json(silent=True) or {}
    order = sync_payment(body.get("paymentId"))
    return jsonify({"order": order.to_dict(public=not current_user.is_authenticated or current_user.role != "admin")})
