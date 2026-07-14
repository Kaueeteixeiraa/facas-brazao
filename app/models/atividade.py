from app.extensions import db


class Atividade(db.Model):
    __tablename__ = "atividades"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(80), default="")
    user_name = db.Column(db.String(160), default="")
    action = db.Column(db.String(160), nullable=False)
    detail = db.Column(db.Text, default="")
    created_at = db.Column(db.String(40), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "action": self.action,
            "detail": self.detail or "",
            "createdAt": self.created_at,
        }
