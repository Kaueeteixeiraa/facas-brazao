from datetime import timedelta

from flask import request


LONG_CACHE_PATHS = ("/assets/", "/screenshots/", "/static/uploads/")
SHORT_CACHE_FILES = {"/app.js", "/styles.css"}


def init_security(app):
    app.permanent_session_lifetime = timedelta(minutes=int(app.config.get("SESSION_LIFETIME_MINUTES", 120)))

    @app.after_request
    def apply_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "connect-src 'self' https://viacep.com.br https://api.mercadopago.com; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        if request.is_secure or app.config.get("SESSION_COOKIE_SECURE"):
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.path.startswith(LONG_CACHE_PATHS):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.path in SHORT_CACHE_FILES:
            response.headers["Cache-Control"] = "public, max-age=3600"
        return response
