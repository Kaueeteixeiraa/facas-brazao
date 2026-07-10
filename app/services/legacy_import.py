import json
from pathlib import Path

from werkzeug.security import generate_password_hash

from config import BASE_DIR
from app.extensions import db
from app.models import (
    Atividade,
    Avaliacao,
    CaixaFechamento,
    CaixaLancamento,
    Configuracao,
    Cupom,
    ItemPedido,
    Pedido,
    Produto,
    Usuario,
)
from app.services.configuracao_service import save_settings
from app.services.produto_service import apply_product_defaults, now_iso


def import_legacy_store(path=None):
    path = Path(path or BASE_DIR / "data" / "store.json")
    if not path.exists():
        return [f"Nenhum arquivo encontrado em {path}."]
    data = json.loads(path.read_text(encoding="utf-8"))
    report = []
    if data.get("settings"):
        save_settings(data["settings"])
        report.append("Configuracoes importadas/atualizadas.")
    counts = {
        "users": import_users(data.get("users", [])),
        "products": import_products(data.get("products", [])),
        "coupons": import_coupons(data.get("coupons", [])),
        "orders": import_orders(data.get("orders", [])),
        "reviews": import_reviews(data.get("reviews", [])),
        "cash": import_cash(data.get("cashEntries", []), data.get("cashClosings", [])),
        "logs": import_logs(data.get("activityLogs", [])),
    }
    db.session.commit()
    report.extend(f"{key}: {value} importado(s)/preservado(s)." for key, value in counts.items())
    return report


def import_users(items):
    total = 0
    for item in items:
        if Usuario.query.filter_by(email=str(item.get("email", "")).lower()).first():
            continue
        db.session.add(
            Usuario(
                id=item.get("id") or f"user_{total}",
                role=item.get("role") or "customer",
                name=item.get("name") or "Cliente",
                email=str(item.get("email") or "").lower(),
                phone=item.get("phone") or "",
                password_hash=item.get("passwordHash") or generate_password_hash("trocar123"),
                guest=bool(item.get("guest")),
                created_at=item.get("createdAt") or now_iso(),
                updated_at=item.get("updatedAt") or "",
            ),
        )
        total += 1
    return total


def import_products(items):
    total = 0
    for item in items:
        if db.session.get(Produto, item.get("id")):
            continue
        data = apply_product_defaults(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "slug": item.get("slug"),
                "sku": item.get("sku"),
                "category": item.get("category"),
                "price": item.get("price") or 0,
                "promo_price": item.get("promoPrice") or 0,
                "cost": item.get("cost") or 0,
                "stock": item.get("stock") or 0,
                "min_stock": item.get("minStock") or 3,
                "badge": item.get("badge") or "",
                "image": item.get("image"),
                "gallery": item.get("gallery"),
                "steel": item.get("steel") or "",
                "size": item.get("size") or "",
                "handle_material": item.get("handleMaterial") or "",
                "weight": item.get("weight") or "",
                "blade_length": item.get("bladeLength") or "",
                "total_length": item.get("totalLength") or "",
                "sheath": item.get("sheath") or "",
                "production_time": item.get("productionTime") or "",
                "shipping_time": item.get("shippingTime") or "",
                "warranty": item.get("warranty") or "",
                "care": item.get("care") or "",
                "description": item.get("description") or "",
                "active": item.get("active", True),
                "featured": item.get("featured") or 99,
                "created_at": item.get("createdAt") or now_iso(),
                "updated_at": item.get("updatedAt") or "",
            },
        )
        db.session.add(Produto(**data))
        total += 1
    return total


def import_coupons(items):
    total = 0
    for item in items:
        if db.session.get(Cupom, item.get("id")):
            continue
        db.session.add(
            Cupom(
                id=item.get("id"),
                code=str(item.get("code") or "").upper(),
                type=item.get("type") or "percent",
                value=item.get("value") or 0,
                min_subtotal=item.get("minSubtotal") or 0,
                active=bool(item.get("active")),
                created_at=item.get("createdAt") or now_iso(),
                updated_at=item.get("updatedAt") or "",
            ),
        )
        total += 1
    return total


def import_orders(items):
    total = 0
    for item in items:
        if db.session.get(Pedido, item.get("id")):
            continue
        order = Pedido(
            id=item.get("id"),
            customer_id=item.get("customerId") or "admin",
            customer_name=item.get("customerName") or "Cliente",
            customer_email=item.get("customerEmail") or "",
            customer_phone=item.get("customerPhone") or "",
            address=item.get("address") or "",
            cep=item.get("cep") or "",
            payment_method=item.get("paymentMethod") or "Combinar",
            notes=item.get("notes") or "",
            subtotal=item.get("subtotal") or 0,
            shipping=item.get("shipping") or 0,
            discount=item.get("discount") or 0,
            total=item.get("total") or 0,
            status=item.get("status") or "Recebido",
            timeline=item.get("timeline") or [],
            shipping_quote=item.get("shippingQuote") or {},
            coupon=item.get("coupon") or None,
            payment=item.get("payment") or None,
            created_at=item.get("createdAt") or now_iso(),
            updated_at=item.get("updatedAt") or "",
        )
        order.items = [
            ItemPedido(
                product_id=line.get("productId") or "",
                sku=line.get("sku") or "",
                name=line.get("name") or "Produto",
                price=line.get("price") or 0,
                cost=line.get("cost") or 0,
                quantity=line.get("quantity") or 1,
            )
            for line in item.get("items", [])
        ]
        db.session.add(order)
        total += 1
    return total


def import_reviews(items):
    total = 0
    for item in items:
        if db.session.get(Avaliacao, item.get("id")):
            continue
        db.session.add(
            Avaliacao(
                id=item.get("id"),
                product_id=item.get("productId"),
                product_name=item.get("productName") or "",
                customer_id=item.get("customerId"),
                customer_name=item.get("customerName") or "",
                rating=item.get("rating") or 5,
                comment=item.get("comment") or "",
                status=item.get("status") or "pending",
                created_at=item.get("createdAt") or now_iso(),
                updated_at=item.get("updatedAt") or "",
            ),
        )
        total += 1
    return total


def import_cash(entries, closings):
    total = 0
    for item in entries:
        if db.session.get(CaixaLancamento, item.get("id")):
            continue
        db.session.add(CaixaLancamento(id=item.get("id"), type=item.get("type"), amount=item.get("amount") or 0, method=item.get("method") or "PIX", description=item.get("description") or "", created_by=item.get("createdBy") or "admin", created_at=item.get("createdAt") or now_iso()))
        total += 1
    for item in closings:
        if db.session.get(CaixaFechamento, item.get("id")):
            continue
        db.session.add(CaixaFechamento(id=item.get("id"), period=item.get("period") or "", opening_balance=item.get("openingBalance") or 0, expected_balance=item.get("expectedBalance") or 0, counted_balance=item.get("countedBalance") or 0, difference=item.get("difference") or 0, notes=item.get("notes") or "", closed_by=item.get("closedBy") or "admin", closed_at=item.get("closedAt") or now_iso()))
        total += 1
    return total


def import_logs(items):
    total = 0
    for item in items:
        db.session.add(Atividade(user_id=item.get("userId") or "", user_name=item.get("userName") or "", action=item.get("action") or "Importado", detail=item.get("detail") or "", created_at=item.get("createdAt") or now_iso()))
        total += 1
    return total
