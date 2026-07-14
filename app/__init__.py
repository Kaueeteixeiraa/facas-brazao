from pathlib import Path
import sys
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

from flask import Flask, Response, jsonify, render_template, request, send_from_directory, session

from config import BASE_DIR, Config

from .extensions import csrf, db, login_manager, migrate
from .middleware import init_security
from .models import Produto, Usuario
from .services.configuracao_service import ensure_seed_data


def create_app(config_object=Config):
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR),
        static_folder=None,
    )
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    init_security(app)
    login_manager.login_view = "auth.login"
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    from .routes.admin import bp as admin_bp
    from .routes.autenticacao import bp as auth_bp
    from .routes.carrinho import bp as carrinho_bp
    from .routes.loja import bp as loja_bp
    from .routes.mercado_pago import bp as mercado_pago_bp
    from .routes.orcamentos import bp as orcamentos_bp
    from .routes.pedidos import bp as pedidos_bp

    app.register_blueprint(loja_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(carrinho_bp)
    app.register_blueprint(pedidos_bp)
    app.register_blueprint(orcamentos_bp)
    app.register_blueprint(mercado_pago_bp)
    app.register_blueprint(admin_bp)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(Usuario, user_id)

    @app.before_request
    def protect_json_mutations():
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return None
        if not request.path.startswith("/api/"):
            return None
        if request.path in {"/api/payments/mercadopago/webhook", "/api/webhooks/mercado-pago"}:
            return None
        token = session.setdefault("csrf_token", __import__("secrets").token_urlsafe(32))
        sent = request.headers.get("X-CSRFToken") or request.headers.get("X-CSRF-Token")
        if not sent or sent != token:
            return jsonify({"error": "Sessao expirada. Recarregue a pagina."}), 400
        return None

    @app.route("/")
    def index():
        session.setdefault("csrf_token", __import__("secrets").token_urlsafe(32))
        return render_template("index.html")

    @app.get("/robots.txt")
    def robots():
        base_url = public_base_url(app)
        body = "\n".join(
            [
                "User-agent: *",
                "Allow: /",
                "Disallow: /admin",
                "Disallow: /api/",
                f"Sitemap: {base_url}/sitemap.xml",
                "",
            ]
        )
        return Response(body, mimetype="text/plain")

    @app.get("/sitemap.xml")
    def sitemap():
        base_url = public_base_url(app)
        urls = [
            {"loc": f"{base_url}/", "priority": "1.0"},
            {"loc": f"{base_url}/produtos", "priority": "0.9"},
            {"loc": f"{base_url}/sob-encomenda", "priority": "0.7"},
        ]
        products = (
            Produto.query.filter_by(active=True)
            .order_by(Produto.featured.asc(), Produto.name.asc())
            .all()
        )
        for product in products:
            slug = quote(product.slug or product.id, safe="")
            urls.append(
                {
                    "loc": f"{base_url}/produto/{slug}",
                    "lastmod": (product.updated_at or product.created_at or "")[:10],
                    "priority": "0.8",
                }
            )
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ]
        for url in urls:
            lines.extend(["  <url>", f"    <loc>{xml_escape(url['loc'])}</loc>"])
            if url.get("lastmod"):
                lines.append(f"    <lastmod>{xml_escape(url['lastmod'])}</lastmod>")
            lines.extend([f"    <priority>{url['priority']}</priority>", "  </url>"])
        lines.append("</urlset>")
        return Response("\n".join(lines), mimetype="application/xml")

    @app.get("/styles.css")
    def styles():
        return send_from_directory(BASE_DIR, "styles.css")

    @app.get("/app.js")
    def script():
        return send_from_directory(BASE_DIR, "app.js")

    @app.get("/assets/<path:filename>")
    def assets(filename):
        return send_from_directory(BASE_DIR / "assets", filename)

    @app.get("/screenshots/<path:filename>")
    def screenshots(filename):
        return send_from_directory(BASE_DIR / "screenshots", filename)

    @app.get("/static/uploads/<path:filename>")
    def uploaded_files(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.errorhandler(404)
    def not_found(_error):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Rota nao encontrada."}), 404
        return render_template("index.html")

    @app.errorhandler(Exception)
    def handle_error(error):
        app.logger.exception(error)
        return jsonify({"error": str(error) or "Nao foi possivel concluir a acao."}), 500

    register_cli(app)
    if app.config["AUTO_CREATE_DB"] and "db" not in sys.argv:
        with app.app_context():
            db.create_all()
            ensure_seed_data()
    return app


def public_base_url(app):
    configured = str(app.config.get("PUBLIC_SITE_URL") or "").strip().rstrip("/")
    return configured or request.host_url.rstrip("/")


def register_cli(app):
    from .services.legacy_import import import_legacy_store

    @app.cli.command("importar-dados-antigos")
    def importar_dados_antigos():
        report = import_legacy_store()
        for line in report:
            print(line)
