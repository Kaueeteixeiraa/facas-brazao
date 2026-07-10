from app.extensions import db


class Configuracao(db.Model):
    __tablename__ = "configuracoes"

    id = db.Column(db.String(40), primary_key=True, default="default")
    data = db.Column(db.JSON, nullable=False, default=dict)
    updated_at = db.Column(db.String(40), default="")
