from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user

from app.models import Produto
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
                "mercadoPagoPublicKey": current_app.config["MERCADO_PAGO_PUBLIC_KEY"],
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
