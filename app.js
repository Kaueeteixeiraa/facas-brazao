const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const state = {
  settings: {},
  csrfToken: "",
  payment: {
    mercadoPagoConfigured: false,
    publicUrl: "",
  },
  products: [],
  user: null,
  filters: {
    category: "todos",
    search: "",
    sort: "featured",
    maxPrice: "",
    readyOnly: false,
    favoritesOnly: false,
  },
  cart: JSON.parse(localStorage.getItem("facas-brazao-cart") || "{}"),
  favorites: JSON.parse(localStorage.getItem("facas-brazao-favorites") || "[]"),
  checkout: {
    cep: "",
    couponCode: "",
    shipping: null,
    coupon: null,
  },
  selectedProductId: null,
  myOrders: [],
  adminTab: "dashboard",
  adminCollapsed: localStorage.getItem("facas-brazao-admin-collapsed") === "1",
  authMode: "login",
  theme: localStorage.getItem("facas-brazao-theme") || "light",
  editingProductId: null,
  editingCategoryId: null,
  adminSearch: {
    products: "",
    customers: "",
  },
  activeSettingsTab: "store",
  admin: {
    summary: null,
    products: [],
    categories: [],
    orders: [],
    customers: [],
    quotes: [],
    coupons: [],
    reviews: [],
    reports: null,
    cash: null,
    logs: [],
  },
};

const productGrid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const maxPriceInput = document.querySelector("#maxPriceInput");
const readyOnlyInput = document.querySelector("#readyOnlyInput");
const favoritesOnlyInput = document.querySelector("#favoritesOnlyInput");
const cartDrawer = document.querySelector("#cartDrawer");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const cartTotal = document.querySelector("[data-cart-total]");
const checkoutModal = document.querySelector("#checkoutModal");
const productModal = document.querySelector("#productModal");
const authModal = document.querySelector("#authModal");
const checkoutSummary = document.querySelector("[data-checkout-summary]");
const checkoutCustomer = document.querySelector("[data-checkout-customer]");
const productDetail = document.querySelector("[data-product-detail]");
const checkoutStatus = document.querySelector("[data-checkout-status]");
const clientPanel = document.querySelector("[data-auth-panel]");
const adminShell = document.querySelector("[data-admin-shell]");
const reviewShowcase = document.querySelector("[data-review-showcase]");
const toast = document.querySelector("[data-toast]");
const userLabel = document.querySelector("[data-user-label]");

const settingFallbacks = {
  siteName: "Facas Brazão",
  tagline: "Facas para churrasco, cozinha e campo com acabamento premium, fio afiado e compra segura.",
  heroEyebrow: "Cutelaria artesanal brasileira",
  storeTitle: "Facas à venda",
  storeSubtitle: "Escolha sua lâmina, adicione ao carrinho e fale com a loja sempre que precisar.",
  clientAreaTitle: "Entrar na Facas Brazão",
  clientAreaText: "Conta, cadastro e pedidos em uma janela rápida.",
  adminAreaTitle: "Gerenciar Facas Brazão",
  adminAreaText: "Entre como administrador para cadastrar produtos, editar estoque, acompanhar pedidos, clientes e relatórios.",
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeBrazilPhone(value = "") {
  const raw = String(value || "").replace(/\D/g, "");
  if (!raw) return "";
  if (raw.startsWith("55")) return raw;
  return `55${raw}`;
}

function storeWhatsappNumber() {
  return normalizeBrazilPhone(state.settings.whatsapp);
}

function whatsappUrl(message = "Olá, vim pelo site da Facas Brazão e quero tirar uma dúvida.") {
  const phone = storeWhatsappNumber();
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

function settingMessage(key, fallback, replacements = {}) {
  let message = state.settings[key] || settingFallbacks[key] || fallback;
  Object.entries(replacements).forEach(([name, value]) => {
    message = message.replaceAll(`{${name}}`, value);
  });
  return message;
}

function updateWhatsappLinks() {
  document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
    const context = link.dataset.whatsappContext || "default";
    const message =
      context === "checkout"
        ? settingMessage("whatsappCheckoutMessage", settingFallbacks.whatsappCheckoutMessage)
        : settingMessage("whatsappSupportMessage", settingFallbacks.whatsappSupportMessage);
    link.href = whatsappUrl(message);
    link.removeAttribute("target");
    link.rel = "noopener";
  });
}

function applyTheme() {
  const theme = state.theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-label", theme === "dark" ? "Usar tema normal" : "Usar tema escuro");
    button.title = theme === "dark" ? "Tema normal" : "Tema escuro";
  });
  document.querySelectorAll("[data-theme-label]").forEach((label) => {
    label.textContent = theme === "dark" ? "Tema normal" : "Tema escuro";
  });
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("facas-brazao-theme", state.theme);
  applyTheme();
}

let revealObserver;

function observeReveal(root = document) {
  const nodes = [
    ...root.querySelectorAll(
      "main > section, .product-card, .review-card, .policy-strip article, .assurance article, .process-grid article, .category-showcase button, .metric-card, .panel",
    ),
  ].filter((node) => !node.dataset.revealReady);
  if (!nodes.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => {
      node.dataset.revealReady = "1";
      node.classList.add("reveal-item", "is-visible");
    });
    return;
  }

  revealObserver =
    revealObserver ||
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -48px 0px", threshold: 0.12 },
    );

  nodes.forEach((node) => {
    node.dataset.revealReady = "1";
    node.classList.add("reveal-item");
    revealObserver.observe(node);
  });
}

function isAdminPath() {
  return window.location.hash === "#admin" || window.location.pathname.startsWith("/admin");
}

function syncAdminRoute() {
  document.body.classList.toggle("admin-route", isAdminPath());
}

function openProductByKey(key) {
  const product = state.products.find((item) => item.id === key || item.slug === key);
  if (!product) return false;
  openProductDetail(product.id);
  return true;
}

function openProductFromHash(hash = window.location.hash) {
  if (!hash.startsWith("#produto=")) return false;
  return openProductByKey(decodeURIComponent(hash.split("=").slice(1).join("=")));
}

function handlePathRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/produto/")) closeProductDetail();
  if (path === "/") return false;
  const adminTabs = {
    "/admin": "dashboard",
    "/admin/produtos": "products",
    "/admin/pedidos": "orders",
    "/admin/orcamentos": "quotes",
    "/admin/clientes": "customers",
    "/admin/cupons": "coupons",
    "/admin/avaliacoes": "reviews",
    "/admin/configuracoes": "settings",
  };
  if (adminTabs[path]) {
    state.adminTab = adminTabs[path];
    renderAdminShell();
    scrollToSection("#admin", { updateHistory: false });
    return true;
  }
  if (path === "/produtos") return scrollToSection("#loja", { updateHistory: false });
  if (path === "/sob-encomenda") return scrollToSection("#sob-encomenda", { updateHistory: false });
  if (path === "/favoritos") {
    state.filters.favoritesOnly = true;
    if (favoritesOnlyInput) favoritesOnlyInput.checked = true;
    renderProducts();
    return scrollToSection("#loja", { updateHistory: false });
  }
  if (path === "/entrar" || path === "/minha-conta" || path === "/meus-pedidos") {
    openAuthModal("login");
    return true;
  }
  if (path === "/cadastro") {
    openAuthModal("register");
    return true;
  }
  if (path.startsWith("/produto/")) {
    return openProductByKey(decodeURIComponent(path.split("/produto/")[1] || ""));
  }
  return false;
}

function handleHashRoute() {
  syncAdminRoute();
  if (openProductFromHash()) return;
  if (handlePathRoute()) return;
  if (["#loja", "#contato", "#admin", "#processo", "#sob-encomenda"].includes(window.location.hash)) {
    scrollToSection(window.location.hash, { updateHistory: false });
  }
}

function scrollToSection(hash, options = {}) {
  if (!hash || hash === "#") return false;
  const { updateHistory = true } = options;
  if (hash.startsWith("#produto=")) {
    const opened = openProductFromHash(hash);
    if (opened && updateHistory) {
      window.history.pushState({}, "", hash);
    }
    return opened;
  }
  const section = document.querySelector(hash);
  if (!section) return false;
  const offset = 92;
  const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - offset);
  if (updateHistory) window.history.pushState({}, "", hash);
  syncAdminRoute();
  window.scrollTo({ top, behavior: "smooth" });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
  return true;
}

function saveCart() {
  localStorage.setItem("facas-brazao-cart", JSON.stringify(state.cart));
}

function saveFavorites() {
  localStorage.setItem("facas-brazao-favorites", JSON.stringify(state.favorites));
}

async function syncFavoritesWithServer() {
  if (!state.user || state.user.role === "admin") return;
  const payload = await api("/api/my/favorites");
  const merged = [...new Set([...(payload.productIds || []), ...state.favorites])].filter((id) => productById(id));
  state.favorites = merged;
  saveFavorites();
  if (merged.length !== (payload.productIds || []).length) {
    const saved = await api("/api/my/favorites", { method: "PUT", body: { productIds: merged } });
    state.favorites = saved.productIds || merged;
    saveFavorites();
  }
}

async function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
    if (state.user && state.user.role !== "admin") {
      await api(`/api/my/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  } else {
    state.favorites.push(id);
    if (state.user && state.user.role !== "admin") {
      await api(`/api/my/favorites/${encodeURIComponent(id)}`, { method: "POST" });
    }
  }
  saveFavorites();
  renderProducts();
  renderClientPanel();
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = String(options.method || "GET").toUpperCase();
  const csrfHeaders = method === "GET" ? {} : { "X-CSRFToken": state.csrfToken };
  const headers =
    options.body && !isFormData
      ? { "Content-Type": "application/json", ...csrfHeaders, ...(options.headers || {}) }
      : { ...csrfHeaders, ...(options.headers || {}) };
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível concluir a ação.");
  }

  return payload;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function setFormStatus(form, message, isError = false) {
  const status = form.querySelector(".form-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function productById(id) {
  return state.products.find((product) => product.id === id) || state.admin.products.find((product) => product.id === id);
}

function cartLines() {
  return Object.entries(state.cart)
    .map(([productId, quantity]) => {
      const product = productById(productId);
      return product && product.active !== false ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

function cartSubtotal() {
  return cartLines().reduce((total, item) => total + item.price * item.quantity, 0);
}

function currentShippingFee() {
  if (state.checkout.shipping) return Number(state.checkout.shipping.fee || 0);
  return Number(state.settings.shippingFee || 0);
}

function currentDiscount() {
  return Number(state.checkout.coupon?.discount || 0) + Number(state.checkout.coupon?.shippingDiscount || 0);
}

function cartTotalValue() {
  return Math.max(0, cartSubtotal() + currentShippingFee() - currentDiscount());
}

function renderSettings() {
  const siteName = state.settings.siteName || settingFallbacks.siteName;
  const seoTitle = state.settings.seoTitle || `${siteName} | Facas artesanais e cutelaria`;
  const seoDescription = state.settings.seoDescription || settingFallbacks.seoDescription;
  document.title = seoTitle;
  applyVisualSettings();
  document.querySelectorAll('[data-meta="description"], [data-meta="og:description"], [data-meta="twitter:description"]').forEach((node) => {
    node.setAttribute("content", seoDescription);
  });
  document.querySelectorAll('[data-meta="og:title"], [data-meta="twitter:title"]').forEach((node) => {
    node.setAttribute("content", seoTitle);
  });
  document.querySelectorAll("[data-setting]").forEach((node) => {
    const key = node.dataset.setting;
    node.textContent = state.settings[key] || settingFallbacks[key] || "";
  });
  updateWhatsappLinks();
  updateStructuredData();
}

function applyVisualSettings() {
  const root = document.documentElement;
  const visual = {
    primaryColor: state.settings.primaryColor || settingFallbacks.primaryColor,
    accentColor: state.settings.accentColor || settingFallbacks.accentColor,
    dangerColor: state.settings.dangerColor || settingFallbacks.dangerColor,
    heroImage: state.settings.heroImage || settingFallbacks.heroImage,
    buttonRadius: Number(state.settings.buttonRadius ?? settingFallbacks.buttonRadius),
    cardRadius: Number(state.settings.cardRadius ?? settingFallbacks.cardRadius),
  };
  root.style.setProperty("--green", visual.primaryColor);
  root.style.setProperty("--gold", visual.accentColor);
  root.style.setProperty("--red", visual.dangerColor);
  root.style.setProperty("--button-radius", `${visual.buttonRadius}px`);
  root.style.setProperty("--card-radius", `${visual.cardRadius}px`);
  document.body.dataset.storeLayout = state.settings.storeLayout || settingFallbacks.storeLayout;
  document.querySelector(".hero")?.style.setProperty("--hero-image", `url("${visual.heroImage}")`);
  let customStyle = document.querySelector("#admin-custom-css");
  if (!customStyle) {
    customStyle = document.createElement("style");
    customStyle.id = "admin-custom-css";
    document.head.append(customStyle);
  }
  customStyle.textContent = state.settings.customCss || "";
}

function updateStructuredData() {
  let script = document.querySelector("#product-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "product-structured-data";
    document.head.append(script);
  }
  const baseUrl = state.settings.publicUrl || window.location.origin;
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: state.products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: product.name,
        image: (product.gallery?.length ? product.gallery : [product.image]).map((image) =>
          /^https?:\/\//i.test(image) ? image : `${baseUrl}/${image}`.replace(/([^:]\/)\/+/g, "$1"),
        ),
        description: product.description,
        sku: product.sku || product.id,
        brand: { "@type": "Brand", name: state.settings.siteName || settingFallbacks.siteName },
        offers: {
          "@type": "Offer",
          priceCurrency: "BRL",
          price: Number(product.price || 0).toFixed(2),
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${baseUrl}/produto/${encodeURIComponent(product.slug || product.id)}`,
        },
      },
    })),
  });
}

function renderStars(value = 0) {
  const rounded = Math.round(Number(value || 0));
  return Array.from({ length: 5 }, (_, index) => (index < rounded ? "★" : "☆")).join("");
}

function reviewLabel(product) {
  const stats = product.reviewStats || { average: 0, count: 0 };
  if (!stats.count) return "Sem avaliações";
  return `${renderStars(stats.average)} ${stats.average.toFixed(1)} (${stats.count})`;
}

function filteredProducts() {
  const search = state.filters.search.trim().toLowerCase();
  const maxPrice = Number(state.filters.maxPrice || 0);
  const list = state.products.filter((product) => {
    const inCategory = state.filters.category === "todos" || product.category === state.filters.category;
    const inSearch = [product.name, product.description, product.steel, product.category]
      .join(" ")
      .toLowerCase()
      .includes(search);
    const inPrice = !maxPrice || Number(product.price || 0) <= maxPrice;
    const inStock = !state.filters.readyOnly || Number(product.stock || 0) > 0;
    const inFavorites = !state.filters.favoritesOnly || state.favorites.includes(product.id);
    return product.active !== false && inCategory && inSearch && inPrice && inStock && inFavorites;
  });

  return list.sort((a, b) => {
    if (state.filters.sort === "price-asc") return a.price - b.price;
    if (state.filters.sort === "price-desc") return b.price - a.price;
    if (state.filters.sort === "stock") return b.stock - a.stock;
    return (a.featured || 99) - (b.featured || 99);
  });
}

function renderProducts() {
  const visibleProducts = filteredProducts();

  if (!visibleProducts.length) {
    productGrid.innerHTML = `<div class="empty-state">Nenhuma faca encontrada para esse filtro.</div>`;
    return;
  }

  productGrid.innerHTML = visibleProducts
    .map((product) => {
      const quantityInCart = state.cart[product.id] || 0;
      const soldOut = product.stock <= 0;
      const maxed = quantityInCart >= product.stock;
      const favorite = state.favorites.includes(product.id);
      const displayPrice = product.promoPrice || product.price;
      return `
        <article class="product-card">
          <div class="product-media">
            <button class="product-media-link" type="button" data-view-product="${product.id}" aria-label="Ver detalhes de ${escapeHtml(product.name)}">
              <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
            </button>
            <span class="product-badge">${escapeHtml(product.badge || product.category)}</span>
            <button class="favorite-button ${favorite ? "is-active" : ""}" type="button" data-favorite-product="${product.id}" aria-label="${favorite ? "Remover dos favoritos" : "Favoritar produto"}">
              ${favorite ? "♥" : "♡"}
            </button>
          </div>
          <div class="product-body">
            <div class="product-title-row">
              <h3>${escapeHtml(product.name)}</h3>
            </div>
            <span class="product-category">${escapeHtml(product.category)}</span>
            <strong class="product-price">${money.format(displayPrice)}</strong>
            <span class="rating-line">${escapeHtml(reviewLabel(product))}</span>
            <div class="product-actions">
              <span class="stock ${product.stock <= 3 ? "low" : ""}">${product.stock} em estoque</span>
              <div class="inline-actions">
                <button class="mini-button" type="button" data-view-product="${product.id}">Detalhes</button>
                <button class="button button-primary" type="button" data-add-product="${product.id}" ${soldOut || maxed ? "disabled" : ""}>
                  ${soldOut ? "Esgotado" : maxed ? "No carrinho" : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  observeReveal(productGrid);
}

function renderReviewShowcase() {
  if (!reviewShowcase) return;
  const reviews = state.products
    .flatMap((product) =>
      (product.reviewStats?.reviews || []).map((review) => ({
        ...review,
        productName: product.name,
      })),
    )
    .slice(0, 3);

  if (!reviews.length) {
    reviewShowcase.hidden = false;
    reviewShowcase.innerHTML = `
      <div class="section-heading">
        <p class="eyebrow">Clientes</p>
        <h2 id="reviews-title">Avaliações dos clientes</h2>
      </div>
      <div class="review-showcase-grid">
        <article class="review-card">
          <strong>Ainda não há avaliações publicadas.</strong>
          <p>Os comentários dos clientes aparecem aqui após aprovação da loja.</p>
        </article>
      </div>
    `;
    observeReveal(reviewShowcase);
    return;
  }

  reviewShowcase.hidden = false;
  reviewShowcase.innerHTML = `
    <div class="section-heading">
      <p class="eyebrow">Clientes</p>
      <h2 id="reviews-title">Quem comprou aprovou</h2>
      <p>Avaliações reais aparecem após moderação da loja.</p>
    </div>
    <div class="review-showcase-grid">
      ${reviews
        .map(
          (review) => `
            <article class="review-card">
              <header>
                <strong>${escapeHtml(review.customerName)}</strong>
                <span class="rating-line">${renderStars(review.rating)}</span>
              </header>
              <p>${escapeHtml(review.comment)}</p>
              <span class="muted">${escapeHtml(review.productName)}</span>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
  observeReveal(reviewShowcase);
}

function renderCart() {
  const lines = cartLines();
  const totalItems = lines.reduce((total, item) => total + item.quantity, 0);

  cartCount.textContent = totalItems;
  cartTotal.textContent = money.format(cartSubtotal());

  if (!lines.length) {
    cartItems.innerHTML = `<div class="empty-state">Seu carrinho está vazio.</div>`;
    renderProducts();
    return;
  }

  cartItems.innerHTML = lines
    .map(
      (item) => `
        <article class="cart-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${money.format(item.price)} cada</p>
          </div>
          <div class="qty-control" aria-label="Quantidade de ${escapeHtml(item.name)}">
            <button type="button" data-decrease="${item.id}" aria-label="Diminuir quantidade">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-increase="${item.id}" aria-label="Aumentar quantidade">+</button>
          </div>
        </article>
      `,
    )
    .join("");

  renderCheckoutSummary();
  renderProducts();
}

function renderCheckoutSummary() {
  const lines = cartLines();
  const subtotal = cartSubtotal();
  const shippingFee = currentShippingFee();
  const discount = currentDiscount();

  if (!lines.length) {
    checkoutSummary.innerHTML = `<p>Adicione pelo menos um item para fechar o pedido.</p>`;
    return;
  }

  checkoutSummary.innerHTML = [
    ...lines.map(
      (item) => `
        <div class="summary-row">
          <span>${item.quantity}x ${escapeHtml(item.name)}</span>
          <strong>${money.format(item.price * item.quantity)}</strong>
        </div>
      `,
    ),
    `
      <div class="summary-row">
        <span>Subtotal</span>
        <strong>${money.format(subtotal)}</strong>
      </div>
      <div class="summary-row">
        <span>Frete${state.checkout.shipping?.region ? ` (${escapeHtml(state.checkout.shipping.region)})` : ""}</span>
        <strong>${money.format(shippingFee)}</strong>
      </div>
      ${
        state.checkout.coupon?.coupon
          ? `<div class="summary-row discount-row">
              <span>Cupom ${escapeHtml(state.checkout.coupon.coupon.code)}</span>
              <strong>- ${money.format(discount)}</strong>
            </div>`
          : ""
      }
      <div class="summary-row total">
        <span>Total</span>
        <strong>${money.format(cartTotalValue())}</strong>
      </div>
      <a class="whatsapp-inline whatsapp-icon-link" href="${whatsappUrl(settingMessage("whatsappCheckoutMessage", settingFallbacks.whatsappCheckoutMessage))}" rel="noopener" aria-label="Tirar dúvida pelo WhatsApp">
        <span class="whatsapp-mark" aria-hidden="true"></span>
      </a>
      ${
        state.checkout.shipping?.message || state.checkout.coupon?.message
          ? `<p class="summary-note">${escapeHtml([state.checkout.shipping?.message, state.checkout.coupon?.message].filter(Boolean).join(" "))}</p>`
          : ""
      }
    `,
  ].join("");
}

function renderPaymentOptions() {
  const select = document.querySelector('#checkoutForm select[name="paymentMethod"]');
  if (!select) return;
  select.innerHTML = `
    ${state.payment.mercadoPagoConfigured ? `<option value="Mercado Pago">Mercado Pago (PIX, cartão ou boleto)</option>` : ""}
    <option value="PIX manual">PIX manual</option>
    <option value="Combinar">Combinar com a loja</option>
  `;
  select.value = state.payment.mercadoPagoConfigured ? "Mercado Pago" : "PIX manual";
}

function renderCheckoutCustomer() {
  if (!checkoutCustomer) return;
  if (state.user) {
    checkoutCustomer.innerHTML = `
      <div class="checkout-account-note">
        <strong>Comprando como ${escapeHtml(state.user.name)}</strong>
        <span>${escapeHtml(state.user.email)} ${state.user.phone ? `· ${escapeHtml(state.user.phone)}` : ""}</span>
      </div>
    `;
    return;
  }
  checkoutCustomer.innerHTML = `
    <div class="checkout-account-note">
      <strong>Compra rápida</strong>
      <span>Você pode finalizar sem cadastro. Depois, se quiser, cria uma conta para acompanhar os pedidos.</span>
    </div>
    <label>
      <span>Nome completo</span>
      <input name="customerName" type="text" autocomplete="name" required />
    </label>
    <label>
      <span>E-mail</span>
      <input name="customerEmail" type="email" autocomplete="email" required />
    </label>
    <label>
      <span>WhatsApp</span>
      <input name="customerPhone" type="tel" autocomplete="tel" required />
    </label>
  `;
}

async function refreshCheckoutPricing() {
  const subtotal = cartSubtotal();
  if (state.checkout.cep) {
    const payload = await api("/api/shipping/quote", {
      method: "POST",
      body: {
        cep: state.checkout.cep,
        subtotal,
      },
    });
    state.checkout.shipping = payload.quote;
  }

  if (state.checkout.couponCode) {
    const payload = await api("/api/coupons/validate", {
      method: "POST",
      body: {
        code: state.checkout.couponCode,
        subtotal,
        shipping: currentShippingFee(),
      },
    });
    state.checkout.coupon = payload.coupon;
  } else {
    state.checkout.coupon = null;
  }

  renderCheckoutSummary();
}

async function fillAddressFromCep(value) {
  const clean = String(value || "").replace(/\D/g, "");
  const addressInput = document.querySelector('#checkoutForm input[name="address"]');
  if (clean.length !== 8 || !addressInput || addressInput.value.trim()) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await response.json();
    if (!data.erro) {
      addressInput.value = [data.logradouro, data.bairro, data.localidade && `${data.localidade} - ${data.uf}`].filter(Boolean).join(", ");
    }
  } catch (_error) {
    // CEP continua manual se o servico externo estiver indisponivel.
  }
}

function clearCheckoutAdjustments() {
  state.checkout.cep = "";
  state.checkout.couponCode = "";
  state.checkout.shipping = null;
  state.checkout.coupon = null;
}

function setQuantity(id, quantity) {
  const product = productById(id);
  if (!product) return;

  if (quantity <= 0) {
    delete state.cart[id];
  } else {
    state.cart[id] = Math.min(quantity, product.stock);
  }

  saveCart();
  renderCart();
}

function addToCart(id) {
  const product = productById(id);
  const currentQuantity = state.cart[id] || 0;

  if (!product || currentQuantity >= product.stock) {
    showToast("Estoque máximo desse item no carrinho.");
    return;
  }

  state.cart[id] = currentQuantity + 1;
  saveCart();
  renderCart();
  showToast(`${product.name} adicionado ao carrinho.`);
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function openCheckout() {
  if (!cartLines().length) {
    showToast("Adicione um produto antes de finalizar.");
    return;
  }

  renderPaymentOptions();
  renderCheckoutCustomer();
  renderCheckoutSummary();
  checkoutStatus.textContent = "";
  checkoutStatus.classList.remove("error");
  checkoutModal.classList.add("is-open");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCheckout() {
  checkoutModal.classList.remove("is-open");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function stockStatus(product) {
  if (product.stock <= 0) return { label: "Sob encomenda", className: "danger" };
  if (product.stock <= 3) return { label: `Ultimas ${product.stock} unidades`, className: "warn" };
  return { label: "Pronta entrega", className: "good" };
}

function openProductDetail(id) {
  const product = productById(id);
  if (!product || !productDetail || !productModal) return;
  state.selectedProductId = id;
  const soldOut = product.stock <= 0;
  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const displayPrice = product.promoPrice || product.price;
  const hasPromo = Number(product.promoPrice || 0) > 0 && Number(product.promoPrice) < Number(product.price);
  const stock = stockStatus(product);
  productDetail.innerHTML = `
    <div class="product-detail-layout">
      <div class="product-detail-media">
        <img src="${escapeHtml(gallery[0])}" alt="${escapeHtml(product.name)}" data-product-main-image />
        <div class="gallery-strip">
          ${gallery
            .map(
              (image, index) => `
                <button class="${index === 0 ? "is-active" : ""}" type="button" data-gallery-image="${escapeHtml(image)}" aria-label="Ver foto de ${escapeHtml(product.name)}">
                  <img src="${escapeHtml(image)}" alt="" loading="lazy" />
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="product-detail-copy">
        <p class="eyebrow">${escapeHtml(product.badge || product.category)}</p>
        <h2 id="product-detail-title">${escapeHtml(product.name)}</h2>
        <div class="product-detail-status">
          <span class="status-pill ${stock.className}">${escapeHtml(stock.label)}</span>
          <span class="rating-line detail-rating">${escapeHtml(reviewLabel(product))}</span>
        </div>
        <div class="price-stack">
          <strong class="product-detail-price">${money.format(displayPrice)}</strong>
          ${hasPromo ? `<span>${money.format(product.price)}</span>` : ""}
        </div>
        <p class="product-detail-lead">${escapeHtml(product.description)}</p>
        <div class="product-spec-grid">
          <article><span>Categoria</span><strong>${escapeHtml(product.category)}</strong></article>
          <article><span>Estoque</span><strong>${product.stock} unidade${product.stock === 1 ? "" : "s"}</strong></article>
          <article><span>Aco</span><strong>${escapeHtml(product.steel || "Selecionado")}</strong></article>
          <article><span>Cabo</span><strong>${escapeHtml(product.handleMaterial || "Sob consulta")}</strong></article>
          <article><span>Lâmina</span><strong>${escapeHtml(product.bladeLength || product.size || "Sob consulta")}</strong></article>
          <article><span>Total</span><strong>${escapeHtml(product.totalLength || "Sob consulta")}</strong></article>
          <article><span>Bainha</span><strong>${escapeHtml(product.sheath || "Sob consulta")}</strong></article>
          <article><span>Prazo</span><strong>${escapeHtml(product.productionTime || "Pronta entrega")}</strong></article>
          <article><span>Envio</span><strong>${escapeHtml(product.shippingTime || "Envio sob consulta")}</strong></article>
          <article><span>SKU</span><strong>${escapeHtml(product.sku || product.id)}</strong></article>
        </div>
        <div class="notice">
          <strong>Cuidados:</strong> ${escapeHtml(product.care || state.settings.carePolicy || settingFallbacks.carePolicy)}
          <br /><strong>Garantia:</strong> ${escapeHtml(product.warranty || state.settings.warrantyPolicy || settingFallbacks.warrantyPolicy)}
        </div>
        <div class="action-row product-detail-actions">
          <button class="button button-primary" type="button" data-add-product="${product.id}" ${soldOut ? "disabled" : ""}>
            ${soldOut ? "Esgotado" : "Adicionar ao carrinho"}
          </button>
          <button class="button button-secondary" type="button" data-favorite-product="${product.id}">
            ${state.favorites.includes(product.id) ? "Remover favorito" : "Favoritar"}
          </button>
          <a class="button button-whatsapp whatsapp-icon-link" href="${whatsappUrl(settingMessage("whatsappProductMessage", settingFallbacks.whatsappProductMessage, { produto: product.name }))}" rel="noopener" aria-label="Perguntar sobre ${escapeHtml(product.name)} no WhatsApp">
            <span class="whatsapp-mark" aria-hidden="true"></span>
            WhatsApp
          </a>
        </div>
        <div class="review-list">
          <h3>Avaliações</h3>
          ${renderProductReviews(product)}
        </div>
      </div>
    </div>
  `;
  productModal.classList.add("is-open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductDetail() {
  if (!productModal) return;
  productModal.classList.remove("is-open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openAuthModal(mode = state.user ? "account" : "login") {
  if (!authModal) return;
  if (!state.user && mode !== "account") {
    state.authMode = mode === "register" ? "register" : "login";
  }
  renderClientPanel();
  authModal.classList.add("is-open");
  authModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("is-open");
  authModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function focusableNodes(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (node) => !node.disabled && node.offsetParent !== null,
  );
}

function openAdminOverlay({ title, body, type = "modal", size = "" }) {
  closeAdminOverlay();
  openAdminOverlay.lastFocus = document.activeElement;
  const layer = document.createElement("div");
  layer.className = `modal-backdrop admin-overlay is-open admin-${type}-layer ${size}`.trim();
  layer.dataset.adminOverlay = type;
  layer.setAttribute("aria-hidden", "false");
  layer.innerHTML = `
    <section class="admin-${type}" role="dialog" aria-modal="true" aria-labelledby="admin-overlay-title">
      <div class="admin-overlay-head">
        <h3 id="admin-overlay-title">${escapeHtml(title)}</h3>
        <button class="icon-button" type="button" data-close-admin-overlay aria-label="Fechar">×</button>
      </div>
      <div class="admin-overlay-body">${body}</div>
    </section>
  `;
  document.body.append(layer);
  document.body.classList.add(type === "drawer" ? "drawer-open" : "modal-open");
  const first = focusableNodes(layer)[0];
  first?.focus();
}

function closeAdminOverlay() {
  const layer = document.querySelector("[data-admin-overlay]");
  if (!layer) return;
  const type = layer.dataset.adminOverlay;
  layer.remove();
  document.body.classList.remove(type === "drawer" ? "drawer-open" : "modal-open");
  openAdminOverlay.lastFocus?.focus?.();
}

function renderProductReviews(product) {
  const reviews = product.reviewStats?.reviews || [];
  if (!reviews.length) {
    return `<div class="empty-state">Ainda não há avaliações aprovadas para esta faca.</div>`;
  }
  return reviews
    .map(
      (review) => `
        <article class="review-card">
          <header>
            <strong>${escapeHtml(review.customerName)}</strong>
            <span class="rating-line">${renderStars(review.rating)}</span>
          </header>
          <p>${escapeHtml(review.comment)}</p>
        </article>
      `,
    )
    .join("");
}

function renderFavoritesList() {
  const products = state.favorites.map((id) => productById(id)).filter(Boolean);
  if (!products.length) return `<div class="empty-state">Nenhum favorito salvo ainda.</div>`;
  return `
    <div class="order-list">
      ${products
        .map(
          (product) => `
            <article class="order-card">
              <header>
                <div>
                  <h4>${escapeHtml(product.name)}</h4>
                  <p>${escapeHtml(product.category)} • ${money.format(product.promoPrice || product.price)}</p>
                </div>
                <button class="mini-button danger" type="button" data-favorite-product="${product.id}">Remover</button>
              </header>
              <div class="inline-actions">
                <button class="mini-button" type="button" data-view-product="${product.id}">Detalhes</button>
                <button class="mini-button" type="button" data-add-product="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>Adicionar</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderClientPanel() {
  userLabel.textContent = state.user ? state.user.name.split(" ")[0] : "Entrar";
  if (!clientPanel) return;

  if (!state.user) {
    clientPanel.innerHTML = `
      <div class="auth-portal">
        <button class="auth-card ${state.authMode === "login" ? "is-active" : ""}" type="button" data-auth-mode="login">
          <span>Já tenho conta</span>
          <strong>Entrar como cliente</strong>
          <small>Acompanhe pedidos, avaliações e compras salvas.</small>
        </button>
        <button class="auth-card ${state.authMode === "register" ? "is-active" : ""}" type="button" data-auth-mode="register">
          <span>Novo cliente</span>
          <strong>Criar cadastro</strong>
          <small>Abra sua conta para comprar e ver seus pedidos.</small>
        </button>
      </div>

      <div class="panel auth-panel">
        <div class="panel-head">
          <div>
            <h3>${state.authMode === "register" ? "Criar cadastro de cliente" : "Entrar na área do cliente"}</h3>
            <p>${state.authMode === "register" ? "Crie sua conta para comprar com mais agilidade." : "Use seu e-mail e senha para acessar seus pedidos."}</p>
          </div>
        </div>
        ${
          state.authMode === "register"
            ? `<form class="auth-grid" data-register-form>
                <label>
                  <span>Nome completo</span>
                  <input name="name" type="text" required />
                </label>
                <label>
                  <span>WhatsApp</span>
                  <input name="phone" type="tel" required />
                </label>
                <label>
                  <span>E-mail</span>
                  <input name="email" type="email" required />
                </label>
                <label>
                  <span>Senha</span>
                  <input name="password" type="password" minlength="6" required />
                </label>
                <button class="button button-primary wide-field" type="submit">Cadastrar cliente</button>
                <p class="form-status wide-field" role="status"></p>
              </form>`
            : `<form class="auth-grid" data-login-form data-login-scope="customer">
                <label>
                  <span>E-mail</span>
                  <input name="email" type="email" placeholder="seu@email.com" required />
                </label>
                <label>
                  <span>Senha</span>
                  <input name="password" type="password" required />
                </label>
                <button class="button button-primary wide-field" type="submit">Entrar na minha conta</button>
                <p class="form-status wide-field" role="status"></p>
              </form>`
        }
      </div>
    `;
    return;
  }

  clientPanel.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Olá, ${escapeHtml(state.user.name)}</h3>
          <p>${escapeHtml(state.user.email)} ${state.user.role === "admin" ? "· Administrador" : "· Cliente"}</p>
        </div>
        <button class="button button-secondary" type="button" data-logout>Sair</button>
      </div>
      <div class="action-row">
        <button class="button button-primary" type="button" data-open-cart>Ver carrinho</button>
        ${state.user.role === "admin" ? `<a class="button button-secondary" href="#admin">Abrir admin</a>` : ""}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Favoritos</h3>
          <p>Produtos salvos na sua conta.</p>
        </div>
      </div>
      ${renderFavoritesList()}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Meus pedidos</h3>
          <p>Pedidos feitos com este cadastro.</p>
        </div>
      </div>
      ${renderOrdersList(state.myOrders)}
    </div>
  `;
}

function renderOrdersList(orders) {
  if (!orders?.length) {
    return `<div class="empty-state">Nenhum pedido encontrado ainda.</div>`;
  }

  return `
    <div class="order-list">
      ${orders
        .map(
          (order) => `
            <article class="order-card">
              <header>
                <div>
                  <h4>${escapeHtml(order.id)}</h4>
                  <p>${dateTime.format(new Date(order.createdAt))}</p>
                </div>
                <span class="status-pill ${order.status === "Recebido" ? "warn" : "good"}">${escapeHtml(order.status)}</span>
              </header>
              <p>${order.items.map((item) => `${item.quantity}x ${escapeHtml(item.name)}`).join(" · ")}</p>
              <strong>${money.format(order.total)}</strong>
              ${
                ["Aguardando pagamento", "Rejeitado", "Cancelado"].includes(order.status) && /mercado/i.test(`${order.paymentMethod || ""} ${(order.payment || {}).provider || ""}`)
                  ? `<button class="mini-button" type="button" data-pay-order="${order.id}">Pagar novamente</button>`
                  : ""
              }
              ${renderOrderTimeline(order)}
              ${renderReviewFormsForOrder(order)}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderOrderTimeline(order) {
  const timeline = order.timeline || [];
  if (!timeline.length) return "";
  return `
    <ol class="order-timeline">
      ${timeline
        .map(
          (event) => `
            <li>
              <strong>${escapeHtml(event.status)}</strong>
              <span>${event.at ? dateTime.format(new Date(event.at)) : ""}</span>
              ${event.note ? `<p>${escapeHtml(event.note)}</p>` : ""}
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function renderReviewFormsForOrder(order) {
  if (!state.user || state.user.role !== "customer" || order.status === "Cancelado") return "";
  return `
    <details class="review-details">
      <summary>Avaliar facas deste pedido</summary>
      <div class="review-form-list">
        ${order.items
          .map(
            (item) => `
              <form class="review-form" data-review-form>
                <input type="hidden" name="productId" value="${escapeHtml(item.productId)}" />
                <strong>${escapeHtml(item.name)}</strong>
                <label>
                  <span>Nota</span>
                  <select name="rating" required>
                    <option value="5">5 estrelas</option>
                    <option value="4">4 estrelas</option>
                    <option value="3">3 estrelas</option>
                    <option value="2">2 estrelas</option>
                    <option value="1">1 estrela</option>
                  </select>
                </label>
                <label>
                  <span>Comentário</span>
                  <textarea name="comment" rows="3" placeholder="Fale sobre o fio, acabamento, entrega..." required></textarea>
                </label>
                <button class="mini-button" type="submit">Enviar avaliação</button>
                <p class="form-status" role="status"></p>
              </form>
            `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderAdminShell() {
  if (!state.user || state.user.role !== "admin") {
    adminShell.innerHTML = `
      <div class="admin-login-layout">
        <div class="panel admin-gate">
          <div class="panel-head">
            <div>
              <h3>Entrar como administrador</h3>
              <p>Esta área é separada da conta do cliente e libera o controle completo da loja.</p>
            </div>
          </div>
          <form class="auth-grid" data-login-form data-login-scope="admin">
            <label>
              <span>E-mail do admin</span>
              <input name="email" type="email" value="admin@facasbrazao.com" required />
            </label>
            <label>
              <span>Senha</span>
              <input name="password" type="password" placeholder="admin123" required />
            </label>
            <button class="button button-primary wide-field" type="submit">Abrir painel administrativo</button>
            <p class="form-status wide-field" role="status"></p>
          </form>
        </div>
        <div class="panel admin-permissions">
          <h3>O admin consegue mexer em</h3>
          <div class="permission-list">
            <span>Produtos, fotos, preços e estoque</span>
            <span>Pedidos, status e contato por WhatsApp</span>
            <span>Clientes, relatórios e CSV</span>
            <span>Cupons, avaliações e textos do site</span>
            <span>WhatsApp, PIX, frete e pagamento</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const tabs = [
    ["dashboard", "Resumo"],
    ["products", "Produtos"],
    ["categories", "Categorias"],
    ["stock", "Estoque"],
    ["coupons", "Cupons"],
    ["reviews", "Avaliações"],
    ["orders", "Pedidos"],
    ["quotes", "Orçamentos"],
    ["customers", "Clientes"],
    ["reports", "Relatórios"],
    ["cash", "Caixa"],
    ["editor", "Editor visual"],
    ["logs", "Logs"],
    ["settings", "Configurações"],
  ];

  adminShell.innerHTML = `
    <div class="admin-layout ${state.adminCollapsed ? "is-collapsed" : ""}">
      <aside class="admin-sidebar" aria-label="Menu administrativo">
        <button class="mini-button" type="button" data-toggle-admin-nav>${state.adminCollapsed ? "Abrir" : "Recolher"}</button>
        <div class="admin-tabs" role="group" aria-label="Abas do painel admin">
          ${tabs
            .map(
              ([id, label]) => `
                <button class="tab-button ${state.adminTab === id ? "is-active" : ""}" type="button" data-admin-tab="${id}" title="${label}">
                  <span>${label}</span>
                </button>
              `,
            )
            .join("")}
          <button class="tab-button danger" type="button" data-logout><span>Sair</span></button>
        </div>
      </aside>
      <div class="admin-tab-panel">
        ${renderAdminTab()}
      </div>
    </div>
  `;
  observeReveal(adminShell);
}

function renderAdminTab() {
  if (!state.admin.summary) {
    return `<div class="notice">Carregando dados do painel...</div>`;
  }

  if (state.adminTab === "products") return renderAdminProducts();
  if (state.adminTab === "categories") return renderAdminCategories();
  if (state.adminTab === "stock") return renderAdminStock();
  if (state.adminTab === "coupons") return renderAdminCoupons();
  if (state.adminTab === "reviews") return renderAdminReviews();
  if (state.adminTab === "orders") return renderAdminOrders();
  if (state.adminTab === "quotes") return renderAdminQuotes();
  if (state.adminTab === "customers") return renderAdminCustomers();
  if (state.adminTab === "reports") return renderAdminReports();
  if (state.adminTab === "cash") return renderAdminCash();
  if (state.adminTab === "editor") return renderAdminEditor();
  if (state.adminTab === "logs") return renderAdminLogs();
  if (state.adminTab === "settings") return renderAdminSettings();
  return renderAdminDashboard();
}

function renderAdminDashboard() {
  const summary = state.admin.summary;
  return `
    <div class="admin-grid">
      <article class="metric-card">
        <span>Faturamento</span>
        <strong>${money.format(summary.revenue)}</strong>
      </article>
      <article class="metric-card">
        <span>Lucro estimado</span>
        <strong>${money.format(summary.profit || 0)}</strong>
      </article>
      <article class="metric-card">
        <span>Hoje</span>
        <strong>${money.format(summary.todayRevenue || 0)}</strong>
      </article>
      <article class="metric-card">
        <span>Saldo caixa</span>
        <strong>${money.format(summary.cashBalance || 0)}</strong>
      </article>
      <article class="metric-card">
        <span>Pedidos</span>
        <strong>${summary.orders}</strong>
      </article>
      <article class="metric-card">
        <span>Pendentes</span>
        <strong>${summary.pendingOrders || 0}</strong>
      </article>
      <article class="metric-card">
        <span>Clientes</span>
        <strong>${summary.customers}</strong>
      </article>
      <article class="metric-card">
        <span>Produtos</span>
        <strong>${summary.products}</strong>
      </article>
      <article class="metric-card">
        <span>Avaliações pendentes</span>
        <strong>${summary.pendingReviews || 0}</strong>
      </article>
      <article class="metric-card">
        <span>Orçamentos</span>
        <strong>${summary.pendingQuotes || 0}</strong>
      </article>
    </div>

    <div class="panel admin-control-center">
      <div class="panel-head">
        <div>
          <h3>Controle rápido do site</h3>
          <p>Atalhos para editar as áreas principais da Facas Brazão sem sair do painel.</p>
        </div>
      </div>
      <div class="control-actions">
        <button class="mini-button" type="button" data-admin-tab="products">Produtos e fotos</button>
        <button class="mini-button" type="button" data-admin-tab="orders">Pedidos e entregas</button>
        <button class="mini-button" type="button" data-admin-tab="quotes">Orçamentos</button>
        <button class="mini-button" type="button" data-admin-tab="customers">Clientes e relatórios</button>
        <button class="mini-button" type="button" data-admin-tab="reports">Relatórios completos</button>
        <button class="mini-button" type="button" data-admin-tab="cash">Caixa</button>
        <button class="mini-button" type="button" data-admin-tab="editor">Editor visual</button>
        <button class="mini-button" type="button" data-admin-tab="logs">Logs</button>
        <button class="mini-button" type="button" data-admin-tab="coupons">Cupons</button>
        <button class="mini-button" type="button" data-admin-tab="reviews">Avaliações</button>
        <button class="mini-button" type="button" data-admin-tab="settings">Textos, WhatsApp e pagamento</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Produtos com estoque baixo</h3>
          <p>Itens com 3 unidades ou menos.</p>
        </div>
      </div>
      ${
        summary.lowStock.length
          ? `<div class="order-list">${summary.lowStock
              .map(
                (product) => `
                  <article class="order-card">
                    <header>
                      <h4>${escapeHtml(product.name)}</h4>
                      <span class="status-pill danger">${product.stock} em estoque</span>
                    </header>
                  </article>
                `,
              )
              .join("")}</div>`
          : `<div class="empty-state">Nenhum produto em estoque baixo.</div>`
      }
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Mais vendidos</h3>
          <p>Ranking baseado nos pedidos confirmados.</p>
        </div>
      </div>
      ${
        summary.topProducts.length
          ? `<div class="order-list">${summary.topProducts
              .map(
                (product) => `
                  <article class="order-card">
                    <header>
                      <h4>${escapeHtml(product.name)}</h4>
                      <strong>${product.quantity} un.</strong>
                    </header>
                    <p>${money.format(product.revenue)}</p>
                  </article>
                `,
              )
              .join("")}</div>`
          : `<div class="empty-state">Sem vendas registradas ainda.</div>`
      }
    </div>
  `;
}

function adminPageHead(title, subtitle, action = "") {
  return `
    <div class="panel admin-page-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      ${action}
    </div>
  `;
}

function renderAdminProductsList() {
  const search = state.adminSearch.products.toLowerCase();
  const products = state.admin.products.filter((product) =>
    [product.name, product.sku, product.category].join(" ").toLowerCase().includes(search),
  );
  return `
    ${adminPageHead(
      "Produtos",
      `${state.admin.products.length} produto(s), ${state.admin.products.filter((item) => item.active).length} ativo(s).`,
      `<button class="button button-primary" type="button" data-open-product-form>Adicionar produto</button>`,
    )}
    <div class="panel admin-toolbar">
      <label class="search-field">
        <span>Buscar</span>
        <input type="search" value="${escapeHtml(state.adminSearch.products)}" placeholder="Nome, SKU ou categoria" data-admin-product-search />
      </label>
    </div>
    <div class="table-card">
      <table>
        <thead>
          <tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${
            products
              .map(
                (product) => `
                  <tr>
                    <td>
                      <button class="admin-product-preview as-button" type="button" data-view-admin-product="${product.id}">
                        <img src="${escapeHtml(product.image)}" alt="" />
                        <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku || product.steel || "")}</small></span>
                      </button>
                    </td>
                    <td>${escapeHtml(product.category)}</td>
                    <td>${money.format(product.price)}${product.promoPrice ? `<br /><span class="muted">${money.format(product.promoPrice)}</span>` : ""}</td>
                    <td><span class="status-pill ${product.stock <= Number(product.minStock || 3) ? "warn" : "good"}">${product.stock}</span></td>
                    <td><span class="status-pill ${product.active ? "good" : "danger"}">${product.active ? "Ativo" : "Inativo"}</span></td>
                    <td>
                      <div class="inline-actions">
                        <button class="mini-button" type="button" data-view-admin-product="${product.id}">Visualizar</button>
                        <button class="mini-button" type="button" data-edit-product="${product.id}">Editar</button>
                        <button class="mini-button danger" type="button" data-disable-product="${product.id}">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("") || `<tr><td colspan="6">Nenhum produto encontrado.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminProducts() {
  return renderAdminProductsList();
}

function productFormFields(product = {}) {
  return `
    <label>
      <span>Nome</span>
      <input name="name" type="text" value="${escapeHtml(product.name || "")}" required />
    </label>
    <label>
      <span>SKU</span>
      <input name="sku" type="text" value="${escapeHtml(product.sku || "")}" placeholder="CHEF-8-1070" />
    </label>
    <label>
      <span>Slug</span>
      <input name="slug" type="text" value="${escapeHtml(product.slug || "")}" placeholder="chef-8-forjada" />
    </label>
    <label>
      <span>Categoria</span>
      <select name="category" required>
        ${["cozinha", "churrasco", "campo", "kits"]
          .map((category) => `<option value="${category}" ${product.category === category ? "selected" : ""}>${category}</option>`)
          .join("")}
      </select>
    </label>
    <label>
      <span>Preço</span>
      <input name="price" type="number" min="0" step="0.01" value="${product.price ?? ""}" required />
    </label>
    <label>
      <span>Preço promocional</span>
      <input name="promoPrice" type="number" min="0" step="0.01" value="${product.promoPrice ?? 0}" />
    </label>
    <label>
      <span>Custo</span>
      <input name="cost" type="number" min="0" step="0.01" value="${product.cost ?? 0}" />
    </label>
    <label>
      <span>Estoque</span>
      <input name="stock" type="number" min="0" step="1" value="${product.stock ?? 0}" required />
    </label>
    <label>
      <span>Estoque mínimo</span>
      <input name="minStock" type="number" min="0" step="1" value="${product.minStock ?? 3}" />
    </label>
    <label>
      <span>Selo</span>
      <input name="badge" type="text" value="${escapeHtml(product.badge || "")}" />
    </label>
    <label>
      <span>Imagem</span>
      <input name="image" type="text" value="${escapeHtml(product.image || "assets/prod-chef.png")}" />
    </label>
    <label class="wide-field">
      <span>Galeria de fotos</span>
      <textarea name="gallery" rows="3" placeholder="Uma URL por linha">${escapeHtml((product.gallery || []).join("\n"))}</textarea>
    </label>
    <label>
      <span>Enviar foto real</span>
      <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
    </label>
    <label>
      <span>Aço</span>
      <input name="steel" type="text" value="${escapeHtml(product.steel || "")}" />
    </label>
    <label>
      <span>Tamanho</span>
      <input name="size" type="text" value="${escapeHtml(product.size || "")}" />
    </label>
    <label>
      <span>Material do cabo</span>
      <input name="handleMaterial" type="text" value="${escapeHtml(product.handleMaterial || "")}" />
    </label>
    <label>
      <span>Peso</span>
      <input name="weight" type="text" value="${escapeHtml(product.weight || "")}" />
    </label>
    <label>
      <span>Lâmina</span>
      <input name="bladeLength" type="text" value="${escapeHtml(product.bladeLength || "")}" />
    </label>
    <label>
      <span>Comprimento total</span>
      <input name="totalLength" type="text" value="${escapeHtml(product.totalLength || "")}" />
    </label>
    <label>
      <span>Bainha/estojo</span>
      <input name="sheath" type="text" value="${escapeHtml(product.sheath || "")}" />
    </label>
    <label>
      <span>Prazo de produção</span>
      <input name="productionTime" type="text" value="${escapeHtml(product.productionTime || "")}" />
    </label>
    <label>
      <span>Prazo de envio</span>
      <input name="shippingTime" type="text" value="${escapeHtml(product.shippingTime || "")}" />
    </label>
    <label>
      <span>Garantia</span>
      <input name="warranty" type="text" value="${escapeHtml(product.warranty || "")}" />
    </label>
    <label>
      <span>Ordem de destaque</span>
      <input name="featured" type="number" min="1" step="1" value="${product.featured || 99}" />
    </label>
    <label class="checkbox-field">
      <input name="active" type="checkbox" ${product.active !== false ? "checked" : ""} />
      <span>Produto ativo na loja</span>
    </label>
    <label class="wide-field">
      <span>Descrição</span>
      <textarea name="description" rows="3">${escapeHtml(product.description || "")}</textarea>
    </label>
    <label class="wide-field">
      <span>Cuidados de uso</span>
      <textarea name="care" rows="3">${escapeHtml(product.care || "")}</textarea>
    </label>
  `;
}

function openProductForm(id = "") {
  const product = state.admin.products.find((item) => item.id === id) || {};
  state.editingProductId = product.id || null;
  openAdminOverlay({
    title: product.id ? "Editar produto" : "Adicionar produto",
    size: "large",
    body: `
      <form class="form-grid admin-modal-form" data-product-form>
        ${productFormFields(product)}
        <div class="admin-modal-actions wide-field">
          <button class="button button-secondary" type="button" data-close-admin-overlay>Cancelar</button>
          <button class="button button-primary" type="submit">${product.id ? "Salvar alterações" : "Salvar"}</button>
        </div>
        <p class="form-status wide-field" role="status"></p>
      </form>
    `,
  });
}

function openAdminProductView(id) {
  const product = state.admin.products.find((item) => item.id === id);
  if (!product) return;
  const gallery = product.gallery?.length ? product.gallery : [product.image];
  openAdminOverlay({
    title: "Visualizar produto",
    size: "large",
    body: `
      <div class="admin-detail-grid">
        <div>
          <img class="admin-detail-image" src="${escapeHtml(gallery[0])}" alt="${escapeHtml(product.name)}" />
          <div class="gallery-strip">
            ${gallery.map((image) => `<img src="${escapeHtml(image)}" alt="" loading="lazy" />`).join("")}
          </div>
        </div>
        <div class="admin-detail-copy">
          <p class="eyebrow">${escapeHtml(product.category)}</p>
          <h2>${escapeHtml(product.name)}</h2>
          <strong>${money.format(product.price)}</strong>
          ${product.promoPrice ? `<p>Promoção: ${money.format(product.promoPrice)}</p>` : ""}
          <p>${escapeHtml(product.description || "")}</p>
          <div class="product-spec-grid">
            <article><span>Estoque</span><strong>${product.stock}</strong></article>
            <article><span>Situação</span><strong>${product.active ? "Ativo" : "Inativo"}</strong></article>
            <article><span>Aço</span><strong>${escapeHtml(product.steel || "-")}</strong></article>
            <article><span>Cabo</span><strong>${escapeHtml(product.handleMaterial || "-")}</strong></article>
            <article><span>Criado</span><strong>${product.createdAt ? dateTime.format(new Date(product.createdAt)) : "-"}</strong></article>
            <article><span>Atualizado</span><strong>${product.updatedAt ? dateTime.format(new Date(product.updatedAt)) : "-"}</strong></article>
          </div>
          <div class="admin-modal-actions">
            <button class="button button-secondary" type="button" data-close-admin-overlay>Fechar</button>
            <button class="button button-primary" type="button" data-edit-product="${product.id}">Editar</button>
          </div>
        </div>
      </div>
    `,
  });
}

function openDeleteProductConfirm(id) {
  const product = state.admin.products.find((item) => item.id === id);
  if (!product) return;
  openAdminOverlay({
    title: "Excluir produto",
    size: "small",
    body: `
      <p><strong>${escapeHtml(product.name)}</strong></p>
      <p>Esta ação não poderá ser desfeita. O produto será removido da loja pública.</p>
      <div class="admin-modal-actions">
        <button class="button button-secondary" type="button" data-close-admin-overlay>Cancelar</button>
        <button class="button button-danger" type="button" data-confirm-disable-product="${product.id}">Excluir produto</button>
      </div>
    `,
  });
}

function renderAdminCategories() {
  return `
    ${adminPageHead(
      "Categorias",
      "Organize o catálogo e veja quantos produtos existem em cada grupo.",
      `<button class="button button-primary" type="button" data-open-category-form>Nova categoria</button>`,
    )}
    <div class="table-card">
      <table>
        <thead><tr><th>Categoria</th><th>Slug</th><th>Produtos</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${
            state.admin.categories
              .map(
                (category) => `
                  <tr>
                    <td><strong>${escapeHtml(category.name)}</strong></td>
                    <td>${escapeHtml(category.slug)}</td>
                    <td>${category.productCount || 0}</td>
                    <td><span class="status-pill ${category.active ? "good" : "danger"}">${category.active ? "Ativa" : "Inativa"}</span></td>
                    <td>
                      <div class="inline-actions">
                        <button class="mini-button" type="button" data-edit-category="${category.id}">Editar</button>
                        <button class="mini-button danger" type="button" data-delete-category="${category.id}">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("") || `<tr><td colspan="5">Nenhuma categoria cadastrada.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function openCategoryForm(id = "") {
  const category = state.admin.categories.find((item) => item.id === id) || {};
  state.editingCategoryId = category.id || null;
  openAdminOverlay({
    title: category.id ? "Editar categoria" : "Nova categoria",
    size: "small",
    body: `
      <form class="form-grid admin-modal-form" data-category-form>
        <label class="wide-field">
          <span>Nome</span>
          <input name="name" type="text" value="${escapeHtml(category.name || "")}" required />
        </label>
        <label class="wide-field">
          <span>Slug</span>
          <input name="slug" type="text" value="${escapeHtml(category.slug || "")}" ${category.id ? "disabled" : ""} />
        </label>
        <label class="checkbox-field wide-field">
          <input name="active" type="checkbox" ${category.active !== false ? "checked" : ""} />
          <span>Categoria ativa</span>
        </label>
        <div class="admin-modal-actions wide-field">
          <button class="button button-secondary" type="button" data-close-admin-overlay>Cancelar</button>
          <button class="button button-primary" type="submit">Salvar</button>
        </div>
        <p class="form-status wide-field" role="status"></p>
      </form>
    `,
  });
}

function openDeleteCategoryConfirm(id) {
  const category = state.admin.categories.find((item) => item.id === id);
  if (!category) return;
  openAdminOverlay({
    title: "Excluir categoria",
    size: "small",
    body: `
      <p><strong>${escapeHtml(category.name)}</strong></p>
      <p>Confirme somente se não houver produtos vinculados.</p>
      <div class="admin-modal-actions">
        <button class="button button-secondary" type="button" data-close-admin-overlay>Cancelar</button>
        <button class="button button-danger" type="button" data-confirm-delete-category="${category.id}">Excluir categoria</button>
      </div>
    `,
  });
}

function renderAdminStock() {
  const products = state.admin.products.slice().sort((a, b) => a.stock - b.stock);
  return `
    ${adminPageHead("Estoque", "Acompanhe pronta entrega, estoque mínimo e reposição.", "")}
    <div class="table-card">
      <table>
        <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Situação</th><th>Ação</th></tr></thead>
        <tbody>
          ${products
            .map(
              (product) => `
                <tr>
                  <td><strong>${escapeHtml(product.name)}</strong></td>
                  <td>${escapeHtml(product.category)}</td>
                  <td>${product.stock}</td>
                  <td>${product.minStock || 3}</td>
                  <td><span class="status-pill ${product.stock <= Number(product.minStock || 3) ? "warn" : "good"}">${product.stock <= Number(product.minStock || 3) ? "Baixo" : "OK"}</span></td>
                  <td><button class="mini-button" type="button" data-edit-product="${product.id}">Editar estoque</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminCoupons() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Criar cupom</h3>
          <p>Use cupons para campanhas, frete gratis e clientes recorrentes.</p>
        </div>
      </div>
      <form class="form-grid" data-coupon-form>
        <label>
          <span>Codigo</span>
          <input name="code" type="text" placeholder="BRAZAO10" required />
        </label>
        <label>
          <span>Tipo</span>
          <select name="type" required>
            <option value="percent">Percentual</option>
            <option value="fixed">Valor fixo</option>
            <option value="free_shipping">Frete gratis</option>
          </select>
        </label>
        <label>
          <span>Valor</span>
          <input name="value" type="number" min="0" step="0.01" value="10" />
        </label>
        <label>
          <span>Compra minima</span>
          <input name="minSubtotal" type="number" min="0" step="0.01" value="0" />
        </label>
        <label class="checkbox-field wide-field">
          <input name="active" type="checkbox" checked />
          <span>Cupom ativo</span>
        </label>
        <button class="button button-primary wide-field" type="submit">Salvar cupom</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Minimo</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.coupons
            .map(
              (coupon) => `
                <tr>
                  <td><strong>${escapeHtml(coupon.code)}</strong></td>
                  <td>${coupon.type === "percent" ? "Percentual" : coupon.type === "fixed" ? "Valor fixo" : "Frete gratis"}</td>
                  <td>${coupon.type === "percent" ? `${coupon.value}%` : coupon.type === "fixed" ? money.format(coupon.value) : "Frete"}</td>
                  <td>${money.format(coupon.minSubtotal || 0)}</td>
                  <td><span class="status-pill ${coupon.active ? "good" : "danger"}">${coupon.active ? "Ativo" : "Inativo"}</span></td>
                  <td>
                    <div class="inline-actions">
                      <button class="mini-button" type="button" data-toggle-coupon="${coupon.id}" data-coupon-active="${coupon.active ? "0" : "1"}">
                        ${coupon.active ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminReviews() {
  if (!state.admin.reviews.length) {
    return `<div class="empty-state">Nenhuma avaliação recebida ainda.</div>`;
  }

  return `
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Cliente</th>
            <th>Nota</th>
            <th>Comentário</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.reviews
            .map(
              (review) => `
                <tr>
                  <td><strong>${escapeHtml(review.productName)}</strong><br /><span class="muted">${dateTime.format(new Date(review.createdAt))}</span></td>
                  <td>${escapeHtml(review.customerName)}</td>
                  <td><span class="rating-line">${renderStars(review.rating)}</span></td>
                  <td>${escapeHtml(review.comment)}</td>
                  <td><span class="status-pill ${review.status === "approved" ? "good" : review.status === "rejected" ? "danger" : "warn"}">${review.status}</span></td>
                  <td>
                    <div class="inline-actions">
                      <button class="mini-button" type="button" data-review-status="${review.id}" data-status="approved">Aprovar</button>
                      <button class="mini-button danger" type="button" data-review-status="${review.id}" data-status="rejected">Rejeitar</button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function whatsappOrderLink(order) {
  const phone = normalizeBrazilPhone(order.customerPhone);
  const items = order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
  const message = `Olá, ${order.customerName}. Aqui é da Facas Brazão. Sobre o pedido ${order.id}: ${items}. Status atual: ${order.status}. Total: ${money.format(order.total)}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderAdminOrdersList() {
  if (!state.admin.orders.length) return `<div class="empty-state">Nenhum pedido registrado ainda.</div>`;
  return `
    ${adminPageHead(
      "Pedidos",
      "Lista limpa de pedidos. Abra um pedido para ver produtos, cliente, endereço e histórico.",
      `<a class="button button-secondary" href="/api/admin/reports.csv" download>Exportar CSV</a>`,
    )}
    <div class="table-card">
      <table>
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Status</th><th>Data</th><th>Ação</th></tr></thead>
        <tbody>
          ${state.admin.orders
            .map(
              (order) => `
                <tr>
                  <td><button class="link-button" type="button" data-view-order="${order.id}"><strong>${escapeHtml(order.id)}</strong></button></td>
                  <td>${escapeHtml(order.customerName)}<br /><span class="muted">${escapeHtml(order.customerEmail)}</span></td>
                  <td>${money.format(order.total)}<br /><span class="muted">${escapeHtml(order.paymentMethod)}</span></td>
                  <td><span class="status-pill ${order.status === "Cancelado" ? "danger" : order.status === "Pago" ? "good" : "warn"}">${escapeHtml(order.status)}</span></td>
                  <td>${dateTime.format(new Date(order.createdAt))}</td>
                  <td><button class="mini-button" type="button" data-view-order="${order.id}">Abrir</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openOrderDrawer(id) {
  const order = state.admin.orders.find((item) => item.id === id);
  if (!order) return;
  const statuses = ["Novo", "Aguardando pagamento", "Pago", "Em produção", "Em preparação", "Enviado", "Concluído", "Cancelado"];
  openAdminOverlay({
    type: "drawer",
    title: `Pedido ${order.id}`,
    body: `
      <div class="order-drawer-content">
        <div class="admin-detail-section">
          <span class="status-pill warn">${escapeHtml(order.status)}</span>
          <h3>${escapeHtml(order.customerName)}</h3>
          <p>${escapeHtml(order.customerEmail)}<br />${escapeHtml(order.customerPhone || "")}</p>
        </div>
        <label>
          <span>Situação</span>
          <select data-order-status="${escapeHtml(order.id)}">
            ${statuses.map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <div class="admin-detail-section">
          <h4>Produtos</h4>
          ${order.items.map((item) => `<p>${item.quantity}x ${escapeHtml(item.name)} <strong>${money.format(item.price * item.quantity)}</strong></p>`).join("")}
        </div>
        <div class="product-spec-grid">
          <article><span>Subtotal</span><strong>${money.format(order.subtotal)}</strong></article>
          <article><span>Frete</span><strong>${money.format(order.shipping)}</strong></article>
          <article><span>Desconto</span><strong>${money.format(order.discount || 0)}</strong></article>
          <article><span>Total</span><strong>${money.format(order.total)}</strong></article>
        </div>
        <div class="admin-detail-section">
          <h4>Entrega e observações</h4>
          <p>${order.cep ? `CEP ${escapeHtml(order.cep)}<br />` : ""}${escapeHtml(order.address || "")}</p>
          ${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ""}
        </div>
        <div class="admin-detail-section">
          <h4>Histórico</h4>
          ${renderOrderTimeline(order)}
        </div>
        ${String(order.customerPhone || "").replace(/\D/g, "").length >= 10 ? `<a class="button button-secondary" href="${whatsappOrderLink(order)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </div>
    `,
  });
}

function renderAdminOrders() {
  return renderAdminOrdersList();
}

function whatsappQuoteLink(quote) {
  const phone = normalizeBrazilPhone(quote.customerPhone);
  const message = `Olá, ${quote.customerName}. Aqui é da Facas Brazão. Recebemos seu orçamento ${quote.id} para ${quote.knifeType}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderAdminQuotes() {
  if (!state.admin.quotes.length) return `<div class="empty-state">Nenhum orçamento recebido ainda.</div>`;
  return `
    ${adminPageHead("Orçamentos", "Pedidos de faca sob encomenda enviados pela loja.", "")}
    <div class="table-card">
      <table>
        <thead><tr><th>Orçamento</th><th>Cliente</th><th>Faca</th><th>Prazo</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>
          ${state.admin.quotes
            .map(
              (quote) => `
                <tr>
                  <td><button class="link-button" type="button" data-view-quote="${quote.id}"><strong>${escapeHtml(quote.id)}</strong></button><br /><span class="muted">${dateTime.format(new Date(quote.createdAt))}</span></td>
                  <td>${escapeHtml(quote.customerName)}<br /><span class="muted">${escapeHtml(quote.customerPhone)}</span></td>
                  <td>${escapeHtml(quote.knifeType)}<br /><span class="muted">${escapeHtml(quote.budgetRange || "Sem faixa definida")}</span></td>
                  <td>${escapeHtml(quote.desiredDeadline || "-")}</td>
                  <td><span class="status-pill ${quote.status === "Aprovado" ? "good" : quote.status === "Recusado" ? "danger" : "warn"}">${escapeHtml(quote.status)}</span></td>
                  <td><button class="mini-button" type="button" data-view-quote="${quote.id}">Abrir</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openQuoteDrawer(id) {
  const quote = state.admin.quotes.find((item) => item.id === id);
  if (!quote) return;
  const statuses = ["Novo", "Em análise", "Aguardando cliente", "Aprovado", "Recusado", "Convertido em pedido"];
  openAdminOverlay({
    type: "drawer",
    title: `Orçamento ${quote.id}`,
    body: `
      <form class="order-drawer-content" data-quote-update-form data-quote-id="${quote.id}">
        <div class="admin-detail-section">
          <span class="status-pill warn">${escapeHtml(quote.status)}</span>
          <h3>${escapeHtml(quote.customerName)}</h3>
          <p>${escapeHtml(quote.customerEmail || "")}<br />${escapeHtml(quote.customerPhone)}</p>
        </div>
        <div class="admin-detail-section">
          <h4>Pedido</h4>
          <p><strong>${escapeHtml(quote.knifeType)}</strong></p>
          <p>${escapeHtml([quote.mainUse, quote.desiredSize, quote.steelType, quote.handleMaterial].filter(Boolean).join(" • "))}</p>
          ${quote.engraving ? `<p>Gravação: ${escapeHtml(quote.engravingText || "sim")}</p>` : ""}
          ${quote.notes ? `<p>${escapeHtml(quote.notes)}</p>` : ""}
        </div>
        <label>
          <span>Status</span>
          <select name="status">
            ${statuses.map((status) => `<option value="${status}" ${quote.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Valor estimado</span>
          <input name="estimatedValue" type="number" min="0" step="0.01" value="${quote.estimatedValue || ""}" />
        </label>
        <label>
          <span>Prazo estimado</span>
          <input name="estimatedDeadline" type="text" value="${escapeHtml(quote.estimatedDeadline || "")}" />
        </label>
        <label>
          <span>Resposta ao cliente</span>
          <textarea name="adminResponse" rows="4">${escapeHtml(quote.adminResponse || "")}</textarea>
        </label>
        <div class="admin-modal-actions">
          ${String(quote.customerPhone || "").replace(/\D/g, "").length >= 10 ? `<a class="button button-secondary" href="${whatsappQuoteLink(quote)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          <button class="button button-primary" type="submit">Salvar orçamento</button>
        </div>
        <p class="form-status" role="status"></p>
      </form>
    `,
  });
}

function renderAdminCustomersList() {
  const search = state.adminSearch.customers.toLowerCase();
  const customers = state.admin.customers.filter((customer) =>
    [customer.name, customer.email, customer.phone].join(" ").toLowerCase().includes(search),
  );
  if (!state.admin.customers.length) return `<div class="empty-state">Nenhum cliente cadastrado ainda.</div>`;
  return `
    ${adminPageHead("Clientes", "Busque clientes e abra os detalhes para ver histórico de pedidos.", `<a class="button button-secondary" href="/api/admin/reports.csv?type=customers" download>Exportar CSV</a>`)}
    <div class="panel admin-toolbar">
      <label class="search-field">
        <span>Buscar</span>
        <input type="search" value="${escapeHtml(state.adminSearch.customers)}" placeholder="Nome, telefone ou e-mail" data-admin-customer-search />
      </label>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Total comprado</th><th>Ação</th></tr></thead>
        <tbody>
          ${customers
            .map(
              (customer) => `
                <tr>
                  <td><strong>${escapeHtml(customer.name)}</strong><br /><span class="muted">Desde ${dateTime.format(new Date(customer.createdAt))}</span></td>
                  <td>${escapeHtml(customer.email)}<br />${escapeHtml(customer.phone || "")}</td>
                  <td>${customer.orders}</td>
                  <td>${money.format(customer.totalSpent)}</td>
                  <td><button class="mini-button" type="button" data-view-customer="${customer.id}">Abrir</button></td>
                </tr>
              `,
            )
            .join("") || `<tr><td colspan="5">Nenhum cliente encontrado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openCustomerDrawer(id) {
  const customer = state.admin.customers.find((item) => item.id === id);
  if (!customer) return;
  const orders = state.admin.orders.filter((order) => order.customerId === id || order.customerEmail === customer.email);
  openAdminOverlay({
    type: "drawer",
    title: customer.name,
    body: `
      <div class="order-drawer-content">
        <div class="admin-detail-section">
          <h3>${escapeHtml(customer.name)}</h3>
          <p>${escapeHtml(customer.email)}<br />${escapeHtml(customer.phone || "")}</p>
        </div>
        <div class="product-spec-grid">
          <article><span>Pedidos</span><strong>${customer.orders}</strong></article>
          <article><span>Total comprado</span><strong>${money.format(customer.totalSpent)}</strong></article>
          <article><span>Último pedido</span><strong>${customer.lastOrderAt ? dateTime.format(new Date(customer.lastOrderAt)) : "Sem pedidos"}</strong></article>
        </div>
        <div class="admin-detail-section">
          <h4>Pedidos realizados</h4>
          ${
            orders
              .map(
                (order) => `
                  <button class="order-card as-button" type="button" data-view-order="${order.id}">
                    <header><strong>${escapeHtml(order.id)}</strong><span class="status-pill warn">${escapeHtml(order.status)}</span></header>
                    <p>${money.format(order.total)} · ${dateTime.format(new Date(order.createdAt))}</p>
                  </button>
                `,
              )
              .join("") || `<p>Nenhum pedido encontrado.</p>`
          }
        </div>
      </div>
    `,
  });
}

function renderAdminCustomers() {
  return renderAdminCustomersList();
}

function renderAdminReports() {
  const reports = state.admin.reports;
  if (!reports) return `<div class="notice">Carregando relatórios...</div>`;
  return `
    <div class="admin-grid">
      <article class="metric-card"><span>Faturamento pago</span><strong>${money.format(reports.overview.revenue)}</strong></article>
      <article class="metric-card"><span>Lucro estimado</span><strong>${money.format(reports.overview.profit || 0)}</strong></article>
      <article class="metric-card"><span>Margem</span><strong>${Number(reports.overview.margin || 0).toFixed(1)}%</strong></article>
      <article class="metric-card"><span>Pedidos pagos</span><strong>${reports.overview.paidOrders}</strong></article>
      <article class="metric-card"><span>Ticket médio</span><strong>${money.format(reports.overview.averageTicket)}</strong></article>
      <article class="metric-card"><span>Itens vendidos</span><strong>${reports.overview.itemsSold}</strong></article>
      <article class="metric-card"><span>Valor em estoque</span><strong>${money.format(reports.overview.stockValue)}</strong></article>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Exportações</h3>
          <p>Baixe relatórios separados para analisar a loja.</p>
        </div>
      </div>
      <div class="control-actions">
        <a class="mini-button" href="/api/admin/reports.csv?type=orders" download>Pedidos CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=products" download>Produtos CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=customers" download>Clientes CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=stock" download>Estoque CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=days" download>Vendas por dia CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=profit" download>Lucro CSV</a>
        <a class="mini-button" href="/api/admin/reports.csv?type=cash" download>Caixa CSV</a>
      </div>
    </div>
    <div class="report-grid">
      <div class="panel">
        <h3>Vendas por dia</h3>
        ${renderSimpleReport(reports.byDay, ["day", "orders", "items", "revenue"], ["Dia", "Pedidos", "Itens", "Faturamento"], { revenue: "money" })}
      </div>
      <div class="panel">
        <h3>Status dos pedidos</h3>
        ${renderSimpleReport(reports.byStatus, ["status", "orders", "revenue"], ["Status", "Pedidos", "Total"], { revenue: "money" })}
      </div>
      <div class="panel">
        <h3>Produtos mais vendidos</h3>
        ${renderSimpleReport(reports.products.slice(0, 10), ["name", "quantity", "revenue", "profit"], ["Produto", "Qtd.", "Total", "Lucro"], { revenue: "money", profit: "money" })}
      </div>
      <div class="panel">
        <h3>Estoque</h3>
        ${renderSimpleReport(reports.stock.slice(0, 10), ["name", "stock", "minStock", "estimatedValue", "estimatedCost"], ["Produto", "Estoque", "Mín.", "Valor", "Custo"], { estimatedValue: "money", estimatedCost: "money" })}
      </div>
    </div>
  `;
}

function renderSimpleReport(rows, keys, labels, formats = {}) {
  if (!rows?.length) return `<div class="empty-state">Sem dados para este relatório.</div>`;
  return `
    <div class="table-card compact-table">
      <table>
        <thead><tr>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${keys
                    .map((key) => {
                      const value = formats[key] === "money" ? money.format(Number(row[key] || 0)) : row[key];
                      return `<td>${escapeHtml(value ?? "")}</td>`;
                    })
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminCash() {
  const cash = state.admin.cash;
  if (!cash) return `<div class="notice">Carregando caixa...</div>`;
  return `
    <div class="admin-grid">
      <article class="metric-card"><span>Entradas de pedidos</span><strong>${money.format(cash.summary.orderIncome)}</strong></article>
      <article class="metric-card"><span>Entradas manuais</span><strong>${money.format(cash.summary.manualIncome)}</strong></article>
      <article class="metric-card"><span>Saídas</span><strong>${money.format(cash.summary.manualExpense)}</strong></article>
      <article class="metric-card"><span>Saldo do caixa</span><strong>${money.format(cash.summary.balance)}</strong></article>
      <article class="metric-card"><span>Lançamentos</span><strong>${cash.summary.entries}</strong></article>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Lançar caixa</h3>
          <p>Registre entradas extras, despesas, frete, embalagem ou ajustes.</p>
        </div>
      </div>
      <form class="form-grid" data-cash-form>
        <label>
          <span>Tipo</span>
          <select name="type" required>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </label>
        <label>
          <span>Forma</span>
          <select name="method" required>
            <option value="PIX">PIX</option>
            <option value="Cartão">Cartão</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Mercado Pago">Mercado Pago</option>
            <option value="Outro">Outro</option>
          </select>
        </label>
        <label>
          <span>Valor</span>
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          <span>Descrição</span>
          <input name="description" type="text" placeholder="Ex.: compra de embalagem" required />
        </label>
        <button class="button button-primary wide-field" type="submit">Salvar lançamento</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Fechamento de caixa</h3>
          <p>Registre o saldo contado no fim do dia e acompanhe diferenças.</p>
        </div>
      </div>
      <form class="form-grid" data-cash-close-form>
        <label>
          <span>Período</span>
          <input name="period" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
        </label>
        <label>
          <span>Saldo contado</span>
          <input name="countedBalance" type="number" step="0.01" value="${Number(cash.summary.balance || 0).toFixed(2)}" required />
        </label>
        <label class="wide-field">
          <span>Observações</span>
          <textarea name="notes" rows="2" placeholder="Ex.: diferença por taxa, troco ou ajuste"></textarea>
        </label>
        <button class="button button-secondary wide-field" type="submit">Fechar caixa</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Forma</th><th>Valor</th></tr></thead>
        <tbody>
          ${cash.entries
            .map(
              (entry) => `
                <tr>
                  <td>${dateTime.format(new Date(entry.createdAt))}</td>
                  <td><span class="status-pill ${entry.type === "entrada" ? "good" : "danger"}">${entry.type}</span></td>
                  <td>${escapeHtml(entry.description)}</td>
                  <td>${escapeHtml(entry.method)}</td>
                  <td>${money.format(entry.amount)}</td>
                </tr>
              `,
            )
            .join("") || `<tr><td colspan="5">Nenhum lançamento manual.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Período</th><th>Fechado em</th><th>Esperado</th><th>Contado</th><th>Diferença</th><th>Obs.</th></tr></thead>
        <tbody>
          ${(cash.closings || [])
            .map(
              (closing) => `
                <tr>
                  <td>${escapeHtml(closing.period)}</td>
                  <td>${dateTime.format(new Date(closing.closedAt))}</td>
                  <td>${money.format(closing.expectedBalance)}</td>
                  <td>${money.format(closing.countedBalance)}</td>
                  <td><span class="status-pill ${Number(closing.difference || 0) === 0 ? "good" : "warn"}">${money.format(closing.difference)}</span></td>
                  <td>${escapeHtml(closing.notes || "")}</td>
                </tr>
              `,
            )
            .join("") || `<tr><td colspan="6">Nenhum fechamento registrado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminEditor() {
  const settings = state.settings;
  return `
    <div class="panel editor-panel">
      <div class="panel-head">
        <div>
          <h3>Editor visual do site</h3>
          <p>Altere cores, imagem principal, arredondamento, aviso e CSS extra sem mexer no código.</p>
        </div>
        <a class="button button-secondary" href="/api/admin/backup" download>Baixar backup</a>
      </div>
      <form class="form-grid" data-editor-form>
        <label>
          <span>Cor principal</span>
          <input name="primaryColor" type="color" value="${escapeHtml(settings.primaryColor || settingFallbacks.primaryColor)}" />
        </label>
        <label>
          <span>Cor de destaque</span>
          <input name="accentColor" type="color" value="${escapeHtml(settings.accentColor || settingFallbacks.accentColor)}" />
        </label>
        <label>
          <span>Cor de alerta</span>
          <input name="dangerColor" type="color" value="${escapeHtml(settings.dangerColor || settingFallbacks.dangerColor)}" />
        </label>
        <label>
          <span>Layout da vitrine</span>
          <select name="storeLayout">
            <option value="premium" ${settings.storeLayout !== "compact" ? "selected" : ""}>Premium</option>
            <option value="compact" ${settings.storeLayout === "compact" ? "selected" : ""}>Compacto</option>
          </select>
        </label>
        <label>
          <span>Raio dos botões</span>
          <input name="buttonRadius" type="number" min="0" max="28" value="${Number(settings.buttonRadius ?? settingFallbacks.buttonRadius)}" />
        </label>
        <label>
          <span>Raio dos cards</span>
          <input name="cardRadius" type="number" min="0" max="28" value="${Number(settings.cardRadius ?? settingFallbacks.cardRadius)}" />
        </label>
        <label class="wide-field">
          <span>Imagem principal</span>
          <input name="heroImage" type="text" value="${escapeHtml(settings.heroImage || settingFallbacks.heroImage)}" />
        </label>
        <label class="wide-field">
          <span>Aviso comercial</span>
          <input name="announcementText" type="text" value="${escapeHtml(settings.announcementText || settingFallbacks.announcementText)}" />
        </label>
        <label class="wide-field">
          <span>CSS extra</span>
          <textarea name="customCss" rows="8" placeholder=".product-card { ... }">${escapeHtml(settings.customCss || "")}</textarea>
        </label>
        <button class="button button-primary wide-field" type="submit">Salvar visual</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>
    <div class="editor-preview">
      <article class="product-card">
        <div class="product-media"><img src="${escapeHtml(settings.heroImage || settingFallbacks.heroImage)}" alt="Prévia visual" /></div>
        <div class="product-body">
          <div class="product-title-row"><h3>Prévia da faca</h3><span class="product-price">R$ 389,00</span></div>
          <p>Este card mostra como cores, botões e arredondamento ficam na loja.</p>
          <button class="button button-primary" type="button">Comprar</button>
        </div>
      </article>
    </div>
  `;
}

function renderAdminLogs() {
  const logs = state.admin.logs || [];
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Logs de ações</h3>
          <p>Histórico das alterações feitas no painel administrativo.</p>
        </div>
        <a class="button button-secondary" href="/api/admin/backup" download>Backup JSON</a>
      </div>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr></thead>
        <tbody>
          ${logs
            .map(
              (log) => `
                <tr>
                  <td>${dateTime.format(new Date(log.createdAt))}</td>
                  <td>${escapeHtml(log.userName || "")}</td>
                  <td><strong>${escapeHtml(log.action)}</strong></td>
                  <td>${escapeHtml(log.detail || "")}</td>
                </tr>
              `,
            )
            .join("") || `<tr><td colspan="4">Nenhum log registrado ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function settingInput(name, label, type = "text") {
  return `
    <label>
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(state.settings[name] ?? "")}" />
    </label>
  `;
}

function settingTextarea(name, label, rows = 3) {
  return `
    <label class="wide-field">
      <span>${label}</span>
      <textarea name="${name}" rows="${rows}">${escapeHtml(state.settings[name] ?? "")}</textarea>
    </label>
  `;
}

function renderSettingsFields() {
  const tab = state.activeSettingsTab;
  if (tab === "visual") {
    return `
      ${settingInput("primaryColor", "Cor principal", "color")}
      ${settingInput("accentColor", "Cor de destaque", "color")}
      ${settingInput("dangerColor", "Cor de alerta", "color")}
      ${settingInput("heroImage", "Imagem principal")}
      ${settingInput("announcementText", "Aviso comercial")}
      ${settingTextarea("customCss", "CSS extra", 6)}
    `;
  }
  if (tab === "contact") {
    return `
      ${settingInput("footerAddress", "Endereço/região")}
      ${settingInput("footerHours", "Horário")}
      ${settingInput("footerDocument", "Aviso legal")}
      ${settingInput("whatsapp", "WhatsApp")}
    `;
  }
  if (tab === "whatsapp") {
    return `
      ${settingTextarea("whatsappProductMessage", "Mensagem produto", 2)}
      ${settingTextarea("whatsappCheckoutMessage", "Mensagem checkout", 2)}
      ${settingTextarea("whatsappSupportMessage", "Mensagem atendimento", 2)}
    `;
  }
  if (tab === "delivery") {
    return `
      ${settingInput("shippingFee", "Frete padrão", "number")}
      ${settingInput("freeShippingFrom", "Frete grátis a partir de", "number")}
      ${settingTextarea("shippingPolicy", "Política de envio")}
      ${settingTextarea("exchangePolicy", "Política de troca")}
      ${settingTextarea("warrantyPolicy", "Garantia")}
      ${settingTextarea("carePolicy", "Cuidados gerais")}
    `;
  }
  if (tab === "payment") {
    return `
      <div class="notice wide-field">Mercado Pago: <strong>${state.payment.mercadoPagoConfigured ? "token configurado" : "token não configurado"}</strong>.</div>
      ${settingInput("pixKey", "Chave PIX")}
      ${settingInput("publicUrl", "URL pública da loja", "url")}
    `;
  }
  if (tab === "seo") {
    return `
      ${settingInput("seoTitle", "Título SEO")}
      ${settingTextarea("seoDescription", "Descrição SEO", 2)}
      ${settingTextarea("legalPolicy", "Segurança/maioridade")}
    `;
  }
  return `
    ${settingInput("siteName", "Nome da loja")}
    ${settingInput("heroEyebrow", "Chamada do topo")}
    ${settingInput("storeTitle", "Título da vitrine")}
    ${settingInput("clientAreaTitle", "Título da área do cliente")}
    ${settingInput("adminAreaTitle", "Título da área admin")}
    ${settingInput("footerTitle", "Título do rodapé")}
    ${settingTextarea("tagline", "Frase principal")}
    ${settingTextarea("storeSubtitle", "Texto da vitrine", 2)}
    ${settingTextarea("clientAreaText", "Texto da área do cliente", 2)}
    ${settingTextarea("adminAreaText", "Texto da área admin", 2)}
    ${settingTextarea("footerText", "Texto do rodapé", 2)}
  `;
}

function renderAdminSettingsTabbed() {
  const tabs = [
    ["store", "Dados da loja"],
    ["visual", "Identidade visual"],
    ["contact", "Contato"],
    ["whatsapp", "WhatsApp"],
    ["delivery", "Entrega"],
    ["payment", "Pagamento"],
    ["seo", "SEO e segurança"],
    ["password", "Senha"],
  ];
  return `
    ${adminPageHead("Configurações", "Ajustes separados por assunto para evitar formulários longos.", "")}
    <div class="settings-tabs" role="group" aria-label="Seções de configurações">
      ${tabs.map(([id, label]) => `<button class="tab-button ${state.activeSettingsTab === id ? "is-active" : ""}" type="button" data-settings-tab="${id}">${label}</button>`).join("")}
    </div>
    ${
      state.activeSettingsTab === "password"
        ? `<div class="panel"><form class="form-grid" data-password-form>
            <label><span>Senha atual</span><input name="currentPassword" type="password" required /></label>
            <label><span>Nova senha</span><input name="newPassword" type="password" minlength="6" required /></label>
            <button class="button button-primary wide-field" type="submit">Alterar senha</button>
            <p class="form-status wide-field" role="status"></p>
          </form></div>`
        : `<div class="panel"><form class="form-grid" data-settings-form>
            ${renderSettingsFields()}
            <button class="button button-primary wide-field" type="submit">Salvar configurações</button>
            <p class="form-status wide-field" role="status"></p>
          </form></div>`
    }
  `;
}

function renderAdminSettings() {
  return renderAdminSettingsTabbed();
}

async function loadMyOrders() {
  if (!state.user) {
    state.myOrders = [];
    return;
  }
  const payload = await api("/api/my/orders");
  state.myOrders = payload.orders;
}

async function loadAdminData() {
  if (!state.user || state.user.role !== "admin") return;
  const [summary, products, categories, orders, customers, quotes, coupons, reviews, reports, cash, logs] = await Promise.all([
    api("/api/admin/summary"),
    api("/api/admin/products"),
    api("/api/admin/categories"),
    api("/api/admin/orders"),
    api("/api/admin/customers"),
    api("/api/admin/orcamentos"),
    api("/api/admin/coupons"),
    api("/api/admin/reviews"),
    api("/api/admin/reports"),
    api("/api/admin/cash"),
    api("/api/admin/logs"),
  ]);
  state.admin.summary = summary.summary;
  state.admin.products = products.products;
  state.admin.categories = categories.categories;
  state.admin.orders = orders.orders;
  state.admin.customers = customers.customers;
  state.admin.quotes = quotes.orcamentos;
  state.admin.coupons = coupons.coupons;
  state.admin.reviews = reviews.reviews;
  state.admin.reports = reports.reports;
  state.admin.cash = cash.cash;
  state.admin.logs = logs.logs;
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap");
  state.settings = payload.settings;
  state.csrfToken = payload.csrfToken || "";
  state.payment = payload.payment || state.payment;
  state.products = payload.products;
  state.user = payload.user;
  if (state.user) await syncFavoritesWithServer();
  renderSettings();
  renderProducts();
  renderReviewShowcase();
  renderCart();
  if (state.user) await loadMyOrders();
  if (state.user?.role === "admin") await loadAdminData();
  renderClientPanel();
  renderAdminShell();
  observeReveal();
  window.setTimeout(handleHashRoute, 0);
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("payment_id") || params.get("collection_id");
  const path = window.location.pathname;
  const pathStatus = path.includes("/pagamento/sucesso")
    ? "success"
    : path.includes("/pagamento/pendente")
      ? "pending"
      : path.includes("/pagamento/falha")
        ? "failure"
        : "";
  const paymentStatus = params.get("payment") || params.get("collection_status") || pathStatus;

  if (paymentId) {
    try {
      await api("/api/payments/mercadopago/sync", {
        method: "POST",
        body: { paymentId },
      });
      await loadBootstrap();
      showToast("Pagamento consultado e pedido atualizado.");
    } catch (error) {
      showToast(`Retorno de pagamento recebido: ${error.message}`);
    }
  } else if (["success", "approved"].includes(paymentStatus)) {
    showToast("Pagamento aprovado. O pedido será atualizado pelo Mercado Pago.");
  } else if (paymentStatus === "pending") {
    showToast("Pagamento pendente. A loja atualizará o pedido assim que houver confirmação.");
  } else if (["failure", "rejected"].includes(paymentStatus)) {
    showToast("Pagamento não aprovado. Você pode tentar novamente ou combinar com a loja.");
  }

  if (paymentStatus || paymentId) {
    const cleanUrl = window.location.pathname.startsWith("/pagamento/") ? "/" : `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);
  }
}

async function login(form) {
  const data = new FormData(form);
  const scope = form.dataset.loginScope || "customer";
  const payload = await api("/api/login", {
    method: "POST",
    body: {
      email: data.get("email"),
      password: data.get("password"),
    },
  });

  if (scope === "admin" && payload.user.role !== "admin") {
    await api("/api/logout", { method: "POST" });
    throw new Error("Este usuário não é administrador.");
  }

  state.user = payload.user;
  if (scope === "admin") state.adminTab = "dashboard";
  await loadBootstrap();
  showToast(scope === "admin" ? "Painel administrativo liberado." : `Bem-vindo, ${state.user.name}.`);
}

async function register(form) {
  const data = new FormData(form);
  const payload = await api("/api/register", {
    method: "POST",
    body: {
      name: data.get("name"),
      phone: data.get("phone"),
      email: data.get("email"),
      password: data.get("password"),
    },
  });
  state.user = payload.user;
  await loadBootstrap();
  showToast("Cadastro criado com sucesso.");
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  state.user = null;
  state.myOrders = [];
  state.admin.summary = null;
  await loadBootstrap();
  showToast("Você saiu da conta.");
}

async function submitQuote(form) {
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  payload.engraving = data.get("engraving") === "on";
  const response = await api("/api/orcamentos", {
    method: "POST",
    body: payload,
  });
  form.reset();
  setFormStatus(form, `Orçamento ${response.orcamento.id} enviado. A loja vai responder pelo WhatsApp.`);
  showToast("Orçamento enviado.");
}

async function submitOrder(form) {
  const data = new FormData(form);
  const payload = await api("/api/orders", {
    method: "POST",
    body: {
      items: cartLines().map((item) => ({ productId: item.id, quantity: item.quantity })),
      customerName: data.get("customerName"),
      customerEmail: data.get("customerEmail"),
      customerPhone: data.get("customerPhone"),
      cep: data.get("cep"),
      address: data.get("address"),
      couponCode: data.get("couponCode"),
      paymentMethod: data.get("paymentMethod"),
      notes: data.get("notes"),
      ageCheck: data.get("ageCheck") === "on",
    },
  });

  state.cart = {};
  clearCheckoutAdjustments();
  saveCart();
  if (payload.payment?.redirectUrl) {
    setFormStatus(form, `Pedido ${payload.order.id} criado. Redirecionando para pagamento seguro...`);
    showToast("Abrindo pagamento Mercado Pago.");
    window.setTimeout(() => {
      window.location.href = payload.payment.redirectUrl;
    }, 700);
  } else {
    setFormStatus(form, `Pedido ${payload.order.id} recebido. Total: ${money.format(payload.order.total)}.`);
    showToast("Pedido registrado com sucesso.");
  }
  await loadBootstrap();
  form.reset();
  renderCheckoutSummary();
}

async function payOrderAgain(id) {
  const payload = await api("/api/pagamentos/mercado-pago/preferencia", {
    method: "POST",
    body: { orderId: id },
  });
  showToast("Abrindo pagamento Mercado Pago.");
  window.location.href = payload.payment.redirectUrl;
}

async function saveQuoteUpdate(form) {
  const id = form.dataset.quoteId;
  const data = new FormData(form);
  const payload = await api(`/api/admin/orcamentos/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: Object.fromEntries(data.entries()),
  });
  const index = state.admin.quotes.findIndex((quote) => quote.id === id);
  if (index >= 0) state.admin.quotes[index] = payload.orcamento;
  setFormStatus(form, "Orçamento atualizado.");
  showToast("Orçamento atualizado.");
  await loadAdminData();
  renderAdminShell();
}

async function uploadProductImage(file) {
  if (!file || !file.size) return "";
  const formData = new FormData();
  formData.append("image", file);
  const payload = await api("/api/admin/upload-image", {
    method: "POST",
    body: formData,
  });
  return payload.path;
}

function productPayloadFromForm(form) {
  const data = new FormData(form);
  return {
    name: data.get("name"),
    sku: data.get("sku"),
    slug: data.get("slug"),
    category: data.get("category"),
    price: data.get("price"),
    promoPrice: data.get("promoPrice"),
    cost: data.get("cost"),
    stock: data.get("stock"),
    minStock: data.get("minStock"),
    badge: data.get("badge"),
    image: data.get("image"),
    gallery: data.get("gallery"),
    steel: data.get("steel"),
    size: data.get("size"),
    handleMaterial: data.get("handleMaterial"),
    weight: data.get("weight"),
    bladeLength: data.get("bladeLength"),
    totalLength: data.get("totalLength"),
    sheath: data.get("sheath"),
    productionTime: data.get("productionTime"),
    shippingTime: data.get("shippingTime"),
    warranty: data.get("warranty"),
    care: data.get("care"),
    featured: data.get("featured"),
    description: data.get("description"),
    active: data.get("active") === "on",
  };
}

async function saveProduct(form) {
  const payload = productPayloadFromForm(form);
  const file = form.querySelector('input[name="imageFile"]')?.files?.[0];
  if (file) {
    payload.image = await uploadProductImage(file);
  }
  if (state.editingProductId) {
    await api(`/api/admin/products/${state.editingProductId}`, {
      method: "PUT",
      body: payload,
    });
    showToast("Produto atualizado.");
  } else {
    await api("/api/admin/products", {
      method: "POST",
      body: payload,
    });
    showToast("Produto cadastrado.");
  }
  state.editingProductId = null;
  await loadBootstrap();
  closeAdminOverlay();
}

async function disableProduct(id) {
  await api(`/api/admin/products/${id}`, { method: "DELETE" });
  showToast("Produto desativado.");
  await loadBootstrap();
  closeAdminOverlay();
}

function categoryPayloadFromForm(form) {
  const data = new FormData(form);
  return {
    name: data.get("name"),
    slug: data.get("slug"),
    active: data.get("active") === "on",
  };
}

async function saveCategory(form) {
  const payload = categoryPayloadFromForm(form);
  if (state.editingCategoryId) {
    await api(`/api/admin/categories/${state.editingCategoryId}`, {
      method: "PUT",
      body: payload,
    });
    showToast("Categoria atualizada.");
  } else {
    await api("/api/admin/categories", {
      method: "POST",
      body: payload,
    });
    showToast("Categoria criada.");
  }
  state.editingCategoryId = null;
  await loadBootstrap();
  closeAdminOverlay();
}

async function deleteCategory(id) {
  await api(`/api/admin/categories/${id}`, { method: "DELETE" });
  showToast("Categoria removida.");
  await loadBootstrap();
  closeAdminOverlay();
}

function couponPayloadFromForm(form) {
  const data = new FormData(form);
  return {
    code: data.get("code"),
    type: data.get("type"),
    value: data.get("value"),
    minSubtotal: data.get("minSubtotal"),
    active: data.get("active") === "on",
  };
}

async function saveCoupon(form) {
  await api("/api/admin/coupons", {
    method: "POST",
    body: couponPayloadFromForm(form),
  });
  form.reset();
  showToast("Cupom salvo.");
  await loadBootstrap();
}

async function saveReview(form) {
  const data = new FormData(form);
  await api("/api/reviews", {
    method: "POST",
    body: {
      productId: data.get("productId"),
      rating: data.get("rating"),
      comment: data.get("comment"),
    },
  });
  form.reset();
  setFormStatus(form, "Avaliação enviada para moderação.");
  showToast("Avaliação enviada. Ela aparecerá após aprovação.");
}

async function updateReviewStatus(id, status) {
  await api(`/api/admin/reviews/${id}`, {
    method: "PUT",
    body: { status },
  });
  showToast("Avaliação atualizada.");
  await loadBootstrap();
}

async function toggleCoupon(id, active) {
  const coupon = state.admin.coupons.find((item) => item.id === id);
  if (!coupon) return;
  await api(`/api/admin/coupons/${id}`, {
    method: "PUT",
    body: {
      ...coupon,
      active,
    },
  });
  showToast(active ? "Cupom ativado." : "Cupom desativado.");
  await loadBootstrap();
}

async function updateOrderStatus(id, status) {
  await api(`/api/admin/orders/${id}`, {
    method: "PUT",
    body: { status },
  });
  showToast("Status do pedido atualizado.");
  await loadBootstrap();
}

function settingsPayloadFromState(overrides = {}) {
  return {
    ...state.settings,
    ...overrides,
  };
}

async function saveEditorSettings(form) {
  const data = new FormData(form);
  await api("/api/admin/settings", {
    method: "PUT",
    body: settingsPayloadFromState({
      primaryColor: data.get("primaryColor"),
      accentColor: data.get("accentColor"),
      dangerColor: data.get("dangerColor"),
      heroImage: data.get("heroImage"),
      buttonRadius: data.get("buttonRadius"),
      cardRadius: data.get("cardRadius"),
      storeLayout: data.get("storeLayout"),
      announcementText: data.get("announcementText"),
      customCss: data.get("customCss"),
    }),
  });
  showToast("Visual do site atualizado.");
  await loadBootstrap();
  state.adminTab = "editor";
  renderAdminShell();
}

async function saveSettings(form) {
  const data = new FormData(form);
  const updates = Object.fromEntries(data.entries());
  await api("/api/admin/settings", {
    method: "PUT",
    body: settingsPayloadFromState(updates),
  });
  showToast("Configurações salvas.");
  await loadBootstrap();
}

async function saveAdminPassword(form) {
  const data = new FormData(form);
  await api("/api/admin/password", {
    method: "PUT",
    body: {
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
    },
  });
  form.reset();
  setFormStatus(form, "Senha alterada com sucesso.");
  showToast("Senha do administrador alterada.");
}

async function saveCashEntry(form) {
  const data = new FormData(form);
  await api("/api/admin/cash", {
    method: "POST",
    body: {
      type: data.get("type"),
      method: data.get("method"),
      amount: data.get("amount"),
      description: data.get("description"),
    },
  });
  form.reset();
  showToast("Lançamento salvo no caixa.");
  await loadBootstrap();
  state.adminTab = "cash";
  renderAdminShell();
}

async function saveCashClosing(form) {
  const data = new FormData(form);
  await api("/api/admin/cash/close", {
    method: "POST",
    body: {
      period: data.get("period"),
      countedBalance: data.get("countedBalance"),
      notes: data.get("notes"),
    },
  });
  form.reset();
  showToast("Caixa fechado.");
  await loadBootstrap();
  state.adminTab = "cash";
  renderAdminShell();
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const whatsappAnchor = target.closest("[data-whatsapp-link], .button-whatsapp, .whatsapp-inline");
  if (whatsappAnchor && whatsappAnchor.href) {
    event.preventDefault();
    window.location.assign(whatsappAnchor.href);
    return;
  }

  const routeAnchor = target.closest('a[href^="/"]');
  if (routeAnchor && !routeAnchor.hasAttribute("download") && !routeAnchor.getAttribute("target")) {
    const url = new URL(routeAnchor.href, window.location.href);
    if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) {
      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
      handleHashRoute();
      return;
    }
  }

  const scrollControl = target.closest("[data-scroll-target]");
  if (scrollControl) {
    event.preventDefault();
    if (scrollToSection(scrollControl.dataset.scrollTarget)) return;
  }

  const internalAnchor = target.closest('a[href^="#"]');
  if (internalAnchor) {
    const hash = internalAnchor.getAttribute("href");
    if (scrollToSection(hash)) {
      event.preventDefault();
      return;
    }
  }

  if (target.closest("[data-theme-toggle]")) {
    toggleTheme();
    return;
  }

  if (target.closest("[data-toggle-nav]")) {
    document.querySelector(".main-nav")?.classList.toggle("is-open");
    return;
  }

  if (target.closest("[data-open-favorites]")) {
    state.filters.favoritesOnly = true;
    if (favoritesOnlyInput) favoritesOnlyInput.checked = true;
    renderProducts();
    scrollToSection("#loja");
    return;
  }

  const authButton = target.closest("[data-open-auth]");
  if (authButton) {
    openAuthModal("login");
    return;
  }

  if (target.closest("[data-close-auth]")) {
    closeAuthModal();
    return;
  }

  const authModeButton = target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.authMode = authModeButton.dataset.authMode === "register" ? "register" : "login";
    renderClientPanel();
    applyTheme();
    return;
  }

  const addButton = target.closest("[data-add-product]");
  if (addButton) {
    addToCart(addButton.dataset.addProduct);
    return;
  }

  const favoriteButton = target.closest("[data-favorite-product]");
  if (favoriteButton) {
    await toggleFavorite(favoriteButton.dataset.favoriteProduct);
    return;
  }

  const galleryButton = target.closest("[data-gallery-image]");
  if (galleryButton) {
    const mainImage = document.querySelector("[data-product-main-image]");
    if (mainImage) mainImage.src = galleryButton.dataset.galleryImage;
    document.querySelectorAll("[data-gallery-image]").forEach((button) => button.classList.toggle("is-active", button === galleryButton));
    return;
  }

  const viewProductButton = target.closest("[data-view-product]");
  if (viewProductButton) {
    const product = productById(viewProductButton.dataset.viewProduct);
    openProductDetail(viewProductButton.dataset.viewProduct);
    if (product) window.history.pushState({}, "", `/produto/${encodeURIComponent(product.slug || product.id)}`);
    return;
  }

  const increaseButton = target.closest("[data-increase]");
  if (increaseButton) {
    const id = increaseButton.dataset.increase;
    setQuantity(id, (state.cart[id] || 0) + 1);
    return;
  }

  const decreaseButton = target.closest("[data-decrease]");
  if (decreaseButton) {
    const id = decreaseButton.dataset.decrease;
    setQuantity(id, (state.cart[id] || 0) - 1);
    return;
  }

  if (target.closest("[data-open-cart]")) {
    openCart();
    return;
  }

  if (target.closest("[data-close-cart]")) {
    closeCart();
    return;
  }

  if (target.closest("[data-open-checkout]")) {
    openCheckout();
    return;
  }

  if (target.closest("[data-close-checkout]")) {
    closeCheckout();
    return;
  }

  if (target.closest("[data-close-product]")) {
    closeProductDetail();
    return;
  }

  if (target.closest("[data-logout]")) {
    await logout();
    return;
  }

  const categoryButton = target.closest("[data-category]");
  if (categoryButton) {
    state.filters.category = categoryButton.dataset.category;
    document.querySelectorAll("[data-category]").forEach((tab) => tab.classList.remove("is-active"));
    categoryButton.classList.add("is-active");
    renderProducts();
    scrollToSection("#loja");
    return;
  }

  const adminTabButton = target.closest("[data-admin-tab]");
  if (adminTabButton) {
    state.adminTab = adminTabButton.dataset.adminTab;
    renderAdminShell();
    return;
  }

  if (target.closest("[data-toggle-admin-nav]")) {
    state.adminCollapsed = !state.adminCollapsed;
    localStorage.setItem("facas-brazao-admin-collapsed", state.adminCollapsed ? "1" : "0");
    renderAdminShell();
    return;
  }

  const settingsTabButton = target.closest("[data-settings-tab]");
  if (settingsTabButton) {
    state.activeSettingsTab = settingsTabButton.dataset.settingsTab;
    renderAdminShell();
    return;
  }

  if (target.closest("[data-close-admin-overlay]")) {
    closeAdminOverlay();
    return;
  }

  if (target.closest("[data-open-product-form]")) {
    openProductForm();
    return;
  }

  const viewAdminProductButton = target.closest("[data-view-admin-product]");
  if (viewAdminProductButton) {
    openAdminProductView(viewAdminProductButton.dataset.viewAdminProduct);
    return;
  }

  const editProductButton = target.closest("[data-edit-product]");
  if (editProductButton) {
    openProductForm(editProductButton.dataset.editProduct);
    return;
  }

  if (target.closest("[data-new-product]")) {
    state.editingProductId = null;
    renderAdminShell();
    return;
  }

  const disableButton = target.closest("[data-disable-product]");
  if (disableButton) {
    openDeleteProductConfirm(disableButton.dataset.disableProduct);
    return;
  }

  const confirmDisableProduct = target.closest("[data-confirm-disable-product]");
  if (confirmDisableProduct) {
    await disableProduct(confirmDisableProduct.dataset.confirmDisableProduct);
    return;
  }

  if (target.closest("[data-open-category-form]")) {
    openCategoryForm();
    return;
  }

  const editCategoryButton = target.closest("[data-edit-category]");
  if (editCategoryButton) {
    openCategoryForm(editCategoryButton.dataset.editCategory);
    return;
  }

  const deleteCategoryButton = target.closest("[data-delete-category]");
  if (deleteCategoryButton) {
    openDeleteCategoryConfirm(deleteCategoryButton.dataset.deleteCategory);
    return;
  }

  const confirmDeleteCategory = target.closest("[data-confirm-delete-category]");
  if (confirmDeleteCategory) {
    await deleteCategory(confirmDeleteCategory.dataset.confirmDeleteCategory);
    return;
  }

  const viewOrderButton = target.closest("[data-view-order]");
  if (viewOrderButton) {
    openOrderDrawer(viewOrderButton.dataset.viewOrder);
    return;
  }

  const payOrderButton = target.closest("[data-pay-order]");
  if (payOrderButton) {
    await payOrderAgain(payOrderButton.dataset.payOrder);
    return;
  }

  const viewQuoteButton = target.closest("[data-view-quote]");
  if (viewQuoteButton) {
    openQuoteDrawer(viewQuoteButton.dataset.viewQuote);
    return;
  }

  const viewCustomerButton = target.closest("[data-view-customer]");
  if (viewCustomerButton) {
    openCustomerDrawer(viewCustomerButton.dataset.viewCustomer);
    return;
  }

  const toggleCouponButton = target.closest("[data-toggle-coupon]");
  if (toggleCouponButton) {
    await toggleCoupon(toggleCouponButton.dataset.toggleCoupon, toggleCouponButton.dataset.couponActive === "1");
    return;
  }

  const reviewStatusButton = target.closest("[data-review-status]");
  if (reviewStatusButton) {
    await updateReviewStatus(reviewStatusButton.dataset.reviewStatus, reviewStatusButton.dataset.status);
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  try {
    if (form.matches("[data-login-form]")) await login(form);
    if (form.matches("[data-register-form]")) await register(form);
    if (form.matches("[data-quote-form]")) await submitQuote(form);
    if (form.matches("#checkoutForm")) await submitOrder(form);
    if (form.matches("[data-quote-update-form]")) await saveQuoteUpdate(form);
    if (form.matches("[data-product-form]")) await saveProduct(form);
    if (form.matches("[data-category-form]")) await saveCategory(form);
    if (form.matches("[data-coupon-form]")) await saveCoupon(form);
    if (form.matches("[data-review-form]")) await saveReview(form);
    if (form.matches("[data-settings-form]")) await saveSettings(form);
    if (form.matches("[data-editor-form]")) await saveEditorSettings(form);
    if (form.matches("[data-password-form]")) await saveAdminPassword(form);
    if (form.matches("[data-cash-form]")) await saveCashEntry(form);
    if (form.matches("[data-cash-close-form]")) await saveCashClosing(form);
  } catch (error) {
    setFormStatus(form, error.message, true);
    showToast(error.message);
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches('#checkoutForm input[name="cep"]')) {
    state.checkout.cep = target.value;
    try {
      await refreshCheckoutPricing();
      await fillAddressFromCep(target.value);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  if (target.matches('#checkoutForm input[name="couponCode"]')) {
    state.checkout.couponCode = target.value.trim();
    try {
      await refreshCheckoutPricing();
      await fillAddressFromCep(state.checkout.cep);
    } catch (error) {
      state.checkout.coupon = { message: error.message };
      renderCheckoutSummary();
      showToast(error.message);
    }
    return;
  }
  const orderSelect = target.closest("[data-order-status]");
  if (orderSelect) {
    await updateOrderStatus(orderSelect.dataset.orderStatus, orderSelect.value);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.matches("[data-admin-product-search]")) {
    state.adminSearch.products = target.value;
    renderAdminShell();
    return;
  }
  if (target.matches("[data-admin-customer-search]")) {
    state.adminSearch.customers = target.value;
    renderAdminShell();
    return;
  }
  if (!target.matches('#checkoutForm input[name="cep"], #checkoutForm input[name="couponCode"]')) return;

  window.clearTimeout(refreshCheckoutPricing.timer);
  refreshCheckoutPricing.timer = window.setTimeout(async () => {
    state.checkout.cep = document.querySelector('#checkoutForm input[name="cep"]')?.value || "";
    state.checkout.couponCode = document.querySelector('#checkoutForm input[name="couponCode"]')?.value.trim() || "";
    const hasCep = state.checkout.cep.replace(/\D/g, "").length >= 8;
    const hasCoupon = state.checkout.couponCode.length >= 3;
    if (!hasCep && !hasCoupon) {
      state.checkout.shipping = null;
      state.checkout.coupon = null;
      renderCheckoutSummary();
      return;
    }
    try {
      await refreshCheckoutPricing();
    } catch (error) {
      state.checkout.coupon = { message: error.message };
      renderCheckoutSummary();
    }
  }, 450);
});

searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  renderProducts();
});

sortSelect.addEventListener("change", (event) => {
  state.filters.sort = event.target.value;
  renderProducts();
});

maxPriceInput?.addEventListener("input", (event) => {
  state.filters.maxPrice = event.target.value;
  renderProducts();
});

readyOnlyInput?.addEventListener("change", (event) => {
  state.filters.readyOnly = event.target.checked;
  renderProducts();
});

favoritesOnlyInput?.addEventListener("change", (event) => {
  state.filters.favoritesOnly = event.target.checked;
  renderProducts();
});

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) closeCart();
});

checkoutModal.addEventListener("click", (event) => {
  if (event.target === checkoutModal) closeCheckout();
});

productModal?.addEventListener("click", (event) => {
  if (event.target === productModal) closeProductDetail();
});

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});

window.addEventListener("hashchange", handleHashRoute);
window.addEventListener("popstate", handleHashRoute);

document.addEventListener("keydown", (event) => {
  const adminOverlay = document.querySelector("[data-admin-overlay]");
  if (adminOverlay && event.key === "Tab") {
    const nodes = focusableNodes(adminOverlay);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === "Escape") {
    closeAdminOverlay();
    closeCart();
    closeCheckout();
    closeProductDetail();
    closeAuthModal();
  }
});

applyTheme();
handleHashRoute();

loadBootstrap()
  .then(handlePaymentReturn)
  .catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="notice" style="margin: 18px">Não foi possível conectar ao servidor local. Rode <strong>python run.py</strong> ou abra pelo endereço do servidor.</div>`,
  );
});
