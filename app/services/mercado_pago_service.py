import hashlib
import hmac
import json
import urllib.error
import urllib.parse
import urllib.request

from flask import current_app, request

from app.extensions import db
from app.models import Pedido
from app.services.configuracao_service import get_settings
from app.services.produto_service import now_iso
from app.services.stock_service import confirm_reserved_stock, release_reserved_stock, reserve_stock


STATUS_MAP = {
    "approved": "Pago",
    "authorized": "Pago",
    "pending": "Aguardando pagamento",
    "in_process": "Em análise",
    "in_mediation": "Em análise",
    "rejected": "Rejeitado",
    "cancelled": "Cancelado",
    "refunded": "Reembolsado",
    "charged_back": "Reembolsado",
}


def public_base_url():
    settings = get_settings()
    return current_app.config["PUBLIC_SITE_URL"] or settings.get("publicUrl") or request.host_url.rstrip("/")


def mp_request(path, payload=None, method=None):
    token = current_app.config["MERCADO_PAGO_ACCESS_TOKEN"]
    if not token:
        raise ValueError("Mercado Pago ainda nao esta configurado.")
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"https://api.mercadopago.com{path}",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=method or ("POST" if payload is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        raise ValueError(body or "Nao foi possivel consultar o Mercado Pago.") from exc


def create_preference(order):
    reserve_stock(order)
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
            "success": f"{base}/pagamento/sucesso?pedido={urllib.parse.quote(order.id)}",
            "pending": f"{base}/pagamento/pendente?pedido={urllib.parse.quote(order.id)}",
            "failure": f"{base}/pagamento/falha?pedido={urllib.parse.quote(order.id)}",
        },
        "notification_url": f"{base}/api/webhooks/mercado-pago",
        "auto_return": "approved",
    }
    if order.shipping:
        payload["shipments"] = {"cost": float(order.shipping), "mode": "not_specified"}
    preference = mp_request("/checkout/preferences", payload)
    attempts = int((order.payment or {}).get("attempts") or 0) + 1
    order.payment = {
        **(order.payment or {}),
        "provider": "Mercado Pago",
        "status": "preference_created",
        "preferenceId": preference.get("id"),
        "initPoint": preference.get("init_point"),
        "sandboxInitPoint": preference.get("sandbox_init_point"),
        "amount": order.total,
        "externalReference": order.id,
        "attempts": attempts,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "stockReserved": True,
    }
    return preference


def payment_id_from_notification(data):
    return (
        request.args.get("data.id")
        or request.args.get("id")
        or str((data.get("data") or {}).get("id") or data.get("id") or "")
    )


def verify_webhook_request(data=None):
    secret = current_app.config.get("MERCADO_PAGO_WEBHOOK_SECRET")
    if not secret:
        return True
    signature = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    parts = dict(part.split("=", 1) for part in signature.split(",") if "=" in part)
    ts = parts.get("ts", "")
    received = parts.get("v1", "")
    data_id = request.args.get("data.id") or request.args.get("id") or str(((data or {}).get("data") or {}).get("id") or "")
    if ts and received:
        manifest = "".join(
            [
                f"id:{data_id};" if data_id else "",
                f"request-id:{request_id};" if request_id else "",
                f"ts:{ts};",
            ],
        )
        expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, received)
    sent = request.headers.get("X-Webhook-Secret") or request.headers.get("x-webhook-secret")
    return hmac.compare_digest(sent or "", secret)


def sync_payment(payment_id):
    payment = mp_request(f"/v1/payments/{urllib.parse.quote(str(payment_id))}")
    order_id = (payment.get("external_reference") or "").strip()
    order = db.session.get(Pedido, order_id) if order_id else None
    if not order:
        try:
            order = Pedido.query.filter(Pedido.payment["paymentId"].as_string() == str(payment_id)).first()
        except Exception:
            order = None
    if not order:
        raise ValueError("Pedido nao encontrado para este pagamento.")
    internal_status = STATUS_MAP.get(payment.get("status"), "Aguardando pagamento")
    current_payment = order.payment or {}
    order.payment = {
        **current_payment,
        "provider": "Mercado Pago",
        "paymentId": str(payment_id),
        "status": "payment_synced",
        "mercadoPagoStatus": payment.get("status") or "",
        "statusDetail": payment.get("status_detail") or "",
        "amount": payment.get("transaction_amount") or order.total,
        "paidAt": payment.get("date_approved") or current_payment.get("paidAt") or "",
        "updatedAt": now_iso(),
        "externalReference": order.id,
    }
    if internal_status == "Pago":
        confirm_reserved_stock(order)
    elif internal_status in {"Rejeitado", "Cancelado", "Reembolsado"}:
        release_reserved_stock(order)
    if order.status != internal_status:
        timeline = order.timeline or []
        timeline.append({"status": internal_status, "note": "Status sincronizado pelo Mercado Pago.", "at": now_iso(), "by": "mercado_pago"})
        order.timeline = timeline
    order.status = internal_status
    order.updated_at = now_iso()
    return order, payment
