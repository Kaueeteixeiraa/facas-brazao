from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.extensions import db
from app.models import Avaliacao, Favorito, ItemPedido, Pedido, Produto
from app.routes.loja import public_product
from app.services.mercado_pago_service import create_preference
from app.services.pedido_service import create_order
from app.services.produto_service import create_id, now_iso

bp = Blueprint("pedidos", __name__, url_prefix="/api")


def require_user():
    if not current_user.is_authenticated:
        return jsonify({"error": "Entre na conta para continuar."}), 401
    return None


@bp.get("/my/orders")
def my_orders():
    error = require_user()
    if error:
        return error
    query = Pedido.query.order_by(Pedido.created_at.desc())
    orders = query.all() if current_user.role == "admin" else query.filter_by(customer_id=current_user.id).all()
    return jsonify({"orders": [order.to_dict(public=current_user.role != "admin") for order in orders]})


def user_favorite_ids():
    return [
        item.product_id
        for item in Favorito.query.filter_by(user_id=current_user.id)
        .join(Produto, Produto.id == Favorito.product_id)
        .filter(Produto.active.is_(True))
        .order_by(Favorito.created_at.desc())
        .all()
    ]


@bp.get("/my/favorites")
def my_favorites():
    error = require_user()
    if error:
        return error
    return jsonify({"productIds": user_favorite_ids()})


@bp.put("/my/favorites")
def my_favorites_replace():
    error = require_user()
    if error:
        return error
    body = request.get_json(silent=True) or {}
    ids = list(dict.fromkeys(str(item) for item in (body.get("productIds") or []) if item))
    products = Produto.query.filter(Produto.id.in_(ids), Produto.active.is_(True)).all() if ids else []
    valid_ids = {item.id for item in products}
    Favorito.query.filter_by(user_id=current_user.id).delete()
    for product_id in ids:
        if product_id in valid_ids:
            db.session.add(Favorito(id=create_id("fav"), user_id=current_user.id, product_id=product_id, created_at=now_iso()))
    db.session.commit()
    return jsonify({"productIds": user_favorite_ids()})


@bp.post("/my/favorites/<product_id>")
def my_favorite_add(product_id):
    error = require_user()
    if error:
        return error
    product = Produto.query.filter_by(id=product_id, active=True).first()
    if not product:
        return jsonify({"error": "Produto nao encontrado."}), 404
    favorite = Favorito.query.filter_by(user_id=current_user.id, product_id=product.id).first()
    if not favorite:
        db.session.add(Favorito(id=create_id("fav"), user_id=current_user.id, product_id=product.id, created_at=now_iso()))
        db.session.commit()
    return jsonify({"productIds": user_favorite_ids()})


@bp.delete("/my/favorites/<product_id>")
def my_favorite_remove(product_id):
    error = require_user()
    if error:
        return error
    Favorito.query.filter_by(user_id=current_user.id, product_id=product_id).delete()
    db.session.commit()
    return jsonify({"productIds": user_favorite_ids()})


@bp.post("/orders")
def orders_create():
    body = request.get_json(silent=True) or {}
    try:
        order = create_order(body, current_user if current_user.is_authenticated else None)
        payment = None
        if "mercado" in str(order.payment_method or "").lower():
            pref = create_preference(order)
            payment = {
                "provider": "Mercado Pago",
                "preferenceId": pref.get("id"),
                "redirectUrl": pref.get("init_point") or pref.get("sandbox_init_point"),
                "sandboxRedirectUrl": pref.get("sandbox_init_point"),
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
