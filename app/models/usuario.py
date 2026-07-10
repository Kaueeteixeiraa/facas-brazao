from flask_login import UserMixin

from app.extensions import db


class Usuario(UserMixin, db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.String(80), primary_key=True)
    role = db.Column(db.String(20), nullable=False, default="customer", index=True)
    name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(180), nullable=False, unique=True, index=True)
    phone = db.Column(db.String(40), default="")
    password_hash = db.Column(db.Text, nullable=False)
    guest = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_public_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone or "",
            "role": self.role,
            "createdAt": self.created_at,
        }
