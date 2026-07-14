from pathlib import Path
from uuid import uuid4

from flask import current_app
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename


ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def save_product_image(file_storage):
    if not file_storage or not file_storage.filename:
        raise ValueError("Arquivo de imagem nao encontrado.")
    original = secure_filename(file_storage.filename)
    if not original:
        raise ValueError("Nome de arquivo invalido.")
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "products"
    upload_dir.mkdir(parents=True, exist_ok=True)
    try:
        image = Image.open(file_storage.stream)
        image.verify()
        file_storage.stream.seek(0)
        image = Image.open(file_storage.stream)
    except UnidentifiedImageError as exc:
        raise ValueError("Formato de imagem invalido.") from exc
    ext = ALLOWED_FORMATS.get(image.format)
    if not ext:
        raise ValueError("Use JPG, JPEG, PNG ou WEBP.")
    image.thumbnail((1600, 1600))
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGB")
    filename = f"{uuid4().hex}{ext}"
    path = upload_dir / filename
    save_args = {"quality": 84, "optimize": True} if ext in {".jpg", ".webp"} else {"optimize": True}
    image.save(path, **save_args)
    return f"/static/uploads/products/{filename}"
