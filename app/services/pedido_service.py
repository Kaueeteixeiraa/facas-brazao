from collections import defaultdict

from app.extensions import db
from app.models import (
    Avaliacao,
    CaixaFechamento,
    CaixaLancamento,
    Cupom,
    ItemPedido,
    Pedido,
    Produto,
    Usuario,
)
from app.services.configuracao_service import get_settings
from app.services.produto_service import create_id, now_iso


PAID_STATUSES = {"Pago", "Em produção", "Em preparacao", "Em preparação", "Pronto para envio", "Enviado", "Entregue", "Concluído"}


def clean_cep(cep=""):
    return "".join(ch for ch in str(cep) if ch.isdigit())[:8]


def quote_shipping(cep="", subtotal=0, settings=None):
    settings = settings or get_settings()
    clean = clean_cep(cep)
    amount = float(subtotal or 0)
    if float(settings.get("freeShippingFrom") or 0) > 0 and amount >= float(settings.get("freeShippingFrom") or 0):
        return {"cep": clean, "region": "Frete gratis", "fee": 0, "freeShipping": True, "message": "Frete gratis aplicado pelo valor do pedido."}
    rule = next(
        (
            item
            for item in settings.get("shippingRules", [])
            if any(clean.startswith(str(prefix)) for prefix in item.get("prefixes", []))
        ),
        None,
    )
    return {
        "cep": clean,
        "region": (rule or {}).get("name", "Padrao"),
        "fee": float((rule or {}).get("fee", settings.get("shippingFee") or 0)),
        "freeShipping": False,
        "message": f"Frete para {(rule or {}).get('name', 'regiao padrao')}." if len(clean) == 8 else "Informe o CEP para calcular o frete.",
    }


def coupon_to_public(coupon):
    return coupon.to_dict() if coupon else None


def apply_coupon(code="", subtotal=0, shipping=0):
    normalized = str(code or "").strip().upper()
    coupon = Cupom.query.filter_by(code=normalized, active=True).first() if normalized else None
    if not coupon:
        return {"coupon": None, "discount": 0, "shippingDiscount": 0, "message": "Cupom invalido ou inativo." if code else ""}
    amount = float(subtotal or 0)
    if amount < float(coupon.min_subtotal or 0):
        return {"coupon": None, "discount": 0, "shippingDiscount": 0, "message": f"Cupom valido a partir de R$ {coupon.min_subtotal:.2f}."}
    discount = 0
    shipping_discount = 0
    if coupon.type == "percent":
        discount = amount * (float(coupon.value or 0) / 100)
    elif coupon.type == "fixed":
        discount = float(coupon.value or 0)
    elif coupon.type == "free_shipping":
        shipping_discount = float(shipping or 0)
    return {
        "coupon": coupon_to_public(coupon),
        "discount": min(discount, amount),
        "shippingDiscount": shipping_discount,
        "message": f"Cupom {coupon.code} aplicado.",
    }


def is_paid(order):
    return order.status in PAID_STATUSES


def order_cost(order):
    return sum(float(item.cost or 0) * int(item.quantity or 0) for item in order.items)


def order_profit(order):
    return float(order.total or 0) - float(order.shipping or 0) - order_cost(order)


def create_order(payload, user=None):
    order_user = user
    if not order_user:
        email = str(payload.get("customerEmail") or "").strip().lower()
        name = str(payload.get("customerName") or "").strip()
        if not name or not email:
            raise ValueError("Informe nome e e-mail para comprar sem cadastro.")
        order_user = Usuario.query.filter_by(email=email).first()
        if not order_user:
            from werkzeug.security import generate_password_hash

            order_user = Usuario(
                id=create_id("guest"),
                role="customer",
                guest=True,
                name=name,
                email=email,
                phone=str(payload.get("customerPhone") or "").strip(),
                password_hash=generate_password_hash(create_id("pwd")),
                created_at=now_iso(),
            )
            db.session.add(order_user)
        elif not order_user.phone:
            order_user.phone = str(payload.get("customerPhone") or "").strip()
    if not payload.get("ageCheck"):
        raise ValueError("Confirme a maioridade para concluir a compra.")
    if not str(payload.get("address") or "").strip():
        raise ValueError("Informe o endereco de entrega.")

    requested = payload.get("items") if isinstance(payload.get("items"), list) else []
    if not requested:
        raise ValueError("O carrinho esta vazio.")

    order_items = []
    for requested_item in requested:
        product = Produto.query.filter_by(id=requested_item.get("productId"), active=True).with_for_update().first()
        quantity = int(requested_item.get("quantity") or 0)
        if not product or quantity <= 0:
            raise ValueError("Produto invalido no carrinho.")
        if product.stock < quantity:
            raise ValueError(f"Estoque insuficiente para {product.name}.")
        product.stock -= quantity
        product.updated_at = now_iso()
        order_items.append(
            ItemPedido(
                product_id=product.id,
                sku=product.sku or "",
                name=product.name,
                price=product.promo_price or product.price,
                cost=product.cost or 0,
                quantity=quantity,
            ),
        )

    subtotal = sum(item.price * item.quantity for item in order_items)
    shipping_quote = quote_shipping(payload.get("cep"), subtotal)
    coupon_result = apply_coupon(payload.get("couponCode"), subtotal, shipping_quote["fee"])
    if payload.get("couponCode") and not coupon_result["coupon"]:
        raise ValueError(coupon_result["message"] or "Cupom invalido.")
    shipping = max(0, shipping_quote["fee"] - coupon_result["shippingDiscount"])
    discount = float(coupon_result["discount"] or 0)
    wants_mp = "mercado" in str(payload.get("paymentMethod") or "").lower()
    status = "Aguardando pagamento" if wants_mp else "Recebido"
    order = Pedido(
        id=create_id("PED").upper(),
        customer_id=order_user.id,
        customer_name=order_user.name,
        customer_email=order_user.email,
        customer_phone=order_user.phone or str(payload.get("customerPhone") or "").strip(),
        address=str(payload.get("address")).strip(),
        cep=clean_cep(payload.get("cep")),
        payment_method=str(payload.get("paymentMethod") or "Combinar"),
        notes=str(payload.get("notes") or "").strip(),
        subtotal=subtotal,
        shipping=shipping,
        discount=discount + float(coupon_result["shippingDiscount"] or 0),
        total=max(0, subtotal - discount + shipping),
        status=status,
        timeline=[{"status": status, "note": "Pedido criado aguardando pagamento." if wants_mp else "Pedido recebido pela loja.", "at": now_iso(), "by": order_user.id}],
        shipping_quote=shipping_quote,
        coupon=coupon_result["coupon"],
        created_at=now_iso(),
    )
    order.items = order_items
    db.session.add(order)
    return order


def review_stats(product_id):
    approved = Avaliacao.query.filter_by(product_id=product_id, status="approved").order_by(Avaliacao.created_at.desc()).all()
    count = len(approved)
    avg = round(sum(item.rating for item in approved) / count, 1) if count else 0
    return {"count": count, "average": avg, "reviews": [item.to_dict() for item in approved[:6]]}


def summarize_customers():
    customers = Usuario.query.filter_by(role="customer").all()
    result = []
    for customer in customers:
        orders = Pedido.query.filter_by(customer_id=customer.id).order_by(Pedido.created_at.asc()).all()
        result.append(
            {
                "id": customer.id,
                "name": customer.name,
                "email": customer.email,
                "phone": customer.phone or "",
                "createdAt": customer.created_at,
                "orders": len(orders),
                "totalSpent": sum(float(order.total or 0) for order in orders),
                "lastOrderAt": orders[-1].created_at if orders else "",
            },
        )
    return sorted(result, key=lambda item: item["totalSpent"], reverse=True)


def summarize_cash():
    entries = CaixaLancamento.query.order_by(CaixaLancamento.created_at.desc()).all()
    closings = CaixaFechamento.query.order_by(CaixaFechamento.closed_at.desc()).all()
    paid_orders = [order for order in Pedido.query.all() if is_paid(order)]
    order_income = sum(float(order.total or 0) for order in paid_orders)
    manual_income = sum(float(entry.amount or 0) for entry in entries if entry.type == "entrada")
    manual_expense = sum(float(entry.amount or 0) for entry in entries if entry.type == "saida")
    return {
        "summary": {
            "orderIncome": order_income,
            "manualIncome": manual_income,
            "manualExpense": manual_expense,
            "balance": order_income + manual_income - manual_expense,
            "paidOrders": len(paid_orders),
            "entries": len(entries),
        },
        "entries": [entry.to_dict() for entry in entries],
        "closings": [closing.to_dict() for closing in closings],
        "recentOrders": [order.to_dict() for order in list(reversed(paid_orders))[:20]],
    }


def summarize_store():
    orders = Pedido.query.all()
    paid = [order for order in orders if is_paid(order)]
    revenue = sum(float(order.total or 0) for order in paid)
    profit = sum(order_profit(order) for order in paid)
    sold_items = [item for order in paid for item in order.items]
    top = defaultdict(lambda: {"productId": "", "name": "", "quantity": 0, "revenue": 0})
    for item in sold_items:
        top[item.product_id].update({"productId": item.product_id, "name": item.name})
        top[item.product_id]["quantity"] += item.quantity
        top[item.product_id]["revenue"] += item.price * item.quantity
    today = now_iso()[:10]
    today_orders = [order for order in orders if str(order.created_at).startswith(today)]
    low_stock = Produto.query.filter(Produto.active.is_(True), Produto.stock <= Produto.min_stock).all()
    return {
        "revenue": revenue,
        "profit": profit,
        "margin": (profit / revenue) * 100 if revenue else 0,
        "todayRevenue": sum(float(order.total or 0) for order in today_orders if is_paid(order)),
        "todayOrders": len(today_orders),
        "pendingOrders": len([order for order in orders if order.status in {"Recebido", "Novo", "Aguardando pagamento", "Pago", "Em produção", "Em preparação"}]),
        "cashBalance": summarize_cash()["summary"]["balance"],
        "orders": len(orders),
        "customers": Usuario.query.filter_by(role="customer").count(),
        "products": Produto.query.count(),
        "pendingReviews": Avaliacao.query.filter_by(status="pending").count(),
        "lowStock": [item.to_dict() for item in low_stock],
        "topProducts": sorted(top.values(), key=lambda item: item["quantity"], reverse=True)[:5],
    }


def summarize_reports():
    orders = Pedido.query.all()
    paid = [order for order in orders if is_paid(order)]
    paid_items = [item for order in paid for item in order.items]
    revenue = sum(float(order.total or 0) for order in paid)
    cost = sum(order_cost(order) for order in paid)
    by_status = defaultdict(lambda: {"status": "", "orders": 0, "revenue": 0})
    by_payment = defaultdict(lambda: {"method": "", "orders": 0, "revenue": 0})
    by_day = defaultdict(lambda: {"day": "", "orders": 0, "revenue": 0, "items": 0})
    products = defaultdict(lambda: {"productId": "", "name": "", "quantity": 0, "revenue": 0, "cost": 0, "profit": 0})
    for order in orders:
        by_status[order.status].update({"status": order.status})
        by_status[order.status]["orders"] += 1
        by_status[order.status]["revenue"] += order.total
        by_payment[order.payment_method].update({"method": order.payment_method})
        by_payment[order.payment_method]["orders"] += 1
        by_payment[order.payment_method]["revenue"] += order.total
    for order in paid:
        day = str(order.created_at)[:10]
        by_day[day].update({"day": day})
        by_day[day]["orders"] += 1
        by_day[day]["revenue"] += order.total
        by_day[day]["items"] += sum(item.quantity for item in order.items)
    for item in paid_items:
        row = products[item.product_id]
        row.update({"productId": item.product_id, "name": item.name})
        row["quantity"] += item.quantity
        row["revenue"] += item.price * item.quantity
        row["cost"] += item.cost * item.quantity
        row["profit"] = row["revenue"] - row["cost"]
    stock = [
        {
            "id": item.id,
            "name": item.name,
            "stock": item.stock,
            "active": item.active,
            "estimatedValue": item.stock * item.price,
            "estimatedCost": item.stock * (item.cost or 0),
            "minStock": item.min_stock,
        }
        for item in Produto.query.order_by(Produto.stock.asc()).all()
    ]
    return {
        "overview": {
            "revenue": revenue,
            "cost": cost,
            "profit": revenue - cost,
            "margin": ((revenue - cost) / revenue) * 100 if revenue else 0,
            "paidOrders": len(paid),
            "totalOrders": len(orders),
            "averageTicket": revenue / len(paid) if paid else 0,
            "itemsSold": sum(item.quantity for item in paid_items),
            "customers": Usuario.query.filter_by(role="customer").count(),
            "stockValue": sum(item["estimatedValue"] for item in stock),
            "stockCost": sum(item["estimatedCost"] for item in stock),
        },
        "byDay": sorted(by_day.values(), key=lambda item: item["day"], reverse=True)[:30],
        "byStatus": sorted(by_status.values(), key=lambda item: item["orders"], reverse=True),
        "byPayment": sorted(by_payment.values(), key=lambda item: item["revenue"], reverse=True),
        "products": sorted(products.values(), key=lambda item: item["revenue"], reverse=True),
        "stock": stock,
        "customers": summarize_customers()[:20],
        "reviews": {
            "total": Avaliacao.query.count(),
            "pending": Avaliacao.query.filter_by(status="pending").count(),
            "approved": Avaliacao.query.filter_by(status="approved").count(),
            "rejected": Avaliacao.query.filter_by(status="rejected").count(),
        },
    }


def csv_from_rows(rows):
    return "\n".join(";".join(f'"{str(cell or "").replace(chr(34), chr(34) * 2)}"' for cell in row) for row in rows)


def report_csv(kind="orders"):
    reports = summarize_reports()
    if kind == "products":
        return csv_from_rows([["Produto", "Quantidade vendida", "Faturamento", "Custo", "Lucro"], *[[p["name"], p["quantity"], p["revenue"], p["cost"], p["profit"]] for p in reports["products"]]])
    if kind == "customers":
        return csv_from_rows([["Cliente", "Email", "Telefone", "Pedidos", "Total gasto", "Ultimo pedido"], *[[c["name"], c["email"], c["phone"], c["orders"], c["totalSpent"], c["lastOrderAt"]] for c in reports["customers"]]])
    if kind == "stock":
        return csv_from_rows([["Produto", "Estoque", "Estoque minimo", "Ativo", "Valor estimado", "Custo estimado"], *[[s["name"], s["stock"], s["minStock"], "Sim" if s["active"] else "Nao", s["estimatedValue"], s["estimatedCost"]] for s in reports["stock"]]])
    if kind == "days":
        return csv_from_rows([["Dia", "Pedidos pagos", "Itens", "Faturamento"], *[[d["day"], d["orders"], d["items"], d["revenue"]] for d in reports["byDay"]]])
    rows = [["Pedido", "Data", "Cliente", "Email", "Telefone", "Status", "Pagamento", "CEP", "Itens", "Subtotal", "Frete", "Cupom", "Desconto", "Custo", "Lucro", "Total"]]
    for order in Pedido.query.all():
        rows.append([order.id, order.created_at, order.customer_name, order.customer_email, order.customer_phone, order.status, order.payment_method, order.cep, " | ".join(f"{item.quantity}x {item.name}" for item in order.items), order.subtotal, order.shipping, (order.coupon or {}).get("code", ""), order.discount, order_cost(order), order_profit(order), order.total])
    return csv_from_rows(rows)
