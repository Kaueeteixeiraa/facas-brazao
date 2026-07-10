from app.extensions import db
from app.models import Orcamento
from app.services.produto_service import create_id, now_iso


def create_orcamento(payload, images=None):
    name = str(payload.get("name") or payload.get("customerName") or "").strip()
    phone = str(payload.get("phone") or payload.get("customerPhone") or "").strip()
    knife_type = str(payload.get("knifeType") or "").strip()
    if not name:
        raise ValueError("Informe seu nome.")
    if not phone:
        raise ValueError("Informe seu WhatsApp.")
    if not knife_type:
        raise ValueError("Informe o tipo de faca.")
    quote = Orcamento(
        id=create_id("ORC").upper(),
        customer_name=name,
        customer_phone=phone,
        customer_email=str(payload.get("email") or payload.get("customerEmail") or "").strip().lower(),
        knife_type=knife_type,
        main_use=str(payload.get("mainUse") or "").strip(),
        desired_size=str(payload.get("desiredSize") or "").strip(),
        steel_type=str(payload.get("steelType") or "").strip(),
        handle_material=str(payload.get("handleMaterial") or "").strip(),
        sheath=str(payload.get("sheath") or "").strip(),
        engraving=bool(payload.get("engraving")),
        engraving_text=str(payload.get("engravingText") or "").strip(),
        budget_range=str(payload.get("budgetRange") or "").strip(),
        desired_deadline=str(payload.get("desiredDeadline") or "").strip(),
        notes=str(payload.get("notes") or "").strip(),
        reference_images=images or [],
        created_at=now_iso(),
    )
    db.session.add(quote)
    return quote


def update_orcamento(quote, payload):
    status = str(payload.get("status") or quote.status).strip()
    if status not in {"Novo", "Em análise", "Aguardando cliente", "Aprovado", "Recusado", "Convertido em pedido"}:
        raise ValueError("Status de orçamento inválido.")
    quote.status = status
    quote.estimated_value = float(payload.get("estimatedValue") or quote.estimated_value or 0)
    quote.estimated_deadline = str(payload.get("estimatedDeadline") or quote.estimated_deadline or "").strip()
    quote.admin_response = str(payload.get("adminResponse") or quote.admin_response or "").strip()
    quote.updated_at = now_iso()
    return quote
