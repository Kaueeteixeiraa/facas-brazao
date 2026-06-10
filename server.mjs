import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "store.json");
const uploadsDir = path.join(__dirname, "uploads");
const sessions = new Map();
const runtimeProcess = globalThis.process;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function pbkdf2(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, 120000, 32, "sha256", (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("hex"));
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await pbkdf2(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password, savedHash) {
  const [salt, hash] = String(savedHash || "").split(":");
  if (!salt || !hash) return false;
  const attempt = await pbkdf2(password, salt);
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    createdAt: user.createdAt,
  };
}

function defaultCoupons() {
  return [
    {
      id: "coupon_brazao10",
      code: "BRAZAO10",
      type: "percent",
      value: 10,
      minSubtotal: 250,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "coupon_frete",
      code: "FRETEGRATIS",
      type: "free_shipping",
      value: 0,
      minSubtotal: 700,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

function defaultVisualSettings() {
  return {
    primaryColor: "#123c2d",
    accentColor: "#c9a227",
    dangerColor: "#9f2a2a",
    heroImage: "assets/hero-cutelaria.png",
    buttonRadius: 8,
    cardRadius: 8,
    storeLayout: "premium",
    announcementText: "Frete gratis em pedidos selecionados e atendimento pelo WhatsApp.",
    customCss: "",
  };
}

async function seedData() {
  const adminHash = await hashPassword("admin123");
  return {
    settings: {
      ...defaultVisualSettings(),
      siteName: "Facas Brazão",
      heroEyebrow: "Cutelaria artesanal brasileira",
      tagline:
        "Facas para churrasco, cozinha e campo com acabamento premium, fio afiado e compra segura.",
      storeTitle: "Facas à venda",
      storeSubtitle: "Escolha sua lâmina, adicione ao carrinho e fale com a loja sempre que precisar.",
      clientAreaTitle: "Entrar na Facas Brazão",
      clientAreaText: "Conta, cadastro e pedidos em uma janela rápida.",
      adminAreaTitle: "Gerenciar Facas Brazão",
      adminAreaText:
        "Entre como administrador para cadastrar produtos, editar estoque, acompanhar pedidos, clientes e relatórios.",
      footerTitle: "Facas Brazão",
      footerText: "Cutelaria artesanal para churrasco, cozinha e campo.",
      footerAddress: "Atendimento online para todo o Brasil",
      footerHours: "Segunda a sábado, das 9h às 18h",
      footerDocument: "Compra permitida somente para maiores de 18 anos.",
      seoTitle: "Facas Brazão | Facas artesanais e cutelaria",
      seoDescription: "Facas artesanais para churrasco, cozinha e campo com compra online, suporte pelo WhatsApp e acabamento premium.",
      shippingPolicy: "Enviamos para todo o Brasil. O prazo varia conforme CEP, disponibilidade em estoque e forma de envio combinada.",
      exchangePolicy: "Trocas por defeito de fabricação podem ser solicitadas em até 7 dias após o recebimento, com análise da peça.",
      warrantyPolicy: "Garantia contra defeitos de fabricação. Mau uso, quedas, oxidação por falta de cuidado e afiação inadequada não são cobertos.",
      legalPolicy: "Venda exclusiva para maiores de 18 anos. O comprador é responsável por cumprir as regras locais de transporte, guarda e uso.",
      carePolicy: "Após o uso, lave manualmente, seque bem e aplique uma fina camada de óleo em lâminas de aço carbono.",
      whatsappProductMessage: "Olá, tenho interesse na faca {produto} da Facas Brazão. Pode me passar mais detalhes?",
      whatsappCheckoutMessage: "Olá, estou fechando um pedido no site da Facas Brazão e quero tirar uma dúvida antes de pagar.",
      whatsappSupportMessage: "Olá, vim pelo site da Facas Brazão e quero atendimento.",
      whatsapp: "(11) 99999-0000",
      pixKey: "pix@facasbrazao.com",
      shippingFee: 25,
      freeShippingFrom: 700,
      shippingRules: [
        { name: "Grande Sao Paulo", prefixes: ["0"], fee: 18 },
        { name: "Interior de SP", prefixes: ["1"], fee: 24 },
        { name: "Sudeste", prefixes: ["2", "3"], fee: 32 },
        { name: "Sul e Centro-Oeste", prefixes: ["7", "8", "9"], fee: 39 },
        { name: "Norte e Nordeste", prefixes: ["4", "5", "6"], fee: 49 },
      ],
      publicUrl: "",
      paymentProvider: "Mercado Pago",
      minAgeNotice:
        "Venda condicionada a maiores de 18 anos e ao cumprimento das regras locais.",
    },
    products: [
      {
        id: "chef-8",
        name: "Chef 8 Pol. Forjada",
        category: "cozinha",
        price: 389,
        stock: 7,
        badge: "Mais vendida",
        image: "assets/prod-chef.png",
        steel: "Aço 1070",
        size: "20 cm",
        handleMaterial: "Madeira estabilizada",
        weight: "210 g",
        bladeLength: "20 cm",
        totalLength: "33 cm",
        sheath: "Bainha sob encomenda",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 2 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Lavar à mão, secar imediatamente e lubrificar quando necessário.",
        description: "Equilíbrio firme para mise en place, cortes longos e uso diário.",
        active: true,
        featured: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: "santoku",
        name: "Santoku Raiz",
        category: "cozinha",
        price: 429,
        stock: 4,
        badge: "Corte fino",
        image: "assets/prod-santoku.png",
        steel: "Aço inox",
        size: "18 cm",
        handleMaterial: "Madeira nobre selada",
        weight: "195 g",
        bladeLength: "18 cm",
        totalLength: "31 cm",
        sheath: "Não acompanha bainha",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 2 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Evite lava-louças e seque bem antes de guardar.",
        description: "Perfil versátil para legumes, carnes magras e fatias precisas.",
        active: true,
        featured: 2,
        createdAt: new Date().toISOString(),
      },
      {
        id: "brisket",
        name: "Churrasco Brisket",
        category: "churrasco",
        price: 459,
        stock: 3,
        badge: "Pronta entrega",
        image: "assets/prod-brisket.png",
        steel: "Aço carbono",
        size: "25 cm",
        handleMaterial: "Madeira resinada",
        weight: "260 g",
        bladeLength: "25 cm",
        totalLength: "39 cm",
        sheath: "Bainha opcional",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 2 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Secar imediatamente após o uso e aplicar óleo mineral.",
        description: "Lâmina alongada para brisket, costela, picanha e assados.",
        active: true,
        featured: 3,
        createdAt: new Date().toISOString(),
      },
      {
        id: "campo",
        name: "Campo Integral",
        category: "campo",
        price: 349,
        stock: 5,
        badge: "Bainha inclusa",
        image: "assets/prod-campo.png",
        steel: "Full tang",
        size: "16 cm",
        handleMaterial: "Micarta texturizada",
        weight: "240 g",
        bladeLength: "16 cm",
        totalLength: "29 cm",
        sheath: "Acompanha bainha",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 3 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Limpar e secar antes de guardar na bainha.",
        description: "Modelo robusto para acampamento, pesca e trabalho rural.",
        active: true,
        featured: 4,
        createdAt: new Date().toISOString(),
      },
      {
        id: "kit-brasa",
        name: "Kit Brazão 3 Peças",
        category: "kits",
        price: 899,
        stock: 2,
        badge: "Presente",
        image: "assets/prod-kit.png",
        steel: "Aço misto",
        size: "3 peças",
        handleMaterial: "Madeiras selecionadas",
        weight: "Kit completo",
        bladeLength: "12 cm, 20 cm e 25 cm",
        totalLength: "Estojo com 3 peças",
        sheath: "Estojo de madeira incluso",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 3 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Guardar seco no estojo e evitar contato prolongado com umidade.",
        description: "Chef, trinchante e utilitária em estojo de madeira.",
        active: true,
        featured: 5,
        createdAt: new Date().toISOString(),
      },
      {
        id: "utilitaria",
        name: "Utilitária Curta",
        category: "campo",
        price: 279,
        stock: 8,
        badge: "Compacta",
        image: "assets/prod-utilitaria.png",
        steel: "Aço 5160",
        size: "12 cm",
        handleMaterial: "Madeira compacta",
        weight: "155 g",
        bladeLength: "12 cm",
        totalLength: "24 cm",
        sheath: "Bainha sob encomenda",
        productionTime: "Pronta entrega",
        shippingTime: "Envio em até 2 dias úteis",
        warranty: "Garantia contra defeito de fabricação",
        care: "Manter seca e afiar com pedra adequada.",
        description: "Leve, rápida e fácil de transportar no dia a dia.",
        active: true,
        featured: 6,
        createdAt: new Date().toISOString(),
      },
    ],
    coupons: defaultCoupons(),
    reviews: [],
    users: [
      {
        id: "admin",
        role: "admin",
        name: "Administrador",
        email: "admin@facasbrazao.com",
        phone: "",
        passwordHash: adminHash,
        createdAt: new Date().toISOString(),
      },
    ],
    orders: [],
    cashEntries: [],
    cashClosings: [],
    activityLogs: [],
  };
}

async function readStore() {
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    const store = JSON.parse(raw);
    store.settings ||= {};
    Object.entries(defaultVisualSettings()).forEach(([key, value]) => {
      store.settings[key] ??= value;
    });
    store.settings.siteName ||= "Facas Brazão";
    store.settings.heroEyebrow ||= "Cutelaria artesanal brasileira";
    store.settings.tagline ||= "Facas para churrasco, cozinha e campo com acabamento premium, fio afiado e compra segura.";
    store.settings.storeTitle ||= "Facas à venda";
    store.settings.storeSubtitle ||= "Escolha sua lâmina, adicione ao carrinho e fale com a loja sempre que precisar.";
    store.settings.clientAreaTitle ||= "Entrar na Facas Brazão";
    store.settings.clientAreaText ||= "Conta, cadastro e pedidos em uma janela rápida.";
    store.settings.adminAreaTitle ||= "Gerenciar Facas Brazão";
    store.settings.adminAreaText ||=
      "Entre como administrador para cadastrar produtos, editar estoque, acompanhar pedidos, clientes e relatórios.";
    store.settings.footerTitle ||= "Facas Brazão";
    store.settings.footerText ||= "Cutelaria artesanal para churrasco, cozinha e campo.";
    store.settings.footerAddress ||= "Atendimento online para todo o Brasil";
    store.settings.footerHours ||= "Segunda a sábado, das 9h às 18h";
    store.settings.footerDocument ||= "Compra permitida somente para maiores de 18 anos.";
    store.settings.seoTitle ||= "Facas Brazão | Facas artesanais e cutelaria";
    store.settings.seoDescription ||=
      "Facas artesanais para churrasco, cozinha e campo com compra online, suporte pelo WhatsApp e acabamento premium.";
    store.settings.shippingPolicy ||=
      "Enviamos para todo o Brasil. O prazo varia conforme CEP, disponibilidade em estoque e forma de envio combinada.";
    store.settings.exchangePolicy ||=
      "Trocas por defeito de fabricação podem ser solicitadas em até 7 dias após o recebimento, com análise da peça.";
    store.settings.warrantyPolicy ||=
      "Garantia contra defeitos de fabricação. Mau uso, quedas, oxidação por falta de cuidado e afiação inadequada não são cobertos.";
    store.settings.legalPolicy ||=
      "Venda exclusiva para maiores de 18 anos. O comprador é responsável por cumprir as regras locais de transporte, guarda e uso.";
    store.settings.carePolicy ||=
      "Após o uso, lave manualmente, seque bem e aplique uma fina camada de óleo em lâminas de aço carbono.";
    store.settings.whatsappProductMessage ||=
      "Olá, tenho interesse na faca {produto} da Facas Brazão. Pode me passar mais detalhes?";
    store.settings.whatsappCheckoutMessage ||=
      "Olá, estou fechando um pedido no site da Facas Brazão e quero tirar uma dúvida antes de pagar.";
    store.settings.whatsappSupportMessage ||= "Olá, vim pelo site da Facas Brazão e quero atendimento.";
    store.settings.paymentProvider ||= "Mercado Pago";
    store.settings.publicUrl ||= "";
    store.settings.shippingFee = Number(store.settings.shippingFee ?? 25);
    store.settings.freeShippingFrom = Number(store.settings.freeShippingFrom ?? 700);
    store.settings.shippingRules ||= [
      { name: "Grande Sao Paulo", prefixes: ["0"], fee: 18 },
      { name: "Interior de SP", prefixes: ["1"], fee: 24 },
      { name: "Sudeste", prefixes: ["2", "3"], fee: 32 },
      { name: "Sul e Centro-Oeste", prefixes: ["7", "8", "9"], fee: 39 },
      { name: "Norte e Nordeste", prefixes: ["4", "5", "6"], fee: 49 },
    ];
    store.products ||= [];
    store.products.forEach(applyProductDefaults);
    if (!Array.isArray(store.coupons)) store.coupons = defaultCoupons();
    store.reviews ||= [];
    store.users ||= [];
    store.orders ||= [];
    store.orders.forEach((order) => {
      order.timeline ||= [
        {
          status: order.status || "Recebido",
          note: "Pedido registrado.",
          at: order.createdAt || new Date().toISOString(),
          by: order.customerId || "",
        },
      ];
    });
    store.cashEntries ||= [];
    store.cashClosings ||= [];
    store.activityLogs ||= [];
    return store;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.mkdir(dataDir, { recursive: true });
    const store = await seedData();
    await writeStore(store);
    return store;
  }
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true });
  const tmp = `${dataFile}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
  await fs.rename(tmp, dataFile);
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeGallery(product = {}) {
  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : String(product.gallery || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
  const image = String(product.image || "").trim();
  return [...new Set([image, ...gallery].filter(Boolean))];
}

function applyProductDefaults(product = {}) {
  product.slug ||= slugify(product.name || product.id);
  product.sku ||= String(product.id || product.slug || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
  product.cost = Number(product.cost || 0);
  product.minStock = Number.parseInt(product.minStock, 10);
  if (!Number.isInteger(product.minStock) || product.minStock < 0) product.minStock = 3;
  product.gallery = normalizeGallery(product);
  product.handleMaterial ||= product.category === "campo" ? "Micarta ou madeira estabilizada" : "Madeira selecionada";
  product.weight ||= "Sob consulta";
  product.bladeLength ||= product.size || "Sob consulta";
  product.totalLength ||= "Sob consulta";
  product.sheath ||= product.category === "kits" ? "Estojo incluso" : "Bainha sob encomenda";
  product.productionTime ||= product.stock > 0 ? "Pronta entrega" : "Sob encomenda";
  product.shippingTime ||= "Envio em até 3 dias úteis";
  product.warranty ||= "Garantia contra defeito de fabricação";
  product.care ||= "Lavar à mão, secar bem e guardar em local seco.";
  return product;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readRawBody(req, maxSize = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxSize) throw new Error("Payload muito grande.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseBody(req) {
  const rawBuffer = await readRawBody(req);
  if (!rawBuffer.length) return {};
  const raw = rawBuffer.toString("utf-8");
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return JSON.parse(raw || "{}");
}

function parseMultipart(buffer, boundary) {
  const boundaryText = `--${boundary}`;
  const parts = buffer.toString("binary").split(boundaryText);
  const parsed = [];

  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const rawHeaders = part.slice(0, headerEnd);
    let body = part.slice(headerEnd + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    if (body.endsWith("--")) body = body.slice(0, -2);

    const name = /name="([^"]+)"/.exec(rawHeaders)?.[1] || "";
    const filename = /filename="([^"]*)"/.exec(rawHeaders)?.[1] || "";
    const contentType = /Content-Type:\s*([^\r\n]+)/i.exec(rawHeaders)?.[1] || "application/octet-stream";

    parsed.push({
      name,
      filename,
      contentType,
      data: Buffer.from(body, "binary"),
    });
  }

  return parsed;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function setSessionCookie(token) {
  return `fb_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

function clearSessionCookie() {
  return "fb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function mercadoPagoToken() {
  return runtimeProcess?.env?.MERCADO_PAGO_ACCESS_TOKEN || "";
}

function publicBaseUrl(req, store) {
  const configured = runtimeProcess?.env?.PUBLIC_SITE_URL || store.settings.publicUrl;
  if (configured) return String(configured).replace(/\/$/, "");
  const host = req.headers.host || "127.0.0.1:5500";
  return `http://${host}`;
}

function absoluteUrl(req, store, maybeRelativePath) {
  if (!maybeRelativePath) return undefined;
  if (/^https?:\/\//i.test(maybeRelativePath)) return maybeRelativePath;
  return `${publicBaseUrl(req, store)}${maybeRelativePath.startsWith("/") ? "" : "/"}${maybeRelativePath}`;
}

function mapMercadoPagoStatus(status) {
  if (status === "approved" || status === "authorized") return "Pago";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(status)) return "Pagamento recusado";
  return "Aguardando pagamento";
}

async function createMercadoPagoPreference(req, store, order) {
  const token = mercadoPagoToken();
  if (!token) {
    throw new Error("Mercado Pago ainda não está configurado. Defina MERCADO_PAGO_ACCESS_TOKEN no ambiente do servidor.");
  }

  const baseUrl = publicBaseUrl(req, store);
  const items = order.items.map((item) => ({
    id: item.productId,
    title: item.name,
    quantity: item.quantity,
    unit_price: Number(item.price),
    currency_id: "BRL",
    picture_url: absoluteUrl(req, store, store.products.find((product) => product.id === item.productId)?.image),
  }));

  if (order.shipping > 0) {
    items.push({
      id: "frete",
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping),
      currency_id: "BRL",
    });
  }

  const body = {
    items,
    payer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: { number: order.customerPhone || undefined },
    },
    external_reference: order.id,
    notification_url: `${baseUrl}/api/payments/mercadopago/webhook`,
    back_urls: {
      success: `${baseUrl}/?payment=success&order=${encodeURIComponent(order.id)}#loja`,
      pending: `${baseUrl}/?payment=pending&order=${encodeURIComponent(order.id)}#loja`,
      failure: `${baseUrl}/?payment=failure&order=${encodeURIComponent(order.id)}#loja`,
    },
    auto_return: "approved",
    statement_descriptor: "FACAS BRAZAO",
    metadata: {
      order_id: order.id,
      customer_id: order.customerId,
    },
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Não foi possível criar o pagamento no Mercado Pago.");
  }
  return payload;
}

async function getMercadoPagoPayment(paymentId) {
  const token = mercadoPagoToken();
  if (!token) throw new Error("Mercado Pago não configurado.");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Não foi possível consultar o pagamento.");
  }
  return payload;
}

async function syncMercadoPagoPayment(store, paymentId) {
  const payment = await getMercadoPagoPayment(paymentId);
  const orderId = payment.external_reference || payment.metadata?.order_id;
  const order = store.orders.find((item) => item.id === orderId);
  if (!order) return { payment, order: null };

  order.payment ||= {};
  order.payment.provider = "Mercado Pago";
  order.payment.paymentId = String(payment.id);
  order.payment.status = payment.status;
  order.payment.statusDetail = payment.status_detail;
  order.payment.transactionAmount = payment.transaction_amount;
  order.payment.lastSyncedAt = new Date().toISOString();
  if (payment.date_approved) order.payment.paidAt = payment.date_approved;
  order.status = mapMercadoPagoStatus(payment.status);
  order.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { payment, order };
}

async function getSessionUser(req, store) {
  const token = parseCookies(req).fb_session;
  const userId = token ? sessions.get(token) : null;
  return userId ? store.users.find((user) => user.id === userId) : null;
}

function requireUser(user, res) {
  if (!user) {
    sendError(res, 401, "Faça login para continuar.");
    return false;
  }
  return true;
}

function requireAdmin(user, res) {
  if (!user || user.role !== "admin") {
    sendError(res, 403, "Acesso permitido apenas para administrador.");
    return false;
  }
  return true;
}

function summarizeCustomers(store) {
  return store.users
    .filter((user) => user.role === "customer")
    .map((user) => {
      const orders = store.orders.filter((order) => order.customerId === user.id);
      const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        createdAt: user.createdAt,
        orders: orders.length,
        totalSpent,
        lastOrderAt: orders.at(-1)?.createdAt || "",
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

function summarizeStore(store) {
  const orders = store.orders;
  const paidOrders = orders.filter(isPaidOrder);
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const profit = paidOrders.reduce((sum, order) => sum + orderProfit(order), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((order) => String(order.createdAt || "").startsWith(today));
  const pendingOrders = orders.filter((order) =>
    ["Recebido", "Aguardando pagamento", "Pago", "Em produção", "Pronto para envio"].includes(order.status),
  );
  const soldItems = paidOrders.flatMap((order) => order.items);
  const topProducts = Object.values(
    soldItems.reduce((acc, item) => {
      acc[item.productId] ||= { productId: item.productId, name: item.name, quantity: 0, revenue: 0 };
      acc[item.productId].quantity += item.quantity;
      acc[item.productId].revenue += item.price * item.quantity;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const lowStock = store.products.filter((product) => product.active && product.stock <= Number(product.minStock || 3));
  const pendingReviews = store.reviews.filter((review) => review.status === "pending").length;
  const cash = summarizeCash(store);

  return {
    revenue,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    todayRevenue: todayOrders.filter(isPaidOrder).reduce((sum, order) => sum + Number(order.total || 0), 0),
    todayOrders: todayOrders.length,
    pendingOrders: pendingOrders.length,
    cashBalance: cash.summary.balance,
    orders: orders.length,
    customers: store.users.filter((user) => user.role === "customer").length,
    products: store.products.length,
    pendingReviews,
    lowStock,
    topProducts,
  };
}

function isPaidOrder(order) {
  return ["Pago", "Em produção", "Pronto para envio", "Enviado", "Entregue"].includes(order.status);
}

function orderCost(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.quantity || 0), 0);
}

function orderProfit(order) {
  return Number(order.total || 0) - Number(order.shipping || 0) - orderCost(order);
}

function groupByDay(orders) {
  return Object.values(
    orders.reduce((acc, order) => {
      const day = String(order.createdAt || "").slice(0, 10) || "Sem data";
      acc[day] ||= { day, orders: 0, revenue: 0, items: 0 };
      acc[day].orders += 1;
      acc[day].revenue += Number(order.total || 0);
      acc[day].items += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.day.localeCompare(a.day));
}

function summarizeReports(store) {
  const orders = store.orders || [];
  const paidOrders = orders.filter(isPaidOrder);
  const paidItems = paidOrders.flatMap((order) => order.items || []);
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const cost = paidOrders.reduce((sum, order) => sum + orderCost(order), 0);
  const profit = paidOrders.reduce((sum, order) => sum + orderProfit(order), 0);
  const averageTicket = paidOrders.length ? revenue / paidOrders.length : 0;
  const byStatus = Object.values(
    orders.reduce((acc, order) => {
      const status = order.status || "Sem status";
      acc[status] ||= { status, orders: 0, revenue: 0 };
      acc[status].orders += 1;
      acc[status].revenue += Number(order.total || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.orders - a.orders);
  const byPayment = Object.values(
    orders.reduce((acc, order) => {
      const method = order.paymentMethod || "Sem pagamento";
      acc[method] ||= { method, orders: 0, revenue: 0 };
      acc[method].orders += 1;
      acc[method].revenue += Number(order.total || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue);
  const products = Object.values(
    paidItems.reduce((acc, item) => {
      acc[item.productId] ||= { productId: item.productId, name: item.name, quantity: 0, revenue: 0, cost: 0, profit: 0 };
      acc[item.productId].quantity += Number(item.quantity || 0);
      acc[item.productId].revenue += Number(item.price || 0) * Number(item.quantity || 0);
      acc[item.productId].cost += Number(item.cost || 0) * Number(item.quantity || 0);
      acc[item.productId].profit = acc[item.productId].revenue - acc[item.productId].cost;
      return acc;
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue);
  const stock = (store.products || [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: Number(product.stock || 0),
      active: product.active !== false,
      estimatedValue: Number(product.stock || 0) * Number(product.price || 0),
      estimatedCost: Number(product.stock || 0) * Number(product.cost || 0),
      minStock: Number(product.minStock || 3),
    }))
    .sort((a, b) => a.stock - b.stock);
  const reviews = {
    total: (store.reviews || []).length,
    pending: (store.reviews || []).filter((review) => review.status === "pending").length,
    approved: (store.reviews || []).filter((review) => review.status === "approved").length,
    rejected: (store.reviews || []).filter((review) => review.status === "rejected").length,
  };
  return {
    overview: {
      revenue,
      cost,
      profit,
      margin: revenue ? (profit / revenue) * 100 : 0,
      paidOrders: paidOrders.length,
      totalOrders: orders.length,
      averageTicket,
      itemsSold: paidItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      customers: (store.users || []).filter((user) => user.role === "customer").length,
      stockValue: stock.reduce((sum, item) => sum + item.estimatedValue, 0),
      stockCost: stock.reduce((sum, item) => sum + item.estimatedCost, 0),
    },
    byDay: groupByDay(paidOrders).slice(0, 30),
    byStatus,
    byPayment,
    products,
    stock,
    customers: summarizeCustomers(store).slice(0, 20),
    reviews,
  };
}

function summarizeCash(store) {
  const entries = (store.cashEntries || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const closings = (store.cashClosings || []).slice().sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  const paidOrders = (store.orders || []).filter(isPaidOrder);
  const orderIncome = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const manualIncome = entries
    .filter((entry) => entry.type === "entrada")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const manualExpense = entries
    .filter((entry) => entry.type === "saida")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return {
    summary: {
      orderIncome,
      manualIncome,
      manualExpense,
      balance: orderIncome + manualIncome - manualExpense,
      paidOrders: paidOrders.length,
      entries: entries.length,
    },
    entries,
    closings,
    recentOrders: paidOrders.slice().reverse().slice(0, 20),
  };
}

function reviewStats(store, productId) {
  const approved = store.reviews.filter((review) => review.productId === productId && review.status === "approved");
  const count = approved.length;
  const average = count ? approved.reduce((sum, review) => sum + review.rating, 0) / count : 0;
  return {
    count,
    average: Number(average.toFixed(1)),
    reviews: approved
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map((review) => ({
        id: review.id,
        customerName: review.customerName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })),
  };
}

function publicProduct(product, store) {
  const { cost, minStock, ...safeProduct } = product;
  return {
    ...safeProduct,
    reviewStats: reviewStats(store, product.id),
  };
}

function userPurchasedProduct(store, userId, productId) {
  return store.orders.some(
    (order) =>
      order.customerId === userId &&
      order.status !== "Cancelado" &&
      order.items.some((item) => item.productId === productId),
  );
}

function cleanCep(cep = "") {
  return String(cep).replace(/\D/g, "").slice(0, 8);
}

function quoteShipping(store, { cep = "", subtotal = 0 } = {}) {
  const clean = cleanCep(cep);
  const amount = Number(subtotal || 0);
  const freeShippingFrom = Number(store.settings.freeShippingFrom || 0);
  const defaultFee = Number(store.settings.shippingFee || 0);

  if (freeShippingFrom > 0 && amount >= freeShippingFrom) {
    return {
      cep: clean,
      region: "Frete gratis",
      fee: 0,
      freeShipping: true,
      message: "Frete gratis aplicado pelo valor do pedido.",
    };
  }

  const rule = (store.settings.shippingRules || []).find((item) =>
    (item.prefixes || []).some((prefix) => clean.startsWith(String(prefix))),
  );

  return {
    cep: clean,
    region: rule?.name || "Padrao",
    fee: Number(rule?.fee ?? defaultFee),
    freeShipping: false,
    message: clean.length === 8 ? `Frete para ${rule?.name || "regiao padrao"}.` : "Informe o CEP para calcular o frete.",
  };
}

function activeCoupon(store, code = "") {
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return null;
  return store.coupons.find((coupon) => coupon.active && coupon.code === normalized) || null;
}

function applyCoupon(store, { code = "", subtotal = 0, shipping = 0 } = {}) {
  const coupon = activeCoupon(store, code);
  if (!coupon) {
    return {
      coupon: null,
      discount: 0,
      shippingDiscount: 0,
      message: code ? "Cupom invalido ou inativo." : "",
    };
  }

  const minSubtotal = Number(coupon.minSubtotal || 0);
  const amount = Number(subtotal || 0);
  if (amount < minSubtotal) {
    return {
      coupon: null,
      discount: 0,
      shippingDiscount: 0,
      message: `Cupom valido a partir de R$ ${minSubtotal.toFixed(2)}.`,
    };
  }

  let discount = 0;
  let shippingDiscount = 0;
  if (coupon.type === "percent") discount = amount * (Number(coupon.value || 0) / 100);
  if (coupon.type === "fixed") discount = Number(coupon.value || 0);
  if (coupon.type === "free_shipping") shippingDiscount = Number(shipping || 0);
  discount = Math.min(discount, amount);

  return {
    coupon,
    discount,
    shippingDiscount,
    message: `Cupom ${coupon.code} aplicado.`,
  };
}

function publicOrder(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || "",
    status: order.status,
    paymentMethod: order.paymentMethod,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount || 0,
    total: order.total,
    timeline: order.timeline || [],
    coupon: order.coupon
      ? {
          code: order.coupon.code,
          type: order.coupon.type,
        }
      : null,
    delivery: {
      cep: order.cep || "",
      region: order.shippingQuote?.region || "",
    },
    payment: order.payment
      ? {
          provider: order.payment.provider,
          status: order.payment.status,
          paidAt: order.payment.paidAt || "",
        }
      : null,
  };
}

function ordersCsv(store) {
  const rows = [
    [
      "Pedido",
      "Data",
      "Cliente",
      "Email",
      "Telefone",
      "Status",
      "Pagamento",
      "ID Pagamento",
      "CEP",
      "Itens",
      "Subtotal",
      "Frete",
      "Cupom",
      "Desconto",
      "Custo",
      "Lucro",
      "Total",
    ],
    ...store.orders.map((order) => [
      order.id,
      order.createdAt,
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.status,
      order.paymentMethod,
      order.payment?.paymentId || "",
      order.cep || "",
      order.items.map((item) => `${item.quantity}x ${item.name}`).join(" | "),
      order.subtotal,
      order.shipping,
      order.coupon?.code || "",
      order.discount || 0,
      orderCost(order),
      orderProfit(order),
      order.total,
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "").replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(";"),
    )
    .join("\n");
}

function csvFromRows(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "").replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(";"),
    )
    .join("\n");
}

function reportCsv(store, type = "orders") {
  const reports = summarizeReports(store);
  if (type === "products") {
    return csvFromRows([
      ["Produto", "Quantidade vendida", "Faturamento", "Custo", "Lucro"],
      ...reports.products.map((product) => [product.name, product.quantity, product.revenue, product.cost, product.profit]),
    ]);
  }
  if (type === "customers") {
    return csvFromRows([
      ["Cliente", "Email", "Telefone", "Pedidos", "Total gasto", "Ultimo pedido"],
      ...reports.customers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone,
        customer.orders,
        customer.totalSpent,
        customer.lastOrderAt,
      ]),
    ]);
  }
  if (type === "stock") {
    return csvFromRows([
      ["Produto", "Estoque", "Estoque minimo", "Ativo", "Valor estimado", "Custo estimado"],
      ...reports.stock.map((item) => [
        item.name,
        item.stock,
        item.minStock,
        item.active ? "Sim" : "Nao",
        item.estimatedValue,
        item.estimatedCost,
      ]),
    ]);
  }
  if (type === "profit") {
    return csvFromRows([
      ["Pedido", "Data", "Cliente", "Faturamento", "Frete", "Custo", "Lucro"],
      ...store.orders.filter(isPaidOrder).map((order) => [
        order.id,
        order.createdAt,
        order.customerName,
        order.total,
        order.shipping,
        orderCost(order),
        orderProfit(order),
      ]),
    ]);
  }
  if (type === "cash") {
    const cash = summarizeCash(store);
    return csvFromRows([
      ["Tipo", "Data", "Descricao", "Forma", "Valor"],
      ...cash.entries.map((entry) => [entry.type, entry.createdAt, entry.description, entry.method, entry.amount]),
    ]);
  }
  if (type === "days") {
    return csvFromRows([
      ["Dia", "Pedidos pagos", "Itens", "Faturamento"],
      ...reports.byDay.map((day) => [day.day, day.orders, day.items, day.revenue]),
    ]);
  }
  return ordersCsv(store);
}

function cleanProduct(input, current = {}) {
  const price = Number(input.price);
  const cost = Number(input.cost || 0);
  const stock = Number.parseInt(input.stock, 10);
  const minStock = Number.parseInt(input.minStock, 10);
  if (!String(input.name || "").trim()) throw new Error("Informe o nome do produto.");
  if (!String(input.category || "").trim()) throw new Error("Informe a categoria.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Preço inválido.");
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Custo invalido.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Estoque inválido.");

  const name = String(input.name).trim();
  const idBase = current.id || slugify(name) || createId("prod");
  return applyProductDefaults({
    ...current,
    name,
    slug: slugify(input.slug || current.slug || name),
    sku: String(input.sku || current.sku || idBase).trim(),
    category: String(input.category).trim(),
    price,
    cost,
    stock,
    minStock: Number.isInteger(minStock) && minStock >= 0 ? minStock : current.minStock || 3,
    badge: String(input.badge || "").trim(),
    image: String(input.image || "assets/prod-chef.png").trim(),
    gallery: normalizeGallery({
      image: String(input.image || current.image || "assets/prod-chef.png").trim(),
      gallery: input.gallery || current.gallery || [],
    }),
    steel: String(input.steel || "").trim(),
    size: String(input.size || "").trim(),
    handleMaterial: String(input.handleMaterial || "").trim(),
    weight: String(input.weight || "").trim(),
    bladeLength: String(input.bladeLength || "").trim(),
    totalLength: String(input.totalLength || "").trim(),
    sheath: String(input.sheath || "").trim(),
    productionTime: String(input.productionTime || "").trim(),
    shippingTime: String(input.shippingTime || "").trim(),
    warranty: String(input.warranty || "").trim(),
    care: String(input.care || "").trim(),
    description: String(input.description || "").trim(),
    active: Boolean(input.active),
    featured: Number.parseInt(input.featured, 10) || current.featured || 99,
    updatedAt: new Date().toISOString(),
  });
}

function cleanCoupon(input, current = {}) {
  const code = String(input.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const value = Number(input.value || 0);
  const minSubtotal = Number(input.minSubtotal || 0);
  const type = String(input.type || "percent");

  if (!code) throw new Error("Informe o codigo do cupom.");
  if (!["percent", "fixed", "free_shipping"].includes(type)) throw new Error("Tipo de cupom invalido.");
  if (type !== "free_shipping" && (!Number.isFinite(value) || value <= 0)) throw new Error("Valor do cupom invalido.");
  if (type === "percent" && value > 90) throw new Error("Desconto percentual maximo permitido: 90%.");

  return {
    ...current,
    code,
    type,
    value: type === "free_shipping" ? 0 : value,
    minSubtotal: Number.isFinite(minSubtotal) ? Math.max(0, minSubtotal) : 0,
    active: Boolean(input.active),
    updatedAt: new Date().toISOString(),
  };
}

function logActivity(store, user, action, detail = "") {
  store.activityLogs ||= [];
  store.activityLogs.push({
    id: createId("log"),
    action,
    detail,
    userId: user?.id || "",
    userName: user?.name || "Sistema",
    createdAt: new Date().toISOString(),
  });
  store.activityLogs = store.activityLogs.slice(-500);
}

async function handleApi(req, res, url) {
  const store = await readStore();
  const user = await getSessionUser(req, store);
  const method = req.method || "GET";
  const route = url.pathname;

  if (method === "GET" && route === "/api/bootstrap") {
    sendJson(res, 200, {
      settings: store.settings,
      products: store.products.filter((product) => product.active).map((product) => publicProduct(product, store)),
      user: safeUser(user),
      adminEmail: "admin@facasbrazao.com",
      payment: {
        mercadoPagoConfigured: Boolean(mercadoPagoToken()),
        publicUrl: runtimeProcess?.env?.PUBLIC_SITE_URL || store.settings.publicUrl || "",
      },
    });
    return;
  }

  const publicProductMatch = route.match(/^\/api\/products\/([^/]+)$/);
  if (method === "GET" && publicProductMatch) {
    const key = decodeURIComponent(publicProductMatch[1]);
    const product = store.products.find((item) => item.active && (item.id === key || item.slug === key));
    if (!product) {
      sendError(res, 404, "Produto nao encontrado.");
      return;
    }
    sendJson(res, 200, { product: publicProduct(product, store) });
    return;
  }

  if (method === "POST" && route === "/api/shipping/quote") {
    const body = await parseBody(req);
    const subtotal = Number(body.subtotal || 0);
    const quote = quoteShipping(store, { cep: body.cep, subtotal });
    sendJson(res, 200, { quote });
    return;
  }

  if (method === "POST" && route === "/api/coupons/validate") {
    const body = await parseBody(req);
    const subtotal = Number(body.subtotal || 0);
    const shipping = Number(body.shipping || 0);
    const coupon = applyCoupon(store, { code: body.code, subtotal, shipping });
    sendJson(res, 200, { coupon });
    return;
  }

  if ((method === "POST" || method === "GET") && route === "/api/payments/mercadopago/webhook") {
    let body = {};
    if (method === "POST") {
      try {
        body = await parseBody(req);
      } catch {
        body = {};
      }
    }
    const paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      body?.data?.id ||
      body?.id ||
      body?.resource?.split("/").at(-1);
    const topic = url.searchParams.get("topic") || body?.topic || body?.type || "";
    if (paymentId && String(topic).includes("payment")) {
      try {
        await syncMercadoPagoPayment(store, paymentId);
      } catch (error) {
        console.error("Falha ao sincronizar pagamento Mercado Pago:", error.message);
      }
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && route === "/api/payments/mercadopago/sync") {
    if (!requireUser(user, res)) return;
    const body = await parseBody(req);
    if (!body.paymentId) {
      sendError(res, 400, "Informe o ID do pagamento.");
      return;
    }
    const result = await syncMercadoPagoPayment(store, body.paymentId);
    if (!result.order) {
      sendError(res, 404, "Pedido relacionado ao pagamento não encontrado.");
      return;
    }
    if (user.role !== "admin" && result.order.customerId !== user.id) {
      sendError(res, 403, "Você não tem permissão para consultar este pagamento.");
      return;
    }
    sendJson(res, 200, { order: user.role === "admin" ? result.order : publicOrder(result.order) });
    return;
  }

  if (method === "GET" && route === "/api/me") {
    sendJson(res, 200, { user: safeUser(user) });
    return;
  }

  if (method === "POST" && route === "/api/register") {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    if (!body.name || !email || !body.password) {
      sendError(res, 400, "Preencha nome, e-mail e senha.");
      return;
    }
    if (store.users.some((item) => item.email === email)) {
      sendError(res, 409, "Este e-mail já está cadastrado.");
      return;
    }

    const newUser = {
      id: createId("cli"),
      role: "customer",
      name: String(body.name).trim(),
      email,
      phone: String(body.phone || "").trim(),
      passwordHash: await hashPassword(body.password),
      createdAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    await writeStore(store);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, newUser.id);
    sendJson(res, 201, { user: safeUser(newUser) }, { "Set-Cookie": setSessionCookie(token) });
    return;
  }

  if (method === "POST" && route === "/api/login") {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const found = store.users.find((item) => item.email === email);
    if (!found || !(await verifyPassword(body.password, found.passwordHash))) {
      sendError(res, 401, "E-mail ou senha inválidos.");
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, found.id);
    sendJson(res, 200, { user: safeUser(found) }, { "Set-Cookie": setSessionCookie(token) });
    return;
  }

  if (method === "POST" && route === "/api/logout") {
    const token = parseCookies(req).fb_session;
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  if (method === "GET" && route === "/api/my/orders") {
    if (!requireUser(user, res)) return;
    const orders =
      user.role === "admin" ? store.orders : store.orders.filter((order) => order.customerId === user.id);
    sendJson(res, 200, { orders: orders.slice().reverse().map((order) => (user.role === "admin" ? order : publicOrder(order))) });
    return;
  }

  if (method === "POST" && route === "/api/reviews") {
    if (!requireUser(user, res)) return;
    const body = await parseBody(req);
    const product = store.products.find((item) => item.id === body.productId && item.active);
    const rating = Number.parseInt(body.rating, 10);
    const comment = String(body.comment || "").trim();

    if (!product) {
      sendError(res, 404, "Produto nao encontrado.");
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendError(res, 400, "Informe uma nota de 1 a 5.");
      return;
    }
    if (comment.length < 8) {
      sendError(res, 400, "Escreva um comentario com pelo menos 8 caracteres.");
      return;
    }
    if (!userPurchasedProduct(store, user.id, product.id)) {
      sendError(res, 403, "Voce so pode avaliar produtos que comprou.");
      return;
    }

    const existing = store.reviews.find((review) => review.customerId === user.id && review.productId === product.id);
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.status = "pending";
      existing.updatedAt = new Date().toISOString();
      await writeStore(store);
      sendJson(res, 200, { review: existing });
      return;
    }

    const review = {
      id: createId("rev"),
      productId: product.id,
      productName: product.name,
      customerId: user.id,
      customerName: user.name,
      rating,
      comment,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    store.reviews.push(review);
    await writeStore(store);
    sendJson(res, 201, { review });
    return;
  }

  if (method === "POST" && route === "/api/orders") {
    const body = await parseBody(req);
    let orderUser = user;
    if (!orderUser) {
      const email = normalizeEmail(body.customerEmail);
      const name = String(body.customerName || "").trim();
      if (!name || !email) {
        sendError(res, 400, "Informe nome e e-mail para comprar sem cadastro.");
        return;
      }
      orderUser = store.users.find((item) => item.email === email);
      if (!orderUser) {
        orderUser = {
          id: createId("guest"),
          role: "customer",
          guest: true,
          name,
          email,
          phone: String(body.customerPhone || "").trim(),
          passwordHash: await hashPassword(crypto.randomBytes(18).toString("hex")),
          createdAt: new Date().toISOString(),
        };
        store.users.push(orderUser);
      } else {
        orderUser.phone ||= String(body.customerPhone || "").trim();
      }
    }
    if (!body.ageCheck) {
      sendError(res, 400, "Confirme a maioridade para concluir a compra.");
      return;
    }
    if (!String(body.address || "").trim()) {
      sendError(res, 400, "Informe o endereço de entrega.");
      return;
    }
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    if (!requestedItems.length) {
      sendError(res, 400, "O carrinho está vazio.");
      return;
    }

    const items = [];
    for (const requested of requestedItems) {
      const product = store.products.find((item) => item.id === requested.productId && item.active);
      const quantity = Number.parseInt(requested.quantity, 10);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) {
        sendError(res, 400, "Produto inválido no carrinho.");
        return;
      }
      if (product.stock < quantity) {
        sendError(res, 409, `Estoque insuficiente para ${product.name}.`);
        return;
      }
      items.push({
        productId: product.id,
        sku: product.sku || "",
        name: product.name,
        price: product.price,
        cost: Number(product.cost || 0),
        quantity,
      });
    }

    for (const item of items) {
      const product = store.products.find((productItem) => productItem.id === item.productId);
      product.stock -= item.quantity;
      product.updatedAt = new Date().toISOString();
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingQuote = quoteShipping(store, { cep: body.cep, subtotal });
    const couponResult = applyCoupon(store, {
      code: body.couponCode,
      subtotal,
      shipping: shippingQuote.fee,
    });
    if (body.couponCode && !couponResult.coupon) {
      sendError(res, 400, couponResult.message || "Cupom invalido.");
      return;
    }
    const shipping = Math.max(0, shippingQuote.fee - couponResult.shippingDiscount);
    const discount = Number(couponResult.discount || 0);
    const wantsMercadoPago = String(body.paymentMethod || "").toLowerCase().includes("mercado");
    const order = {
      id: createId("PED").toUpperCase(),
      customerId: orderUser.id,
      customerName: orderUser.name,
      customerEmail: orderUser.email,
      customerPhone: orderUser.phone || String(body.customerPhone || "").trim(),
      address: String(body.address).trim(),
      cep: cleanCep(body.cep),
      paymentMethod: String(body.paymentMethod || "Combinar"),
      notes: String(body.notes || "").trim(),
      items,
      subtotal,
      shipping,
      shippingQuote,
      coupon: couponResult.coupon
        ? {
            id: couponResult.coupon.id,
            code: couponResult.coupon.code,
            type: couponResult.coupon.type,
          }
        : null,
      discount: discount + Number(couponResult.shippingDiscount || 0),
      total: Math.max(0, subtotal - discount + shipping),
      status: wantsMercadoPago ? "Aguardando pagamento" : "Recebido",
      timeline: [
        {
          status: wantsMercadoPago ? "Aguardando pagamento" : "Recebido",
          note: wantsMercadoPago ? "Pedido criado aguardando pagamento." : "Pedido recebido pela loja.",
          at: new Date().toISOString(),
          by: orderUser.id,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    let payment = null;
    if (wantsMercadoPago) {
      try {
        payment = await createMercadoPagoPreference(req, store, order);
      } catch (error) {
        sendError(res, 400, error.message);
        return;
      }
      order.payment = {
        provider: "Mercado Pago",
        preferenceId: payment.id,
        initPoint: payment.init_point,
        sandboxInitPoint: payment.sandbox_init_point,
        status: "preference_created",
        publicUrlWarning: !/^https:\/\//i.test(publicBaseUrl(req, store))
          ? "Configure PUBLIC_SITE_URL ou URL pública HTTPS no admin para receber webhooks em produção."
          : "",
      };
    }

    store.orders.push(order);
    await writeStore(store);
    sendJson(res, 201, {
      order: publicOrder(order),
      payment: payment
        ? {
            provider: "Mercado Pago",
            preferenceId: payment.id,
            redirectUrl: payment.init_point || payment.sandbox_init_point,
            sandboxRedirectUrl: payment.sandbox_init_point,
          }
        : null,
    });
    return;
  }

  if (route.startsWith("/api/admin/")) {
    if (!requireAdmin(user, res)) return;

    if (method === "GET" && route === "/api/admin/summary") {
      sendJson(res, 200, { summary: summarizeStore(store) });
      return;
    }

    if (method === "GET" && route === "/api/admin/reports") {
      sendJson(res, 200, { reports: summarizeReports(store) });
      return;
    }

    if (method === "GET" && route === "/api/admin/cash") {
      sendJson(res, 200, { cash: summarizeCash(store) });
      return;
    }

    if (method === "GET" && route === "/api/admin/logs") {
      sendJson(res, 200, {
        logs: (store.activityLogs || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100),
      });
      return;
    }

    if (method === "GET" && route === "/api/admin/backup") {
      sendJson(res, 200, {
        exportedAt: new Date().toISOString(),
        site: store.settings.siteName || "Facas Brazão",
        data: store,
      }, {
        "Content-Disposition": "attachment; filename=backup-facas-brazao.json",
      });
      return;
    }

    if (method === "POST" && route === "/api/admin/cash/close") {
      const body = await parseBody(req);
      const cash = summarizeCash(store);
      const closing = {
        id: createId("close"),
        period: String(body.period || new Date().toISOString().slice(0, 10)).trim(),
        openingBalance: Number(body.openingBalance || 0),
        expectedBalance: Number(cash.summary.balance || 0),
        countedBalance: Number(body.countedBalance || cash.summary.balance || 0),
        difference: Number(body.countedBalance || cash.summary.balance || 0) - Number(cash.summary.balance || 0),
        notes: String(body.notes || "").trim(),
        closedBy: user.id,
        closedAt: new Date().toISOString(),
      };
      store.cashClosings ||= [];
      store.cashClosings.push(closing);
      logActivity(store, user, "Fechamento de caixa", `Periodo ${closing.period}`);
      await writeStore(store);
      sendJson(res, 201, { closing, cash: summarizeCash(store) });
      return;
    }

    if (method === "POST" && route === "/api/admin/cash") {
      const body = await parseBody(req);
      const amount = Number(body.amount || 0);
      const type = String(body.type || "entrada");
      if (!["entrada", "saida"].includes(type)) {
        sendError(res, 400, "Tipo de lançamento inválido.");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        sendError(res, 400, "Informe um valor válido para o caixa.");
        return;
      }
      const entry = {
        id: createId("cx"),
        type,
        amount,
        method: String(body.method || "PIX").trim(),
        description: String(body.description || "").trim() || (type === "entrada" ? "Entrada manual" : "Saída manual"),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      };
      store.cashEntries ||= [];
      store.cashEntries.push(entry);
      logActivity(store, user, type === "entrada" ? "Entrada no caixa" : "Saida no caixa", entry.description);
      await writeStore(store);
      sendJson(res, 201, { entry, cash: summarizeCash(store) });
      return;
    }

    if (method === "PUT" && route === "/api/admin/password") {
      const body = await parseBody(req);
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 6) {
        sendError(res, 400, "A nova senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        sendError(res, 400, "Senha atual incorreta.");
        return;
      }
      const adminUser = store.users.find((item) => item.id === user.id);
      adminUser.passwordHash = await hashPassword(newPassword);
      adminUser.updatedAt = new Date().toISOString();
      logActivity(store, user, "Senha do admin alterada", adminUser.email);
      await writeStore(store);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && route === "/api/admin/upload-image") {
      const contentType = req.headers["content-type"] || "";
      const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
      if (!boundary) {
        sendError(res, 400, "Envie a imagem como multipart/form-data.");
        return;
      }
      const body = await readRawBody(req, 8_000_000);
      const file = parseMultipart(body, boundary).find((part) => part.name === "image" && part.filename);
      if (!file) {
        sendError(res, 400, "Arquivo de imagem não encontrado.");
        return;
      }
      const allowed = new Map([
        ["image/png", ".png"],
        ["image/jpeg", ".jpg"],
        ["image/webp", ".webp"],
        ["image/gif", ".gif"],
      ]);
      const ext = allowed.get(file.contentType);
      if (!ext) {
        sendError(res, 400, "Use PNG, JPG, WEBP ou GIF.");
        return;
      }
      await fs.mkdir(path.join(uploadsDir, "products"), { recursive: true });
      const filename = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}${ext}`;
      const diskPath = path.join(uploadsDir, "products", filename);
      await fs.writeFile(diskPath, file.data);
      sendJson(res, 201, { path: `uploads/products/${filename}` });
      return;
    }

    if (method === "GET" && route === "/api/admin/products") {
      sendJson(res, 200, { products: store.products });
      return;
    }

    if (method === "GET" && route === "/api/admin/coupons") {
      sendJson(res, 200, { coupons: store.coupons });
      return;
    }

    if (method === "GET" && route === "/api/admin/reviews") {
      sendJson(res, 200, {
        reviews: store.reviews.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      });
      return;
    }

    const reviewMatch = route.match(/^\/api\/admin\/reviews\/([^/]+)$/);
    if (reviewMatch && method === "PUT") {
      const body = await parseBody(req);
      const review = store.reviews.find((item) => item.id === reviewMatch[1]);
      if (!review) {
        sendError(res, 404, "Avaliacao nao encontrada.");
        return;
      }
      if (!["pending", "approved", "rejected"].includes(String(body.status))) {
        sendError(res, 400, "Status de avaliacao invalido.");
        return;
      }
      review.status = String(body.status);
      review.updatedAt = new Date().toISOString();
      logActivity(store, user, "Avaliacao moderada", `${review.productName}: ${review.status}`);
      await writeStore(store);
      sendJson(res, 200, { review });
      return;
    }

    if (method === "POST" && route === "/api/admin/coupons") {
      const body = await parseBody(req);
      const coupon = cleanCoupon(body, {
        id: createId("cup"),
        createdAt: new Date().toISOString(),
      });
      if (store.coupons.some((item) => item.code === coupon.code)) {
        sendError(res, 409, "Ja existe um cupom com esse codigo.");
        return;
      }
      store.coupons.push(coupon);
      logActivity(store, user, "Cupom criado", coupon.code);
      await writeStore(store);
      sendJson(res, 201, { coupon });
      return;
    }

    const couponMatch = route.match(/^\/api\/admin\/coupons\/([^/]+)$/);
    if (couponMatch && method === "PUT") {
      const coupon = store.coupons.find((item) => item.id === couponMatch[1]);
      if (!coupon) {
        sendError(res, 404, "Cupom nao encontrado.");
        return;
      }
      const updated = cleanCoupon(await parseBody(req), coupon);
      if (store.coupons.some((item) => item.id !== coupon.id && item.code === updated.code)) {
        sendError(res, 409, "Ja existe outro cupom com esse codigo.");
        return;
      }
      Object.assign(coupon, updated);
      logActivity(store, user, "Cupom atualizado", coupon.code);
      await writeStore(store);
      sendJson(res, 200, { coupon });
      return;
    }

    if (couponMatch && method === "DELETE") {
      const coupon = store.coupons.find((item) => item.id === couponMatch[1]);
      if (!coupon) {
        sendError(res, 404, "Cupom nao encontrado.");
        return;
      }
      coupon.active = false;
      coupon.updatedAt = new Date().toISOString();
      logActivity(store, user, "Cupom desativado", coupon.code);
      await writeStore(store);
      sendJson(res, 200, { coupon });
      return;
    }

    if (method === "POST" && route === "/api/admin/products") {
      const body = await parseBody(req);
      const product = cleanProduct(body, {
        id: createId("prod"),
        createdAt: new Date().toISOString(),
      });
      store.products.push(product);
      logActivity(store, user, "Produto criado", product.name);
      await writeStore(store);
      sendJson(res, 201, { product });
      return;
    }

    const productMatch = route.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch && method === "PUT") {
      const product = store.products.find((item) => item.id === productMatch[1]);
      if (!product) {
        sendError(res, 404, "Produto não encontrado.");
        return;
      }
      Object.assign(product, cleanProduct(await parseBody(req), product));
      logActivity(store, user, "Produto atualizado", product.name);
      await writeStore(store);
      sendJson(res, 200, { product });
      return;
    }

    if (productMatch && method === "DELETE") {
      const product = store.products.find((item) => item.id === productMatch[1]);
      if (!product) {
        sendError(res, 404, "Produto não encontrado.");
        return;
      }
      product.active = false;
      product.updatedAt = new Date().toISOString();
      logActivity(store, user, "Produto desativado", product.name);
      await writeStore(store);
      sendJson(res, 200, { product });
      return;
    }

    if (method === "GET" && route === "/api/admin/orders") {
      sendJson(res, 200, { orders: store.orders.slice().reverse() });
      return;
    }

    const orderMatch = route.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (orderMatch && method === "PUT") {
      const body = await parseBody(req);
      const order = store.orders.find((item) => item.id === orderMatch[1]);
      if (!order) {
        sendError(res, 404, "Pedido não encontrado.");
        return;
      }
      const nextStatus = String(body.status || order.status);
      if (nextStatus !== order.status) {
        order.timeline ||= [];
        order.timeline.push({
          status: nextStatus,
          note: String(body.note || `Status alterado para ${nextStatus}.`),
          at: new Date().toISOString(),
          by: user.id,
        });
      }
      order.status = nextStatus;
      order.updatedAt = new Date().toISOString();
      logActivity(store, user, "Status do pedido alterado", `${order.id}: ${order.status}`);
      await writeStore(store);
      sendJson(res, 200, { order });
      return;
    }

    if (method === "GET" && route === "/api/admin/customers") {
      sendJson(res, 200, { customers: summarizeCustomers(store) });
      return;
    }

    if (method === "GET" && route === "/api/admin/reports.csv") {
      const type = String(url.searchParams.get("type") || "orders");
      const csv = reportCsv(store, type);
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=relatorio-${type}-facas-brazao.csv`,
      });
      res.end(`\uFEFF${csv}`);
      return;
    }

    if (method === "PUT" && route === "/api/admin/settings") {
      const body = await parseBody(req);
      store.settings = {
        ...store.settings,
        siteName: String(body.siteName || store.settings.siteName || "Facas Brazão").trim(),
        tagline: String(body.tagline || "").trim(),
        heroEyebrow: String(body.heroEyebrow || "").trim(),
        storeTitle: String(body.storeTitle || "").trim(),
        storeSubtitle: String(body.storeSubtitle || "").trim(),
        clientAreaTitle: String(body.clientAreaTitle || "").trim(),
        clientAreaText: String(body.clientAreaText || "").trim(),
        adminAreaTitle: String(body.adminAreaTitle || "").trim(),
        adminAreaText: String(body.adminAreaText || "").trim(),
        footerTitle: String(body.footerTitle || "").trim(),
        footerText: String(body.footerText || "").trim(),
        footerAddress: String(body.footerAddress || "").trim(),
        footerHours: String(body.footerHours || "").trim(),
        footerDocument: String(body.footerDocument || "").trim(),
        seoTitle: String(body.seoTitle || "").trim(),
        seoDescription: String(body.seoDescription || "").trim(),
        shippingPolicy: String(body.shippingPolicy || "").trim(),
        exchangePolicy: String(body.exchangePolicy || "").trim(),
        warrantyPolicy: String(body.warrantyPolicy || "").trim(),
        legalPolicy: String(body.legalPolicy || "").trim(),
        carePolicy: String(body.carePolicy || "").trim(),
        whatsappProductMessage: String(body.whatsappProductMessage || "").trim(),
        whatsappCheckoutMessage: String(body.whatsappCheckoutMessage || "").trim(),
        whatsappSupportMessage: String(body.whatsappSupportMessage || "").trim(),
        whatsapp: String(body.whatsapp || "").trim(),
        pixKey: String(body.pixKey || "").trim(),
        shippingFee: Number(body.shippingFee) || 0,
        freeShippingFrom: Number(body.freeShippingFrom) || 0,
        publicUrl: String(body.publicUrl || "").trim().replace(/\/$/, ""),
        paymentProvider: "Mercado Pago",
        minAgeNotice: String(body.minAgeNotice || "").trim(),
        primaryColor: String(body.primaryColor || store.settings.primaryColor || defaultVisualSettings().primaryColor).trim(),
        accentColor: String(body.accentColor || store.settings.accentColor || defaultVisualSettings().accentColor).trim(),
        dangerColor: String(body.dangerColor || store.settings.dangerColor || defaultVisualSettings().dangerColor).trim(),
        heroImage: String(body.heroImage || store.settings.heroImage || defaultVisualSettings().heroImage).trim(),
        buttonRadius: Number(body.buttonRadius ?? store.settings.buttonRadius ?? defaultVisualSettings().buttonRadius),
        cardRadius: Number(body.cardRadius ?? store.settings.cardRadius ?? defaultVisualSettings().cardRadius),
        storeLayout: String(body.storeLayout || store.settings.storeLayout || defaultVisualSettings().storeLayout).trim(),
        announcementText: String(body.announcementText ?? store.settings.announcementText ?? "").trim(),
        customCss: String(body.customCss ?? store.settings.customCss ?? "").slice(0, 12000),
      };
      logActivity(store, user, "Configuracoes da loja salvas", store.settings.siteName);
      await writeStore(store);
      sendJson(res, 200, { settings: store.settings });
      return;
    }
  }

  sendError(res, 404, "Rota não encontrada.");
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const resolved = path.resolve(__dirname, `.${pathname}`);
  if (!resolved.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(resolved)) || "application/octet-stream",
    });
    res.end(data);
  } catch {
    const index = await fs.readFile(path.join(__dirname, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      await serveStatic(req, res, url);
    } catch (error) {
      console.error(error);
      sendError(res, 500, error.message || "Erro interno do servidor.");
    }
  });
}

export async function startServer({ port = Number(runtimeProcess?.env?.PORT) || 5500, host = runtimeProcess?.env?.HOST || "127.0.0.1" } = {}) {
  await readStore();
  const server = createServer();
  await new Promise((resolve) => server.listen(port, host, resolve));
  return { server, url: `http://${host}:${port}/` };
}

if (runtimeProcess?.argv?.[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer();
  console.log(`Facas Brazão rodando em ${url}`);
  console.log("Admin: admin@facasbrazao.com | Senha inicial: admin123");
}
