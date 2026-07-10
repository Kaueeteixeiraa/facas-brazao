import re
import secrets
import unicodedata
from datetime import datetime, timezone

from app.models import Produto


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_id(prefix):
    return f"{prefix}_{int(datetime.now().timestamp() * 1000):x}_{secrets.token_hex(4)}"


def slugify(value=""):
    text = unicodedata.normalize("NFD", str(value)).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text[:80] or create_id("slug")


def normalize_gallery(image="", gallery=None):
    values = []
    if isinstance(gallery, str):
        values.extend(item.strip() for item in re.split(r"[\r\n,]+", gallery) if item.strip())
    elif isinstance(gallery, list):
        values.extend(str(item).strip() for item in gallery if str(item).strip())
    image = str(image or "").strip()
    return list(dict.fromkeys([item for item in [image, *values] if item]))


def apply_product_defaults(data):
    data["slug"] = slugify(data.get("slug") or data.get("name") or data.get("id"))
    data["sku"] = str(data.get("sku") or data.get("id") or data["slug"]).upper().replace(" ", "_")
    data["min_stock"] = max(0, int(data.get("min_stock") or 3))
    data["image"] = str(data.get("image") or "assets/prod-chef.png").strip()
    data["gallery"] = normalize_gallery(data["image"], data.get("gallery"))
    data["handle_material"] = data.get("handle_material") or (
        "Micarta ou madeira estabilizada" if data.get("category") == "campo" else "Madeira selecionada"
    )
    data["weight"] = data.get("weight") or "Sob consulta"
    data["blade_length"] = data.get("blade_length") or data.get("size") or "Sob consulta"
    data["total_length"] = data.get("total_length") or "Sob consulta"
    data["sheath"] = data.get("sheath") or ("Estojo incluso" if data.get("category") == "kits" else "Bainha sob encomenda")
    data["production_time"] = data.get("production_time") or ("Pronta entrega" if int(data.get("stock") or 0) > 0 else "Sob encomenda")
    data["shipping_time"] = data.get("shipping_time") or "Envio em ate 3 dias uteis"
    data["warranty"] = data.get("warranty") or "Garantia contra defeito de fabricacao"
    data["care"] = data.get("care") or "Lavar a mao, secar bem e guardar em local seco."
    return data


def product_from_payload(payload, product=None):
    name = str(payload.get("name") or "").strip()
    category = str(payload.get("category") or "").strip()
    price = float(payload.get("price") or 0)
    cost = float(payload.get("cost") or 0)
    stock = int(payload.get("stock") or 0)
    if not name:
        raise ValueError("Informe o nome do produto.")
    if not category:
        raise ValueError("Informe a categoria.")
    if price < 0 or cost < 0 or stock < 0:
        raise ValueError("Valores de produto invalidos.")

    current = product or Produto(id=create_id("prod"), created_at=now_iso())
    data = apply_product_defaults(
        {
            "id": current.id,
            "name": name,
            "slug": payload.get("slug") or current.slug or name,
            "sku": payload.get("sku") or current.sku,
            "category": category,
            "price": price,
            "promo_price": float(payload.get("promoPrice") or payload.get("promo_price") or current.promo_price or 0),
            "cost": cost,
            "stock": stock,
            "min_stock": payload.get("minStock") or current.min_stock or 3,
            "badge": str(payload.get("badge") or "").strip(),
            "image": str(payload.get("image") or current.image or "assets/prod-chef.png").strip(),
            "gallery": payload.get("gallery") or current.gallery or [],
            "steel": str(payload.get("steel") or "").strip(),
            "size": str(payload.get("size") or "").strip(),
            "handle_material": str(payload.get("handleMaterial") or "").strip(),
            "weight": str(payload.get("weight") or "").strip(),
            "blade_length": str(payload.get("bladeLength") or "").strip(),
            "total_length": str(payload.get("totalLength") or "").strip(),
            "sheath": str(payload.get("sheath") or "").strip(),
            "production_time": str(payload.get("productionTime") or "").strip(),
            "shipping_time": str(payload.get("shippingTime") or "").strip(),
            "warranty": str(payload.get("warranty") or "").strip(),
            "care": str(payload.get("care") or "").strip(),
            "description": str(payload.get("description") or "").strip(),
            "active": bool(payload.get("active")),
            "featured": int(payload.get("featured") or current.featured or 99),
        },
    )
    for key, value in data.items():
        setattr(current, key, value)
    current.updated_at = now_iso()
    return current
