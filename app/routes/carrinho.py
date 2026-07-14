from flask import Blueprint, jsonify, request

from app.services.pedido_service import apply_coupon, quote_shipping

bp = Blueprint("carrinho", __name__, url_prefix="/api")


@bp.post("/shipping/quote")
def shipping_quote():
    body = request.get_json(silent=True) or {}
    return jsonify({"quote": quote_shipping(body.get("cep"), body.get("subtotal") or 0)})


@bp.post("/coupons/validate")
def coupons_validate():
    body = request.get_json(silent=True) or {}
    subtotal = float(body.get("subtotal") or 0)
    shipping = float(body.get("shipping") or 0)
    return jsonify({"coupon": apply_coupon(body.get("code"), subtotal, shipping)})
