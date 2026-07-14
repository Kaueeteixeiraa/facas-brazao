from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.extensions import db
from app.models import Pedido
from app.services.mercado_pago_service import (
    create_preference,
    payment_id_from_notification,
    sync_payment,
    verify_webhook_request,
)

bp = Blueprint("mercado_pago", __name__, url_prefix="/api")


def can_view_order(order):
    return current_user.is_authenticated and (current_user.role == "admin" or current_user.id == order.customer_id)


@bp.post("/pagamentos/mercado-pago/preferencia")
def create_mp_preference_api():
    body = request.get_json(silent=True) or {}
    order = db.session.get(Pedido, body.get("orderId") or body.get("pedidoId"))
    if not order:
        return jsonify({"error": "Pedido nao encontrado."}), 404
    if not can_view_order(order):
        return jsonify({"error": "Acesso negado."}), 403
    if order.status not in {"Aguardando pagamento", "Rejeitado", "Cancelado", "Recebido"}:
        return jsonify({"error": "Este pedido nao pode gerar novo pagamento."}), 400
    try:
        preference = create_preference(order)
        order.status = "Aguardando pagamento"
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify(
        {
            "payment": {
                "provider": "Mercado Pago",
                "preferenceId": preference.get("id"),
                "redirectUrl": preference.get("init_point") or preference.get("sandbox_init_point"),
                "sandboxRedirectUrl": preference.get("sandbox_init_point"),
            },
            "order": order.to_dict(public=current_user.role != "admin"),
        },
    )


@bp.post("/webhooks/mercado-pago")
def mercado_pago_webhook_new():
    body = request.get_json(silent=True) or {}
    if not verify_webhook_request(body):
        return jsonify({"error": "Webhook invalido."}), 401
    payment_id = payment_id_from_notification(body)
    if payment_id:
        try:
            sync_payment(payment_id)
            db.session.commit()
        except Exception:
            db.session.rollback()
    return jsonify({"ok": True})


@bp.route("/payments/mercadopago/webhook", methods=["GET", "POST"])
def mercado_pago_webhook_compat():
    return mercado_pago_webhook_new()


@bp.post("/payments/mercadopago/sync")
def mercado_pago_sync_compat():
    body = request.get_json(silent=True) or {}
    try:
        order, _payment = sync_payment(body.get("paymentId"))
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"order": order.to_dict(public=not current_user.is_authenticated or current_user.role != "admin")})


@bp.get("/pedidos/<order_id>/pagamento")
def order_payment(order_id):
    order = db.session.get(Pedido, order_id)
    if not order:
        return jsonify({"error": "Pedido nao encontrado."}), 404
    if not can_view_order(order):
        return jsonify({"error": "Acesso negado."}), 403
    return jsonify({"payment": order.payment or {}, "order": order.to_dict(public=current_user.role != "admin")})
