from app.extensions import db


class Pedido(db.Model):
    __tablename__ = "pedidos"

    id = db.Column(db.String(80), primary_key=True)
    customer_id = db.Column(db.String(80), db.ForeignKey("usuarios.id"), nullable=False, index=True)
    customer_name = db.Column(db.String(160), nullable=False)
    customer_email = db.Column(db.String(180), nullable=False)
    customer_phone = db.Column(db.String(40), default="")
    address = db.Column(db.Text, nullable=False)
    cep = db.Column(db.String(12), default="")
    payment_method = db.Column(db.String(80), default="Combinar")
    notes = db.Column(db.Text, default="")
    subtotal = db.Column(db.Float, nullable=False, default=0)
    shipping = db.Column(db.Float, nullable=False, default=0)
    discount = db.Column(db.Float, nullable=False, default=0)
    total = db.Column(db.Float, nullable=False, default=0)
    status = db.Column(db.String(80), nullable=False, default="Novo", index=True)
    timeline = db.Column(db.JSON, default=list)
    shipping_quote = db.Column(db.JSON, default=dict)
    coupon = db.Column(db.JSON, default=dict)
    payment = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    customer = db.relationship("Usuario")
    items = db.relationship("ItemPedido", cascade="all, delete-orphan", backref="pedido", lazy=True)

    def to_dict(self, public=False):
        data = {
            "id": self.id,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
            "status": self.status,
            "paymentMethod": self.payment_method,
            "items": [item.to_dict(public=public) for item in self.items],
            "subtotal": self.subtotal,
            "shipping": self.shipping,
            "discount": self.discount or 0,
            "total": self.total,
            "timeline": self.timeline or [],
            "coupon": self.coupon or None,
            "payment": self.payment or None,
        }
        if public:
            data["delivery"] = {
                "cep": self.cep or "",
                "region": (self.shipping_quote or {}).get("region", ""),
            }
            return data
        data.update(
            {
                "customerId": self.customer_id,
                "customerName": self.customer_name,
                "customerEmail": self.customer_email,
                "customerPhone": self.customer_phone or "",
                "address": self.address,
                "cep": self.cep or "",
                "notes": self.notes or "",
                "shippingQuote": self.shipping_quote or {},
            },
        )
        return data
