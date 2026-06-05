# Facas Brazão

Site de venda de facas artesanais com vitrine, carrinho, cadastro de clientes, checkout, painel administrativo, relatórios e sistema de caixa.

## Recursos principais

- Vitrine com busca, categorias, ordenação e tema claro/escuro.
- Páginas de detalhe dos produtos com medidas, materiais, garantia, cuidados e WhatsApp.
- Carrinho e checkout com cálculo de frete, cupom, PIX/manual e integração preparada para Mercado Pago.
- Cadastro e login de clientes.
- Área do administrador separada da loja.
- Cadastro, edição, ativação/desativação, estoque e fotos de produtos.
- Gestão de pedidos, status, clientes e avaliações.
- Relatórios de pedidos, produtos, clientes, estoque, vendas por dia e caixa.
- Exportação CSV dos relatórios.
- Sistema de caixa com entradas, saídas, saldo, forma de pagamento e histórico.
- Configuração de textos do site, rodapé, políticas, SEO, WhatsApp, PIX e frete pelo painel.
- Mensagens de WhatsApp configuráveis para produto, checkout e suporte.

## Como rodar

Use Node.js e execute:

```bash
npm start
```

Ou:

```bash
node server.mjs
```

Depois abra:

```text
http://127.0.0.1:5500/
```

## Admin inicial

```text
E-mail: admin@facasbrazao.com
Senha: admin123
```

Troque a senha no painel administrativo antes de usar em produção.

## Variáveis de ambiente

Crie um arquivo `.env` local usando `.env.example` como referência.

```text
MERCADO_PAGO_ACCESS_TOKEN=
PORT=5500
HOST=127.0.0.1
```

Não coloque tokens reais dentro do código e não envie chaves por chat.

## Pagamento real com Mercado Pago

Para pagamento real, crie uma aplicação no Mercado Pago, copie o Access Token de produção e inicie o servidor com `MERCADO_PAGO_ACCESS_TOKEN`.

Para webhooks funcionarem em produção, configure no painel admin uma URL pública HTTPS da loja, por exemplo:

```text
https://www.facasbrazao.com.br
```

O checkout cria pedidos como `Aguardando pagamento`, redireciona para o Mercado Pago e atualiza para `Pago` quando o webhook ou retorno confirmar o pagamento.

## Banco de dados local

Os dados locais ficam em:

```text
data/store.json
```

Esse arquivo não entra no Git porque pode guardar clientes, pedidos, caixa, senhas criptografadas e informações reais. Se ele não existir, o servidor cria uma base inicial automaticamente.

## Estrutura

```text
index.html      Estrutura da página
styles.css      Layout, tema e responsividade
app.js          Interface, carrinho, painel e interações
server.mjs      Servidor, APIs, checkout, admin, relatórios e caixa
assets/         Imagens oficiais do site
data/           Banco local gerado em tempo de execução
uploads/        Fotos enviadas pelo painel admin
```

## Produção

Antes de publicar:

- Troque a senha inicial do administrador.
- Configure token real do Mercado Pago fora do código.
- Use HTTPS.
- Troque o banco local JSON por um banco profissional se houver muitos pedidos.
- Faça backup regular de clientes, pedidos, relatórios e caixa.
