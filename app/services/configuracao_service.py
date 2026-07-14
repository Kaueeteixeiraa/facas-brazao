from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import Categoria, Configuracao, Cupom, Produto, Usuario
from app.services.produto_service import apply_product_defaults, now_iso, slugify


def default_visual_settings():
    return {
        "primaryColor": "#123c2d",
        "accentColor": "#c9a227",
        "dangerColor": "#9f2a2a",
        "heroImage": "assets/hero-cutelaria.png",
        "buttonRadius": 8,
        "cardRadius": 8,
        "storeLayout": "premium",
        "announcementText": "Frete gratis em pedidos selecionados e atendimento pelo WhatsApp.",
        "customCss": "",
    }


def default_settings():
    return {
        **default_visual_settings(),
        "siteName": "Facas Brazão",
        "heroEyebrow": "Cutelaria artesanal brasileira",
        "tagline": "Facas para churrasco, cozinha e campo com acabamento premium, fio afiado e compra segura.",
        "storeTitle": "Facas à venda",
        "storeSubtitle": "Escolha sua lâmina, adicione ao carrinho e fale com a loja sempre que precisar.",
        "clientAreaTitle": "Entrar na Facas Brazão",
        "clientAreaText": "Conta, cadastro e pedidos em uma janela rápida.",
        "adminAreaTitle": "Gerenciar Facas Brazão",
        "adminAreaText": "Entre como administrador para cadastrar produtos, editar estoque, acompanhar pedidos, clientes e relatórios.",
        "footerTitle": "Facas Brazão",
        "footerText": "Cutelaria artesanal para churrasco, cozinha e campo.",
        "footerAddress": "Atendimento online para todo o Brasil",
        "footerHours": "Segunda a sábado, das 9h às 18h",
        "footerDocument": "Compra permitida somente para maiores de 18 anos.",
        "seoTitle": "Facas Brazão | Facas artesanais e cutelaria",
        "seoDescription": "Facas artesanais para churrasco, cozinha e campo com compra online, suporte pelo WhatsApp e acabamento premium.",
        "shippingPolicy": "Enviamos para todo o Brasil. O prazo varia conforme CEP, disponibilidade em estoque e forma de envio combinada.",
        "exchangePolicy": "Trocas por defeito de fabricação podem ser solicitadas em até 7 dias após o recebimento.",
        "warrantyPolicy": "Garantia contra defeitos de fabricação.",
        "legalPolicy": "Venda exclusiva para maiores de 18 anos.",
        "carePolicy": "Após o uso, lave manualmente, seque bem e aplique uma fina camada de óleo.",
        "whatsappProductMessage": "Olá, tenho interesse na faca {produto} da Facas Brazão. Pode me passar mais detalhes?",
        "whatsappCheckoutMessage": "Olá, estou fechando um pedido no site da Facas Brazão e quero tirar uma dúvida antes de pagar.",
        "whatsappSupportMessage": "Olá, vim pelo site da Facas Brazão e quero atendimento.",
        "whatsapp": "(11) 99999-0000",
        "pixKey": "pix@facasbrazao.com",
        "shippingFee": 25,
        "freeShippingFrom": 700,
        "shippingRules": [
            {"name": "Grande Sao Paulo", "prefixes": ["0"], "fee": 18},
            {"name": "Interior de SP", "prefixes": ["1"], "fee": 24},
            {"name": "Sudeste", "prefixes": ["2", "3"], "fee": 32},
            {"name": "Sul e Centro-Oeste", "prefixes": ["7", "8", "9"], "fee": 39},
            {"name": "Norte e Nordeste", "prefixes": ["4", "5", "6"], "fee": 49},
        ],
        "publicUrl": "",
        "paymentProvider": "Mercado Pago",
        "minAgeNotice": "Venda condicionada a maiores de 18 anos e ao cumprimento das regras locais.",
    }


def get_settings():
    row = db.session.get(Configuracao, "default")
    if not row:
        row = Configuracao(id="default", data=default_settings(), updated_at=now_iso())
        db.session.add(row)
        db.session.commit()
    data = {**default_settings(), **(row.data or {})}
    return data


def save_settings(payload):
    row = db.session.get(Configuracao, "default") or Configuracao(id="default", data={})
    data = {**get_settings(), **payload}
    numeric = ["shippingFee", "freeShippingFrom", "buttonRadius", "cardRadius"]
    for key in numeric:
        data[key] = float(data.get(key) or 0)
    data["customCss"] = str(data.get("customCss") or "")[:12000]
    row.data = data
    row.updated_at = now_iso()
    db.session.add(row)
    return data


def default_coupons():
    return [
        {"id": "coupon_brazao10", "code": "BRAZAO10", "type": "percent", "value": 10, "minSubtotal": 250, "active": True},
        {"id": "coupon_frete", "code": "FRETEGRATIS", "type": "free_shipping", "value": 0, "minSubtotal": 700, "active": True},
    ]


def seed_products():
    return [
        ("chef-8", "Chef 8 Pol. Forjada", "cozinha", 389, 7, "Mais vendida", "assets/prod-chef.png", "Aço 1070", "20 cm", "Madeira estabilizada", "210 g", "20 cm", "33 cm", "Equilíbrio firme para mise en place, cortes longos e uso diário."),
        ("santoku", "Santoku Raiz", "cozinha", 429, 4, "Corte fino", "assets/prod-santoku.png", "Aço inox", "18 cm", "Madeira nobre selada", "195 g", "18 cm", "31 cm", "Perfil versátil para legumes, carnes magras e fatias precisas."),
        ("brisket", "Churrasco Brisket", "churrasco", 459, 3, "Pronta entrega", "assets/prod-brisket.png", "Aço carbono", "25 cm", "Madeira resinada", "260 g", "25 cm", "39 cm", "Lâmina alongada para brisket, costela, picanha e assados."),
        ("campo", "Campo Integral", "campo", 349, 5, "Bainha inclusa", "assets/prod-campo.png", "Full tang", "16 cm", "Micarta texturizada", "240 g", "16 cm", "29 cm", "Modelo robusto para acampamento, pesca e trabalho rural."),
        ("kit-brasa", "Kit Brazão 3 Peças", "kits", 899, 2, "Presente", "assets/prod-kit.png", "Aço misto", "3 peças", "Madeiras selecionadas", "Kit completo", "12 cm, 20 cm e 25 cm", "Estojo com 3 peças", "Chef, trinchante e utilitária em estojo de madeira."),
        ("utilitaria", "Utilitária Curta", "campo", 279, 8, "Compacta", "assets/prod-utilitaria.png", "Aço 5160", "12 cm", "Madeira compacta", "155 g", "12 cm", "24 cm", "Leve, rápida e fácil de transportar no dia a dia."),
    ]


def ensure_seed_data():
    now = now_iso()
    get_settings()
    for name in ["cozinha", "churrasco", "campo", "kits"]:
        if not db.session.get(Categoria, name):
            db.session.add(Categoria(id=name, name=name.title(), slug=name, created_at=now))
    if not db.session.get(Usuario, "admin"):
        db.session.add(
            Usuario(
                id="admin",
                role="admin",
                name="Administrador",
                email="admin@facasbrazao.com",
                phone="",
                password_hash=generate_password_hash("admin123"),
                created_at=now,
            ),
        )
    for item in default_coupons():
        if not db.session.get(Cupom, item["id"]):
            db.session.add(
                Cupom(
                    id=item["id"],
                    code=item["code"],
                    type=item["type"],
                    value=item["value"],
                    min_subtotal=item["minSubtotal"],
                    active=item["active"],
                    created_at=now,
                ),
            )
    for index, item in enumerate(seed_products(), start=1):
        if db.session.get(Produto, item[0]):
            continue
        data = apply_product_defaults(
            {
                "id": item[0],
                "name": item[1],
                "category": item[2],
                "price": item[3],
                "stock": item[4],
                "badge": item[5],
                "image": item[6],
                "steel": item[7],
                "size": item[8],
                "handle_material": item[9],
                "weight": item[10],
                "blade_length": item[11],
                "total_length": item[12],
                "description": item[13],
                "active": True,
                "featured": index,
                "created_at": now,
            },
        )
        db.session.add(Produto(**data))
    db.session.commit()
