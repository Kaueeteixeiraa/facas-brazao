from app.extensions import db


class Avaliacao(db.Model):
    __tablename__ = "avaliacoes"

    id = db.Column(db.String(80), primary_key=True)
    product_id = db.Column(db.String(80), db.ForeignKey("produtos.id"), nullable=False, index=True)
    product_name = db.Column(db.String(180), nullable=False)
    customer_id = db.Column(db.String(80), db.ForeignKey("usuarios.id"), nullable=False, index=True)
    customer_name = db.Column(db.String(160), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="pending", index=True)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_dict(self):
        return {
            "id": self.id,
            "productId": self.product_id,
            "productName": self.product_name,
            "customerId": self.customer_id,
            "customerName": self.customer_name,
            "rating": self.rating,
            "comment": self.comment,
            "status": self.status,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
        }
