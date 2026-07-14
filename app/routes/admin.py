from flask import Blueprint, Response, jsonify, request
from flask_login import current_user
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import (
    Atividade,
    Avaliacao,
    CaixaFechamento,
    CaixaLancamento,
    Categoria,
    Cupom,
    Orcamento,
    Pedido,
    Produto,
)
from app.services.configuracao_service import get_settings, save_settings
from app.services.imagem_service import save_product_image
from app.services.orcamento_service import update_orcamento
from app.services.pedido_service import report_csv, summarize_cash, summarize_customers, summarize_reports, summarize_store
from app.services.produto_service import create_id, now_iso, product_from_payload, slugify
from app.services.stock_service import confirm_reserved_stock, release_reserved_stock

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return jsonify({"error": "Acesso restrito ao administrador."}), 403
    return None


@bp.before_request
def protect_admin():
    return admin_required()


def log_action(action, detail=""):
    db.session.add(
        Atividade(
            user_id=current_user.id,
            user_name=current_user.name,
            action=action,
            detail=detail,
            created_at=now_iso(),
        ),
    )


def clean_coupon(payload, coupon=None):
    code = "".join(ch for ch in str(payload.get("code") or "").upper() if ch.isalnum() or ch in "_-")
    kind = str(payload.get("type") or "percent")
    value = float(payload.get("value") or 0)
    min_subtotal = max(0, float(payload.get("minSubtotal") or 0))
    if not code:
        raise ValueError("Informe o codigo do cupom.")
    if kind not in {"percent", "fixed", "free_shipping"}:
        raise ValueError("Tipo de cupom invalido.")
    if kind != "free_shipping" and value <= 0:
        raise ValueError("Valor do cupom invalido.")
    if kind == "percent" and value > 90:
        raise ValueError("Desconto percentual maximo permitido: 90%.")
    coupon = coupon or Cupom(id=create_id("cup"), created_at=now_iso())
    coupon.code = code
    coupon.type = kind
    coupon.value = 0 if kind == "free_shipping" else value
    coupon.min_subtotal = min_subtotal
    coupon.active = bool(payload.get("active"))
    coupon.updated_at = now_iso()
    return coupon


@bp.get("/summary")
def summary():
    return jsonify({"summary": summarize_store()})


@bp.get("/reports")
def reports():
    return jsonify({"reports": summarize_reports()})


@bp.get("/cash")
def cash():
    return jsonify({"cash": summarize_cash()})


@bp.get("/logs")
def logs():
    items = Atividade.query.order_by(Atividade.created_at.desc()).limit(100).all()
    return jsonify({"logs": [item.to_dict() for item in items]})


@bp.get("/backup")
def backup():
    payload = {
        "exportedAt": now_iso(),
        "site": get_settings().get("siteName", "Facas Brazao"),
        "data": {
            "settings": get_settings(),
            "products": [item.to_dict() for item in Produto.query.all()],
            "coupons": [item.to_dict() for item in Cupom.query.all()],
            "reviews": [item.to_dict() for item in Avaliacao.query.all()],
            "orders": [item.to_dict() for item in Pedido.query.all()],
        },
    }
    return jsonify(payload)


@bp.post("/cash")
def cash_create():
    body = request.get_json(silent=True) or {}
    amount = float(body.get("amount") or 0)
    kind = str(body.get("type") or "entrada")
    if kind not in {"entrada", "saida"} or amount <= 0:
        return jsonify({"error": "Lancamento de caixa invalido."}), 400
    entry = CaixaLancamento(
        id=create_id("cx"),
        type=kind,
        amount=amount,
        method=str(body.get("method") or "PIX").strip(),
        description=str(body.get("description") or ("Entrada manual" if kind == "entrada" else "Saida manual")).strip(),
        created_by=current_user.id,
        created_at=now_iso(),
    )
    db.session.add(entry)
    log_action("Entrada no caixa" if kind == "entrada" else "Saida no caixa", entry.description)
    db.session.commit()
    return jsonify({"entry": entry.to_dict(), "cash": summarize_cash()}), 201


@bp.post("/cash/close")
def cash_close():
    body = request.get_json(silent=True) or {}
    cash_data = summarize_cash()
    counted = float(body.get("countedBalance") or cash_data["summary"]["balance"] or 0)
    closing = CaixaFechamento(
        id=create_id("close"),
        period=str(body.get("period") or now_iso()[:10]),
        opening_balance=float(body.get("openingBalance") or 0),
        expected_balance=float(cash_data["summary"]["balance"] or 0),
        counted_balance=counted,
        difference=counted - float(cash_data["summary"]["balance"] or 0),
        notes=str(body.get("notes") or "").strip(),
        closed_by=current_user.id,
        closed_at=now_iso(),
    )
    db.session.add(closing)
    log_action("Fechamento de caixa", f"Periodo {closing.period}")
    db.session.commit()
    return jsonify({"closing": closing.to_dict(), "cash": summarize_cash()}), 201


@bp.put("/password")
def password():
    body = request.get_json(silent=True) or {}
    new_password = str(body.get("newPassword") or "")
    if len(new_password) < 6:
        return jsonify({"error": "A nova senha precisa ter pelo menos 6 caracteres."}), 400
    if not check_password_hash(current_user.password_hash, str(body.get("currentPassword") or "")):
        return jsonify({"error": "Senha atual incorreta."}), 400
    current_user.password_hash = generate_password_hash(new_password)
    current_user.updated_at = now_iso()
    log_action("Senha do admin alterada", current_user.email)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/upload-image")
def upload_image():
    try:
        path = save_product_image(request.files.get("image"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"path": path}), 201


@bp.get("/products")
def products():
    return jsonify({"products": [item.to_dict() for item in Produto.query.order_by(Produto.created_at.desc()).all()]})


@bp.post("/products")
def product_create():
    try:
        product = product_from_payload(request.get_json(silent=True) or {})
        db.session.add(product)
        log_action("Produto criado", product.name)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"product": product.to_dict()}), 201


@bp.put("/products/<product_id>")
def product_update(product_id):
    product = db.session.get(Produto, product_id)
    if not product:
        return jsonify({"error": "Produto nao encontrado."}), 404
    try:
        product = product_from_payload(request.get_json(silent=True) or {}, product)
        log_action("Produto atualizado", product.name)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"product": product.to_dict()})


@bp.delete("/products/<product_id>")
def product_delete(product_id):
    product = db.session.get(Produto, product_id)
    if not product:
        return jsonify({"error": "Produto nao encontrado."}), 404
    product.active = False
    product.updated_at = now_iso()
    log_action("Produto desativado", product.name)
    db.session.commit()
    return jsonify({"product": product.to_dict()})


@bp.get("/categories")
def categories():
    counts = {row[0]: row[1] for row in db.session.query(Produto.category, db.func.count(Produto.id)).group_by(Produto.category)}
    items = Categoria.query.order_by(Categoria.name.asc()).all()
    return jsonify({"categories": [item.to_dict(counts.get(item.slug, 0)) for item in items]})


@bp.post("/categories")
def category_create():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Informe o nome da categoria."}), 400
    slug = slugify(body.get("slug") or name)
    if Categoria.query.filter_by(slug=slug).first():
        return jsonify({"error": "Ja existe uma categoria com esse slug."}), 409
    category = Categoria(id=slug, name=name, slug=slug, active=bool(body.get("active", True)), created_at=now_iso())
    db.session.add(category)
    log_action("Categoria criada", category.name)
    db.session.commit()
    return jsonify({"category": category.to_dict()}), 201


@bp.put("/categories/<category_id>")
def category_update(category_id):
    category = db.session.get(Categoria, category_id)
    if not category:
        return jsonify({"error": "Categoria nao encontrada."}), 404
    body = request.get_json(silent=True) or {}
    category.name = str(body.get("name") or category.name).strip()
    category.active = bool(body.get("active", category.active))
    category.updated_at = now_iso()
    log_action("Categoria atualizada", category.name)
    db.session.commit()
    return jsonify({"category": category.to_dict()})


@bp.delete("/categories/<category_id>")
def category_delete(category_id):
    category = db.session.get(Categoria, category_id)
    if not category:
        return jsonify({"error": "Categoria nao encontrada."}), 404
    if Produto.query.filter_by(category=category.slug).count():
        return jsonify({"error": "Nao remova categoria com produtos vinculados."}), 400
    db.session.delete(category)
    log_action("Categoria removida", category.name)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/coupons")
def coupons():
    return jsonify({"coupons": [item.to_dict() for item in Cupom.query.order_by(Cupom.created_at.desc()).all()]})


@bp.post("/coupons")
def coupon_create():
    try:
        coupon = clean_coupon(request.get_json(silent=True) or {})
        if Cupom.query.filter_by(code=coupon.code).first():
            return jsonify({"error": "Ja existe um cupom com esse codigo."}), 409
        db.session.add(coupon)
        log_action("Cupom criado", coupon.code)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"coupon": coupon.to_dict()}), 201


@bp.put("/coupons/<coupon_id>")
def coupon_update(coupon_id):
    coupon = db.session.get(Cupom, coupon_id)
    if not coupon:
        return jsonify({"error": "Cupom nao encontrado."}), 404
    try:
        coupon = clean_coupon(request.get_json(silent=True) or {}, coupon)
        log_action("Cupom atualizado", coupon.code)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"coupon": coupon.to_dict()})


@bp.delete("/coupons/<coupon_id>")
def coupon_delete(coupon_id):
    coupon = db.session.get(Cupom, coupon_id)
    if not coupon:
        return jsonify({"error": "Cupom nao encontrado."}), 404
    coupon.active = False
    coupon.updated_at = now_iso()
    log_action("Cupom desativado", coupon.code)
    db.session.commit()
    return jsonify({"coupon": coupon.to_dict()})


@bp.get("/reviews")
def reviews():
    return jsonify({"reviews": [item.to_dict() for item in Avaliacao.query.order_by(Avaliacao.created_at.desc()).all()]})


@bp.put("/reviews/<review_id>")
def review_update(review_id):
    review = db.session.get(Avaliacao, review_id)
    status = str((request.get_json(silent=True) or {}).get("status") or "")
    if not review:
        return jsonify({"error": "Avaliacao nao encontrada."}), 404
    if status not in {"pending", "approved", "rejected"}:
        return jsonify({"error": "Status de avaliacao invalido."}), 400
    review.status = status
    review.updated_at = now_iso()
    log_action("Avaliacao moderada", f"{review.product_name}: {review.status}")
    db.session.commit()
    return jsonify({"review": review.to_dict()})


@bp.get("/orders")
def orders():
    return jsonify({"orders": [item.to_dict() for item in Pedido.query.order_by(Pedido.created_at.desc()).all()]})


@bp.get("/orcamentos")
def orcamentos():
    return jsonify({"orcamentos": [item.to_dict() for item in Orcamento.query.order_by(Orcamento.created_at.desc()).all()]})


@bp.put("/orcamentos/<quote_id>")
def orcamento_update(quote_id):
    quote = db.session.get(Orcamento, quote_id)
    if not quote:
        return jsonify({"error": "Orcamento nao encontrado."}), 404
    try:
        update_orcamento(quote, request.get_json(silent=True) or {})
        log_action("Orcamento atualizado", f"{quote.id}: {quote.status}")
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"orcamento": quote.to_dict()})


@bp.put("/orders/<order_id>")
def order_update(order_id):
    order = db.session.get(Pedido, order_id)
    if not order:
        return jsonify({"error": "Pedido nao encontrado."}), 404
    body = request.get_json(silent=True) or {}
    next_status = str(body.get("status") or order.status)
    if next_status != order.status:
        timeline = order.timeline or []
        timeline.append({"status": next_status, "note": str(body.get("note") or f"Status alterado para {next_status}."), "at": now_iso(), "by": current_user.id})
        order.timeline = timeline
        if next_status == "Cancelado":
            release_reserved_stock(order)
        elif next_status == "Pago":
            confirm_reserved_stock(order)
    order.status = next_status
    order.updated_at = now_iso()
    log_action("Status do pedido alterado", f"{order.id}: {order.status}")
    db.session.commit()
    return jsonify({"order": order.to_dict()})


@bp.get("/customers")
def customers():
    return jsonify({"customers": summarize_customers()})


@bp.get("/reports.csv")
def reports_csv():
    kind = request.args.get("type", "orders")
    csv = "\ufeff" + report_csv(kind)
    return Response(csv, mimetype="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename=relatorio-{kind}-facas-brazao.csv"})


@bp.put("/settings")
def settings_update():
    data = save_settings(request.get_json(silent=True) or {})
    log_action("Configuracoes da loja salvas", data.get("siteName", "Facas Brazao"))
    db.session.commit()
    return jsonify({"settings": data})
