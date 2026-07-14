from app.extensions import db


class Cupom(db.Model):
    __tablename__ = "cupons"

    id = db.Column(db.String(80), primary_key=True)
    code = db.Column(db.String(80), nullable=False, unique=True, index=True)
    type = db.Column(db.String(40), nullable=False, default="percent")
    value = db.Column(db.Float, nullable=False, default=0)
    min_subtotal = db.Column(db.Float, nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "type": self.type,
            "value": self.value,
            "minSubtotal": self.min_subtotal,
            "active": self.active,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
        }
