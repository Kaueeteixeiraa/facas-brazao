import io

import pytest

from app import create_app
from app.extensions import db


class TestConfig:
    SECRET_KEY = "test"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_CHECK_DEFAULT = False
    TESTING = True
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024
    MERCADO_PAGO_ACCESS_TOKEN = ""
    PUBLIC_SITE_URL = ""
    AUTO_CREATE_DB = True
    UPLOAD_FOLDER = "app/static/uploads-test"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False


@pytest.fixture()
def client():
    app = create_app(TestConfig)
    with app.app_context():
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def token(client):
    return client.get("/api/bootstrap").json["csrfToken"]


def admin_login(client):
    csrf = token(client)
    response = client.post(
        "/api/login",
        json={"email": "admin@facasbrazao.com", "password": "admin123"},
        headers={"X-CSRFToken": csrf},
    )
    assert response.status_code == 200
    return csrf


def product_payload(name="Faca Teste"):
    return {
        "name": name,
        "sku": "TESTE-1",
        "category": "cozinha",
        "price": 199,
        "promoPrice": 179,
        "cost": 80,
        "stock": 5,
        "minStock": 1,
        "badge": "Teste",
        "image": "assets/prod-chef.png",
        "gallery": "",
        "steel": "Aco 1070",
        "size": "20 cm",
        "handleMaterial": "Madeira",
        "weight": "200 g",
        "bladeLength": "20 cm",
        "totalLength": "32 cm",
        "description": "Produto de teste",
        "active": True,
        "featured": 10,
    }


def test_login_and_admin_protection(client):
    assert client.get("/api/admin/summary").status_code == 403
    csrf = admin_login(client)
    assert client.get("/api/admin/summary").status_code == 200
    response = client.post(
        "/api/register",
        json={"name": "Cliente", "email": "cliente@teste.com", "password": "123456"},
        headers={"X-CSRFToken": csrf},
    )
    assert response.status_code == 201
    assert client.get("/api/admin/summary").status_code == 403


def test_product_crud(client):
    csrf = admin_login(client)
    created = client.post("/api/admin/products", json=product_payload(), headers={"X-CSRFToken": csrf})
    assert created.status_code == 201
    product_id = created.json["product"]["id"]
    edited = client.put(
        f"/api/admin/products/{product_id}",
        json={**product_payload("Faca Editada"), "stock": 3},
        headers={"X-CSRFToken": csrf},
    )
    assert edited.status_code == 200
    assert edited.json["product"]["name"] == "Faca Editada"
    deleted = client.delete(f"/api/admin/products/{product_id}", headers={"X-CSRFToken": csrf})
    assert deleted.status_code == 200
    assert deleted.json["product"]["active"] is False


def test_public_products_and_checkout(client):
    csrf = token(client)
    bootstrap = client.get("/api/bootstrap")
    assert bootstrap.status_code == 200
    assert any("Chef" in product["name"] for product in bootstrap.json["products"])
    detail = client.get("/api/products/chef-8")
    assert detail.status_code == 200
    order = client.post(
        "/api/orders",
        json={
            "items": [{"productId": "chef-8", "quantity": 1}],
            "customerName": "Comprador",
            "customerEmail": "comprador@teste.com",
            "customerPhone": "(11) 99999-0000",
            "cep": "01001000",
            "address": "Rua Teste, 1",
            "paymentMethod": "PIX manual",
            "ageCheck": True,
        },
        headers={"X-CSRFToken": csrf},
    )
    assert order.status_code == 201
    assert order.json["order"]["total"] > 0


def test_stock_validation(client):
    csrf = token(client)
    response = client.post(
        "/api/orders",
        json={
            "items": [{"productId": "chef-8", "quantity": 999}],
            "customerName": "Comprador",
            "customerEmail": "estoque@teste.com",
            "address": "Rua Teste, 1",
            "paymentMethod": "PIX manual",
            "ageCheck": True,
        },
        headers={"X-CSRFToken": csrf},
    )
    assert response.status_code == 400


def test_order_status_update(client):
    csrf = token(client)
    order = client.post(
        "/api/orders",
        json={"items": [{"productId": "santoku", "quantity": 1}], "customerName": "Cliente", "customerEmail": "pedido@teste.com", "address": "Rua", "paymentMethod": "PIX manual", "ageCheck": True},
        headers={"X-CSRFToken": csrf},
    ).json["order"]
    csrf = admin_login(client)
    updated = client.put(f"/api/admin/orders/{order['id']}", json={"status": "Pago"}, headers={"X-CSRFToken": csrf})
    assert updated.status_code == 200
    assert updated.json["order"]["status"] == "Pago"


def test_invalid_upload_and_permission(client):
    csrf = admin_login(client)
    upload = client.post(
        "/api/admin/upload-image",
        data={"image": (io.BytesIO(b"not image"), "bad.txt")},
        content_type="multipart/form-data",
        headers={"X-CSRFToken": csrf},
    )
    assert upload.status_code == 400
    client.post("/api/logout", headers={"X-CSRFToken": csrf})
    assert client.get("/api/admin/products").status_code == 403
