from app.extensions import db
from app.models import Produto
from app.services.produto_service import now_iso


def reserve_stock(order):
    payment = order.payment or {}
    if payment.get("stockReserved") and not payment.get("stockReleased"):
        return False
    products = []
    for item in order.items:
        product = db.session.get(Produto, item.product_id)
        if not product or product.stock < item.quantity:
            raise ValueError(f"Estoque insuficiente para {item.name}.")
        products.append((product, item.quantity))
    for product, quantity in products:
        product.stock -= quantity
        product.updated_at = now_iso()
    order.payment = {
        **payment,
        "stockReserved": True,
        "stockReleased": False,
        "stockConfirmed": False,
        "stockReservedAt": now_iso(),
    }
    return True


def release_reserved_stock(order):
    payment = order.payment or {}
    if payment.get("stockReleased"):
        return False
    for item in order.items:
        product = db.session.get(Produto, item.product_id)
        if product:
            product.stock += item.quantity
            product.updated_at = now_iso()
    order.payment = {**payment, "stockReleased": True, "stockConfirmed": False, "stockReleasedAt": now_iso()}
    return True


def confirm_reserved_stock(order):
    payment = order.payment or {}
    if payment.get("stockConfirmed") or payment.get("stockReleased"):
        return False
    order.payment = {**payment, "stockConfirmed": True, "stockConfirmedAt": now_iso()}
    return True


def cancel_order(order):
    changed = release_reserved_stock(order)
    if changed:
        order.status = "Cancelado"
        timeline = order.timeline or []
        timeline.append({"status": "Cancelado", "note": "Reserva de estoque liberada.", "at": now_iso(), "by": "system"})
        order.timeline = timeline
    return changed
