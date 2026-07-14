from flask import Blueprint, jsonify, request

from app.extensions import db
from app.services.orcamento_service import create_orcamento

bp = Blueprint("orcamentos", __name__, url_prefix="/api")


@bp.post("/orcamentos")
def orcamento_create():
    form = request.form if request.form else (request.get_json(silent=True) or {})
    try:
        quote = create_orcamento(form)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    return jsonify({"orcamento": quote.to_dict()}), 201
