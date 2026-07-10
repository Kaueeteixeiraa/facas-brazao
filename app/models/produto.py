from app.extensions import db


class Produto(db.Model):
    __tablename__ = "produtos"

    id = db.Column(db.String(80), primary_key=True)
    name = db.Column(db.String(180), nullable=False, index=True)
    slug = db.Column(db.String(120), nullable=False, unique=True, index=True)
    sku = db.Column(db.String(120), default="")
    category = db.Column(db.String(80), nullable=False, index=True)
    price = db.Column(db.Float, nullable=False, default=0)
    promo_price = db.Column(db.Float, default=0)
    cost = db.Column(db.Float, nullable=False, default=0)
    stock = db.Column(db.Integer, nullable=False, default=0)
    min_stock = db.Column(db.Integer, nullable=False, default=3)
    badge = db.Column(db.String(80), default="")
    image = db.Column(db.String(260), default="")
    gallery = db.Column(db.JSON, default=list)
    steel = db.Column(db.String(120), default="")
    size = db.Column(db.String(80), default="")
    handle_material = db.Column(db.String(160), default="")
    weight = db.Column(db.String(80), default="")
    blade_length = db.Column(db.String(80), default="")
    total_length = db.Column(db.String(80), default="")
    sheath = db.Column(db.String(160), default="")
    production_time = db.Column(db.String(120), default="")
    shipping_time = db.Column(db.String(120), default="")
    warranty = db.Column(db.String(220), default="")
    care = db.Column(db.Text, default="")
    description = db.Column(db.Text, default="")
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    featured = db.Column(db.Integer, nullable=False, default=99)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_dict(self, include_private=True, review_stats=None):
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "sku": self.sku or "",
            "category": self.category,
            "price": self.price,
            "promoPrice": self.promo_price or 0,
            "stock": self.stock,
            "badge": self.badge or "",
            "image": self.image or "assets/prod-chef.png",
            "gallery": self.gallery or [],
            "steel": self.steel or "",
            "size": self.size or "",
            "handleMaterial": self.handle_material or "",
            "weight": self.weight or "",
            "bladeLength": self.blade_length or "",
            "totalLength": self.total_length or "",
            "sheath": self.sheath or "",
            "productionTime": self.production_time or "",
            "shippingTime": self.shipping_time or "",
            "warranty": self.warranty or "",
            "care": self.care or "",
            "description": self.description or "",
            "active": self.active,
            "featured": self.featured,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
        }
        if include_private:
            data["cost"] = self.cost
            data["minStock"] = self.min_stock
        if review_stats is not None:
            data["reviewStats"] = review_stats
        return data
