from app.extensions import db


class Favorito(db.Model):
    __tablename__ = "favoritos"
    __table_args__ = (db.UniqueConstraint("user_id", "product_id", name="uq_favorito_usuario_produto"),)

    id = db.Column(db.String(80), primary_key=True)
    user_id = db.Column(db.String(80), db.ForeignKey("usuarios.id"), nullable=False, index=True)
    product_id = db.Column(db.String(80), db.ForeignKey("produtos.id"), nullable=False, index=True)
    created_at = db.Column(db.String(40), nullable=False)

    product = db.relationship("Produto")

    def to_dict(self):
        return {
            "id": self.id,
            "productId": self.product_id,
            "createdAt": self.created_at,
        }
