from app.extensions import db


class CaixaLancamento(db.Model):
    __tablename__ = "caixa_lancamentos"

    id = db.Column(db.String(80), primary_key=True)
    type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    method = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(240), nullable=False)
    created_by = db.Column(db.String(80), db.ForeignKey("usuarios.id"), nullable=False)
    created_at = db.Column(db.String(40), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "amount": self.amount,
            "method": self.method,
            "description": self.description,
            "createdBy": self.created_by,
            "createdAt": self.created_at,
        }


class CaixaFechamento(db.Model):
    __tablename__ = "caixa_fechamentos"

    id = db.Column(db.String(80), primary_key=True)
    period = db.Column(db.String(20), nullable=False)
    opening_balance = db.Column(db.Float, nullable=False, default=0)
    expected_balance = db.Column(db.Float, nullable=False, default=0)
    counted_balance = db.Column(db.Float, nullable=False, default=0)
    difference = db.Column(db.Float, nullable=False, default=0)
    notes = db.Column(db.Text, default="")
    closed_by = db.Column(db.String(80), db.ForeignKey("usuarios.id"), nullable=False)
    closed_at = db.Column(db.String(40), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "period": self.period,
            "openingBalance": self.opening_balance,
            "expectedBalance": self.expected_balance,
            "countedBalance": self.counted_balance,
            "difference": self.difference,
            "notes": self.notes or "",
            "closedBy": self.closed_by,
            "closedAt": self.closed_at,
        }
