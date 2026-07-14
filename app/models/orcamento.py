from app.extensions import db


class Orcamento(db.Model):
    __tablename__ = "orcamentos"

    id = db.Column(db.String(80), primary_key=True)
    customer_name = db.Column(db.String(160), nullable=False)
    customer_phone = db.Column(db.String(40), nullable=False)
    customer_email = db.Column(db.String(180), default="")
    knife_type = db.Column(db.String(120), nullable=False)
    main_use = db.Column(db.String(160), default="")
    desired_size = db.Column(db.String(80), default="")
    steel_type = db.Column(db.String(120), default="")
    handle_material = db.Column(db.String(120), default="")
    sheath = db.Column(db.String(120), default="")
    engraving = db.Column(db.Boolean, nullable=False, default=False)
    engraving_text = db.Column(db.String(180), default="")
    budget_range = db.Column(db.String(80), default="")
    desired_deadline = db.Column(db.String(80), default="")
    notes = db.Column(db.Text, default="")
    reference_images = db.Column(db.JSON, default=list)
    estimated_value = db.Column(db.Float, default=0)
    estimated_deadline = db.Column(db.String(80), default="")
    admin_response = db.Column(db.Text, default="")
    status = db.Column(db.String(40), nullable=False, default="Novo", index=True)
    created_at = db.Column(db.String(40), nullable=False)
    updated_at = db.Column(db.String(40), default="")

    def to_dict(self):
        return {
            "id": self.id,
            "customerName": self.customer_name,
            "customerPhone": self.customer_phone,
            "customerEmail": self.customer_email or "",
            "knifeType": self.knife_type,
            "mainUse": self.main_use or "",
            "desiredSize": self.desired_size or "",
            "steelType": self.steel_type or "",
            "handleMaterial": self.handle_material or "",
            "sheath": self.sheath or "",
            "engraving": self.engraving,
            "engravingText": self.engraving_text or "",
            "budgetRange": self.budget_range or "",
            "desiredDeadline": self.desired_deadline or "",
            "notes": self.notes or "",
            "referenceImages": self.reference_images or [],
            "estimatedValue": self.estimated_value or 0,
            "estimatedDeadline": self.estimated_deadline or "",
            "adminResponse": self.admin_response or "",
            "status": self.status,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at or "",
        }
