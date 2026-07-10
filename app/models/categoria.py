from app.extensions import db


class Categoria(db.Model):
    __tablename__ = "categorias"

    id = db.Column(db.String(80), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(120), nullable=False, unique=True, index=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_dict(self, product_count=0):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "active": self.active,
            "productCount": product_count,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
        }
