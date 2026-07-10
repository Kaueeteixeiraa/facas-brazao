# Facas Brazão

Loja virtual de facas artesanais com catálogo, filtros, carrinho, checkout, clientes, pedidos, painel administrativo, relatórios, caixa, avaliações, cupons e configurações dinâmicas.

## Stack

- Python 3.12
- Flask, Jinja2, Flask-SQLAlchemy, Flask-Migrate, Flask-Login, Flask-WTF
- SQLite local ou MySQL via PyMySQL
- Pillow para upload/tratamento de imagens
- HTML5, CSS3 e JavaScript puro
- Gunicorn no Render

## Estrutura

```text
app/
  models/        modelos SQLAlchemy
  routes/        rotas da loja, autenticação, carrinho, pedidos e admin
  services/      regras de produto, pedido, imagem, configuração e importação
  static/uploads uploads do painel
migrations/      migrations Flask-Migrate
tests/           testes pytest
config.py        configuração por ambiente
run.py           app Flask
requirements.txt dependências Python
Procfile         comando web
render.yaml      publicação Render
```

## Instalação Windows

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
flask db upgrade
python run.py
```

## Instalação Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask db upgrade
gunicorn run:app
```

## Configuração

Copie `.env.example` para `.env`.

```text
SECRET_KEY=troque-esta-chave
DATABASE_URL=sqlite:///facas_brazao.db
MERCADO_PAGO_ACCESS_TOKEN=
PUBLIC_SITE_URL=
PORT=5500
HOST=127.0.0.1
AUTO_CREATE_DB=true
MAX_UPLOAD_MB=8
```

SQLite local:

```text
DATABASE_URL=sqlite:///facas_brazao.db
```

MySQL:

```text
DATABASE_URL=mysql+pymysql://usuario:senha@localhost/facas_brazao
```

## Banco e dados antigos

Aplicar migrations:

```bash
flask db upgrade
```

Importar `data/store.json` antigo de forma idempotente:

```bash
flask importar-dados-antigos
```

O importador preserva IDs quando possível e ignora registros já migrados.

## Admin inicial

```text
E-mail: admin@facasbrazao.com
Senha: admin123
```

Troque a senha no painel antes de publicar.

## Execução local

```bash
python run.py
```

Abra:

```text
http://127.0.0.1:5500/
```

## Testes

```bash
python -m pytest -q
```

## Render

O projeto usa:

```text
Build: pip install -r requirements.txt && flask db upgrade
Start: gunicorn run:app --bind 0.0.0.0:$PORT
```

Configure `SECRET_KEY`, `DATABASE_URL`, `PUBLIC_SITE_URL` e `MERCADO_PAGO_ACCESS_TOKEN` no painel do Render. A pasta persistente de uploads está em `app/static/uploads`.

## Solução de problemas

- `flask` não encontrado: use `python -m flask ...`.
- Upload falha: confira `MAX_UPLOAD_MB` e permissões de `app/static/uploads`.
- Mercado Pago não aparece: configure `MERCADO_PAGO_ACCESS_TOKEN`.
- MySQL falha: confira usuário, senha, banco e prefixo `mysql+pymysql://`.
