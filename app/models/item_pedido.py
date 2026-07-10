from app.extensions import db


class ItemPedido(db.Model):
    __tablename__ = "itens_pedido"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.String(80), db.ForeignKey("pedidos.id"), nullable=False, index=True)
    product_id = db.Column(db.String(80), db.ForeignKey("produtos.id"), nullable=False, index=True)
    sku = db.Column(db.String(120), default="")
    name = db.Column(db.String(180), nullable=False)
    price = db.Column(db.Float, nullable=False, default=0)
    cost = db.Column(db.Float, nullable=False, default=0)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    product = db.relationship("Produto")

    def to_dict(self, public=False):
        data = {
            "productId": self.product_id,
            "name": self.name,
            "price": self.price,
            "quantity": self.quantity,
        }
        if not public:
            data["sku"] = self.sku or ""
            data["cost"] = self.cost or 0
        return data
