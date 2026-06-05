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
  },
  cart: JSON.parse(localStorage.getItem("facas-brazao-cart") || "{}"),
  checkout: {
    cep: "",
    couponCode: "",
    shipping: null,
    coupon: null,
  },
  selectedProductId: null,
  myOrders: [],
  adminTab: "dashboard",
  authMode: "login",
  theme: localStorage.getItem("facas-brazao-theme") || "light",
  editingProductId: null,
  admin: {
    summary: null,
    products: [],
    orders: [],
    customers: [],
    coupons: [],
    reviews: [],
    reports: null,
    cash: null,
  },
};

const productGrid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const cartDrawer = document.querySelector("#cartDrawer");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const cartTotal = document.querySelector("[data-cart-total]");
const checkoutModal = document.querySelector("#checkoutModal");
const productModal = document.querySelector("#productModal");
const authModal = document.querySelector("#authModal");
const checkoutSummary = document.querySelector("[data-checkout-summary]");
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

function syncAdminRoute() {
  document.body.classList.toggle("admin-route", window.location.hash === "#admin");
}

function saveCart() {
  localStorage.setItem("facas-brazao-cart", JSON.stringify(state.cart));
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers =
    options.body && !isFormData ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers;
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
  const list = state.products.filter((product) => {
    const inCategory = state.filters.category === "todos" || product.category === state.filters.category;
    const inSearch = [product.name, product.description, product.steel, product.category]
      .join(" ")
      .toLowerCase()
      .includes(search);
    return product.active !== false && inCategory && inSearch;
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
      const featuredReview = product.reviewStats?.reviews?.[0];
      return `
        <article class="product-card">
          <div class="product-media">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
            <span class="product-badge">${escapeHtml(product.badge || product.category)}</span>
          </div>
          <div class="product-body">
            <div class="product-title-row">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="product-price">${money.format(product.price)}</span>
            </div>
            <span class="rating-line">${escapeHtml(reviewLabel(product))}</span>
            <p>${escapeHtml(product.description)}</p>
            <ul class="meta-list" aria-label="Especificações">
              <li>${escapeHtml(product.steel || "Aço selecionado")}</li>
              <li>${escapeHtml(product.size || "Sob consulta")}</li>
              <li>${escapeHtml(product.handleMaterial || "Cabo selecionado")}</li>
              <li>${escapeHtml(product.productionTime || "Pronta entrega")}</li>
            </ul>
            ${featuredReview ? `<blockquote class="mini-review">"${escapeHtml(featuredReview.comment)}"</blockquote>` : ""}
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
  if (!state.user) {
    showToast("Faça login ou cadastre-se para finalizar.");
    closeCart();
    openAuthModal("login");
    return;
  }

  renderPaymentOptions();
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

function openProductDetail(id) {
  const product = productById(id);
  if (!product || !productDetail || !productModal) return;
  state.selectedProductId = id;
  const soldOut = product.stock <= 0;
  productDetail.innerHTML = `
    <div class="product-detail-layout">
      <div class="product-detail-media">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      </div>
      <div class="product-detail-copy">
        <p class="eyebrow">${escapeHtml(product.badge || product.category)}</p>
        <h2 id="product-detail-title">${escapeHtml(product.name)}</h2>
        <strong class="product-detail-price">${money.format(product.price)}</strong>
        <p>${escapeHtml(product.description)}</p>
        <span class="rating-line detail-rating">${escapeHtml(reviewLabel(product))}</span>
        <ul class="meta-list">
          <li>${escapeHtml(product.category)}</li>
          <li>${escapeHtml(product.steel || "Aco selecionado")}</li>
          <li>${escapeHtml(product.size || "Sob consulta")}</li>
          <li>${escapeHtml(product.handleMaterial || "Cabo selecionado")}</li>
          <li>${escapeHtml(product.weight || "Peso sob consulta")}</li>
          <li>${product.stock} em estoque</li>
        </ul>
        <div class="product-spec-grid">
          <article><span>Lâmina</span><strong>${escapeHtml(product.bladeLength || product.size || "Sob consulta")}</strong></article>
          <article><span>Total</span><strong>${escapeHtml(product.totalLength || "Sob consulta")}</strong></article>
          <article><span>Bainha</span><strong>${escapeHtml(product.sheath || "Sob consulta")}</strong></article>
          <article><span>Prazo</span><strong>${escapeHtml(product.productionTime || "Pronta entrega")}</strong></article>
          <article><span>Envio</span><strong>${escapeHtml(product.shippingTime || "Envio sob consulta")}</strong></article>
          <article><span>Garantia</span><strong>${escapeHtml(product.warranty || state.settings.warrantyPolicy || settingFallbacks.warrantyPolicy)}</strong></article>
        </div>
        <div class="notice">
          <strong>Cuidados:</strong> ${escapeHtml(product.care || state.settings.carePolicy || settingFallbacks.carePolicy)}
        </div>
        <div class="action-row">
          <button class="button button-primary" type="button" data-add-product="${product.id}" ${soldOut ? "disabled" : ""}>
            ${soldOut ? "Esgotado" : "Adicionar ao carrinho"}
          </button>
          <a class="button button-whatsapp whatsapp-icon-link" href="${whatsappUrl(settingMessage("whatsappProductMessage", settingFallbacks.whatsappProductMessage, { produto: product.name }))}" rel="noopener" aria-label="Perguntar sobre ${escapeHtml(product.name)} no WhatsApp">
            <span class="whatsapp-mark" aria-hidden="true"></span>
          </a>
          <button class="button button-secondary" type="button" data-close-product>Continuar comprando</button>
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
              ${renderReviewFormsForOrder(order)}
            </article>
          `,
        )
        .join("")}
    </div>
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
    ["coupons", "Cupons"],
    ["reviews", "Avaliações"],
    ["orders", "Pedidos"],
    ["customers", "Clientes"],
    ["reports", "Relatórios"],
    ["cash", "Caixa"],
    ["settings", "Configurações"],
  ];

  adminShell.innerHTML = `
    <div class="admin-tabs" role="group" aria-label="Abas do painel admin">
      ${tabs
        .map(
          ([id, label]) => `
            <button class="tab-button ${state.adminTab === id ? "is-active" : ""}" type="button" data-admin-tab="${id}">
              ${label}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="admin-tab-panel">
      ${renderAdminTab()}
    </div>
  `;
}

function renderAdminTab() {
  if (!state.admin.summary) {
    return `<div class="notice">Carregando dados do painel...</div>`;
  }

  if (state.adminTab === "products") return renderAdminProducts();
  if (state.adminTab === "coupons") return renderAdminCoupons();
  if (state.adminTab === "reviews") return renderAdminReviews();
  if (state.adminTab === "orders") return renderAdminOrders();
  if (state.adminTab === "customers") return renderAdminCustomers();
  if (state.adminTab === "reports") return renderAdminReports();
  if (state.adminTab === "cash") return renderAdminCash();
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
        <span>Pedidos</span>
        <strong>${summary.orders}</strong>
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
        <button class="mini-button" type="button" data-admin-tab="customers">Clientes e relatórios</button>
        <button class="mini-button" type="button" data-admin-tab="reports">Relatórios completos</button>
        <button class="mini-button" type="button" data-admin-tab="cash">Caixa</button>
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

function renderAdminProducts() {
  const editing = state.admin.products.find((product) => product.id === state.editingProductId);
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>${editing ? "Editar produto" : "Cadastrar faca"}</h3>
          <p>Produto salvo aparece na loja assim que estiver ativo.</p>
        </div>
        ${editing ? `<button class="mini-button" type="button" data-new-product>Novo produto</button>` : ""}
      </div>
      <form class="form-grid" data-product-form>
        ${productFormFields(editing)}
        <button class="button button-primary wide-field" type="submit">${editing ? "Salvar alterações" : "Cadastrar produto"}</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.products
            .map(
              (product) => `
                <tr>
                  <td>
                    <div class="admin-product-preview">
                      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
                      <div>
                        <strong>${escapeHtml(product.name)}</strong><br />
                        <span class="muted">${escapeHtml(product.steel || "")}</span>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(product.category)}</td>
                  <td>${money.format(product.price)}</td>
                  <td>${product.stock}</td>
                  <td><span class="status-pill ${product.active ? "good" : "danger"}">${product.active ? "Ativo" : "Inativo"}</span></td>
                  <td>
                    <div class="inline-actions">
                      <button class="mini-button" type="button" data-edit-product="${product.id}">Editar</button>
                      <button class="mini-button danger" type="button" data-disable-product="${product.id}">Desativar</button>
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

function productFormFields(product = {}) {
  return `
    <label>
      <span>Nome</span>
      <input name="name" type="text" value="${escapeHtml(product.name || "")}" required />
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
      <span>Estoque</span>
      <input name="stock" type="number" min="0" step="1" value="${product.stock ?? 0}" required />
    </label>
    <label>
      <span>Selo</span>
      <input name="badge" type="text" value="${escapeHtml(product.badge || "")}" />
    </label>
    <label>
      <span>Imagem</span>
      <input name="image" type="text" value="${escapeHtml(product.image || "assets/prod-chef.png")}" />
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

function renderAdminOrders() {
  if (!state.admin.orders.length) {
    return `<div class="empty-state">Nenhum pedido registrado ainda.</div>`;
  }

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Pedidos da loja</h3>
          <p>Altere o status conforme a produção e entrega avançam.</p>
        </div>
        <a class="button button-secondary" href="/api/admin/reports.csv" download>Exportar CSV</a>
      </div>
    </div>
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Status</th>
            <th>Entrega</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.orders
            .map(
              (order) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(order.id)}</strong><br />
                    <span class="muted">${dateTime.format(new Date(order.createdAt))}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(order.customerName)}</strong><br />
                    ${escapeHtml(order.customerEmail)}<br />
                    ${escapeHtml(order.customerPhone || "")}
                  </td>
                  <td>${order.items.map((item) => `${item.quantity}x ${escapeHtml(item.name)}`).join("<br />")}</td>
                  <td>
                    ${money.format(order.total)}<br />
                    <span class="muted">${escapeHtml(order.paymentMethod)}</span>
                    ${order.payment?.paymentId ? `<br /><span class="muted">PG ${escapeHtml(order.payment.paymentId)}</span>` : ""}
                  </td>
                  <td>
                    <select data-order-status="${escapeHtml(order.id)}">
                      ${[
                        "Aguardando pagamento",
                        "Pago",
                        "Recebido",
                        "Em produção",
                        "Pronto para envio",
                        "Enviado",
                        "Entregue",
                        "Pagamento recusado",
                        "Cancelado",
                      ]
                        .map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`)
                        .join("")}
                    </select>
                  </td>
                  <td>
                    ${order.cep ? `<strong>CEP ${escapeHtml(order.cep)}</strong><br />` : ""}
                    ${escapeHtml(order.address)}${order.notes ? `<br /><span class="muted">${escapeHtml(order.notes)}</span>` : ""}
                    ${String(order.customerPhone || "").replace(/\D/g, "").length >= 10 ? `<br /><a class="mini-button" href="${whatsappOrderLink(order)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
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

function renderAdminCustomers() {
  if (!state.admin.customers.length) {
    return `<div class="empty-state">Nenhum cliente cadastrado ainda.</div>`;
  }

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Relatório de clientes</h3>
          <p>Veja quem comprou, quantos pedidos fez e quanto gastou.</p>
        </div>
        <a class="button button-secondary" href="/api/admin/reports.csv" download>Exportar pedidos CSV</a>
      </div>
    </div>
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Contato</th>
            <th>Pedidos</th>
            <th>Total gasto</th>
            <th>Último pedido</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.customers
            .map(
              (customer) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(customer.name)}</strong><br />
                    <span class="muted">Desde ${dateTime.format(new Date(customer.createdAt))}</span>
                  </td>
                  <td>${escapeHtml(customer.email)}<br />${escapeHtml(customer.phone)}</td>
                  <td>${customer.orders}</td>
                  <td>${money.format(customer.totalSpent)}</td>
                  <td>${customer.lastOrderAt ? dateTime.format(new Date(customer.lastOrderAt)) : "Sem pedidos"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminReports() {
  const reports = state.admin.reports;
  if (!reports) return `<div class="notice">Carregando relatórios...</div>`;
  return `
    <div class="admin-grid">
      <article class="metric-card"><span>Faturamento pago</span><strong>${money.format(reports.overview.revenue)}</strong></article>
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
        ${renderSimpleReport(reports.products.slice(0, 10), ["name", "quantity", "revenue"], ["Produto", "Qtd.", "Total"], { revenue: "money" })}
      </div>
      <div class="panel">
        <h3>Estoque</h3>
        ${renderSimpleReport(reports.stock.slice(0, 10), ["name", "stock", "estimatedValue"], ["Produto", "Estoque", "Valor"], { estimatedValue: "money" })}
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
  `;
}

function renderAdminSettings() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Configurações da loja</h3>
          <p>Dados usados na vitrine, checkout e comunicação com clientes.</p>
        </div>
      </div>
      <form class="form-grid" data-settings-form>
        <div class="notice wide-field">
          Mercado Pago: <strong>${state.payment.mercadoPagoConfigured ? "token configurado" : "token não configurado"}</strong>.
          Para pagamento real, rode o servidor com <strong>MERCADO_PAGO_ACCESS_TOKEN</strong> e configure uma URL pública HTTPS para webhooks quando publicar.
        </div>
        <label>
          <span>Nome do site</span>
          <input name="siteName" type="text" value="${escapeHtml(state.settings.siteName || "Facas Brazão")}" required />
        </label>
        <label>
          <span>Título SEO</span>
          <input name="seoTitle" type="text" value="${escapeHtml(state.settings.seoTitle || settingFallbacks.seoTitle)}" />
        </label>
        <label>
          <span>Chamada do topo</span>
          <input name="heroEyebrow" type="text" value="${escapeHtml(state.settings.heroEyebrow || settingFallbacks.heroEyebrow)}" />
        </label>
        <label>
          <span>Título da vitrine</span>
          <input name="storeTitle" type="text" value="${escapeHtml(state.settings.storeTitle || settingFallbacks.storeTitle)}" />
        </label>
        <label>
          <span>Título da janela de acesso</span>
          <input name="clientAreaTitle" type="text" value="${escapeHtml(state.settings.clientAreaTitle || settingFallbacks.clientAreaTitle)}" />
        </label>
        <label>
          <span>Título da área admin</span>
          <input name="adminAreaTitle" type="text" value="${escapeHtml(state.settings.adminAreaTitle || settingFallbacks.adminAreaTitle)}" />
        </label>
        <label>
          <span>Título do rodapé</span>
          <input name="footerTitle" type="text" value="${escapeHtml(state.settings.footerTitle || settingFallbacks.footerTitle)}" />
        </label>
        <label>
          <span>WhatsApp</span>
          <input name="whatsapp" type="text" value="${escapeHtml(state.settings.whatsapp || "")}" />
        </label>
        <label>
          <span>Chave PIX</span>
          <input name="pixKey" type="text" value="${escapeHtml(state.settings.pixKey || "")}" />
        </label>
        <label>
          <span>Frete padrão</span>
          <input name="shippingFee" type="number" min="0" step="0.01" value="${Number(state.settings.shippingFee || 0)}" />
        </label>
        <label>
          <span>Frete grátis a partir de</span>
          <input name="freeShippingFrom" type="number" min="0" step="0.01" value="${Number(state.settings.freeShippingFrom || 0)}" />
        </label>
        <label class="wide-field">
          <span>URL pública da loja</span>
          <input name="publicUrl" type="url" placeholder="https://www.facasbrazao.com.br" value="${escapeHtml(state.settings.publicUrl || state.payment.publicUrl || "")}" />
        </label>
        <label class="wide-field">
          <span>Frase principal</span>
          <textarea name="tagline" rows="3">${escapeHtml(state.settings.tagline || settingFallbacks.tagline)}</textarea>
        </label>
        <label class="wide-field">
          <span>Descrição SEO</span>
          <textarea name="seoDescription" rows="2">${escapeHtml(state.settings.seoDescription || settingFallbacks.seoDescription)}</textarea>
        </label>
        <label class="wide-field">
          <span>Texto da vitrine</span>
          <textarea name="storeSubtitle" rows="2">${escapeHtml(state.settings.storeSubtitle || settingFallbacks.storeSubtitle)}</textarea>
        </label>
        <label class="wide-field">
          <span>Texto da janela de acesso</span>
          <textarea name="clientAreaText" rows="2">${escapeHtml(state.settings.clientAreaText || settingFallbacks.clientAreaText)}</textarea>
        </label>
        <label class="wide-field">
          <span>Texto da área admin</span>
          <textarea name="adminAreaText" rows="2">${escapeHtml(state.settings.adminAreaText || settingFallbacks.adminAreaText)}</textarea>
        </label>
        <label class="wide-field">
          <span>Política de envio</span>
          <textarea name="shippingPolicy" rows="3">${escapeHtml(state.settings.shippingPolicy || settingFallbacks.shippingPolicy)}</textarea>
        </label>
        <label class="wide-field">
          <span>Política de troca</span>
          <textarea name="exchangePolicy" rows="3">${escapeHtml(state.settings.exchangePolicy || settingFallbacks.exchangePolicy)}</textarea>
        </label>
        <label class="wide-field">
          <span>Garantia da loja</span>
          <textarea name="warrantyPolicy" rows="3">${escapeHtml(state.settings.warrantyPolicy || settingFallbacks.warrantyPolicy)}</textarea>
        </label>
        <label class="wide-field">
          <span>Cuidados gerais</span>
          <textarea name="carePolicy" rows="3">${escapeHtml(state.settings.carePolicy || settingFallbacks.carePolicy)}</textarea>
        </label>
        <label class="wide-field">
          <span>Mensagem WhatsApp produto</span>
          <textarea name="whatsappProductMessage" rows="2">${escapeHtml(state.settings.whatsappProductMessage || settingFallbacks.whatsappProductMessage)}</textarea>
        </label>
        <label class="wide-field">
          <span>Mensagem WhatsApp checkout</span>
          <textarea name="whatsappCheckoutMessage" rows="2">${escapeHtml(state.settings.whatsappCheckoutMessage || settingFallbacks.whatsappCheckoutMessage)}</textarea>
        </label>
        <label class="wide-field">
          <span>Mensagem WhatsApp atendimento</span>
          <textarea name="whatsappSupportMessage" rows="2">${escapeHtml(state.settings.whatsappSupportMessage || settingFallbacks.whatsappSupportMessage)}</textarea>
        </label>
        <label class="wide-field">
          <span>Texto do rodapé</span>
          <textarea name="footerText" rows="2">${escapeHtml(state.settings.footerText || settingFallbacks.footerText)}</textarea>
        </label>
        <label class="wide-field">
          <span>Endereço ou região de atendimento</span>
          <textarea name="footerAddress" rows="2">${escapeHtml(state.settings.footerAddress || settingFallbacks.footerAddress)}</textarea>
        </label>
        <label>
          <span>Horário de atendimento</span>
          <input name="footerHours" type="text" value="${escapeHtml(state.settings.footerHours || settingFallbacks.footerHours)}" />
        </label>
        <label>
          <span>Documento ou aviso legal</span>
          <input name="footerDocument" type="text" value="${escapeHtml(state.settings.footerDocument || settingFallbacks.footerDocument)}" />
        </label>
        <label class="wide-field">
          <span>Aviso de maioridade</span>
          <textarea name="legalPolicy" rows="3">${escapeHtml(state.settings.legalPolicy || settingFallbacks.legalPolicy)}</textarea>
        </label>
        <button class="button button-primary wide-field" type="submit">Salvar configurações</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Segurança do admin</h3>
          <p>Troque a senha padrão antes de publicar a loja.</p>
        </div>
      </div>
      <form class="form-grid" data-password-form>
        <label>
          <span>Senha atual</span>
          <input name="currentPassword" type="password" required />
        </label>
        <label>
          <span>Nova senha</span>
          <input name="newPassword" type="password" minlength="6" required />
        </label>
        <button class="button button-primary wide-field" type="submit">Alterar senha</button>
        <p class="form-status wide-field" role="status"></p>
      </form>
    </div>
  `;
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
  const [summary, products, orders, customers, coupons, reviews, reports, cash] = await Promise.all([
    api("/api/admin/summary"),
    api("/api/admin/products"),
    api("/api/admin/orders"),
    api("/api/admin/customers"),
    api("/api/admin/coupons"),
    api("/api/admin/reviews"),
    api("/api/admin/reports"),
    api("/api/admin/cash"),
  ]);
  state.admin.summary = summary.summary;
  state.admin.products = products.products;
  state.admin.orders = orders.orders;
  state.admin.customers = customers.customers;
  state.admin.coupons = coupons.coupons;
  state.admin.reviews = reviews.reviews;
  state.admin.reports = reports.reports;
  state.admin.cash = cash.cash;
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap");
  state.settings = payload.settings;
  state.payment = payload.payment || state.payment;
  state.products = payload.products;
  state.user = payload.user;
  renderSettings();
  renderProducts();
  renderReviewShowcase();
  renderCart();
  if (state.user) await loadMyOrders();
  if (state.user?.role === "admin") await loadAdminData();
  renderClientPanel();
  renderAdminShell();
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("payment_id") || params.get("collection_id");
  const paymentStatus = params.get("payment");

  if (paymentId && state.user) {
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
  } else if (paymentStatus === "success") {
    showToast("Pagamento aprovado. O pedido será atualizado pelo Mercado Pago.");
  } else if (paymentStatus === "pending") {
    showToast("Pagamento pendente. A loja atualizará o pedido assim que houver confirmação.");
  } else if (paymentStatus === "failure") {
    showToast("Pagamento não aprovado. Você pode tentar novamente ou combinar com a loja.");
  }

  if (paymentStatus || paymentId) {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
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

async function submitOrder(form) {
  const data = new FormData(form);
  const payload = await api("/api/orders", {
    method: "POST",
    body: {
      items: cartLines().map((item) => ({ productId: item.id, quantity: item.quantity })),
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
    category: data.get("category"),
    price: data.get("price"),
    stock: data.get("stock"),
    badge: data.get("badge"),
    image: data.get("image"),
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
}

async function disableProduct(id) {
  await api(`/api/admin/products/${id}`, { method: "DELETE" });
  showToast("Produto desativado.");
  await loadBootstrap();
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

async function saveSettings(form) {
  const data = new FormData(form);
  await api("/api/admin/settings", {
    method: "PUT",
    body: {
      siteName: data.get("siteName"),
      seoTitle: data.get("seoTitle"),
      seoDescription: data.get("seoDescription"),
      tagline: data.get("tagline"),
      heroEyebrow: data.get("heroEyebrow"),
      storeTitle: data.get("storeTitle"),
      storeSubtitle: data.get("storeSubtitle"),
      clientAreaTitle: data.get("clientAreaTitle"),
      clientAreaText: data.get("clientAreaText"),
      adminAreaTitle: data.get("adminAreaTitle"),
      adminAreaText: data.get("adminAreaText"),
      footerTitle: data.get("footerTitle"),
      footerText: data.get("footerText"),
      footerAddress: data.get("footerAddress"),
      footerHours: data.get("footerHours"),
      footerDocument: data.get("footerDocument"),
      shippingPolicy: data.get("shippingPolicy"),
      exchangePolicy: data.get("exchangePolicy"),
      warrantyPolicy: data.get("warrantyPolicy"),
      legalPolicy: data.get("legalPolicy"),
      carePolicy: data.get("carePolicy"),
      whatsappProductMessage: data.get("whatsappProductMessage"),
      whatsappCheckoutMessage: data.get("whatsappCheckoutMessage"),
      whatsappSupportMessage: data.get("whatsappSupportMessage"),
      whatsapp: data.get("whatsapp"),
      pixKey: data.get("pixKey"),
      shippingFee: data.get("shippingFee"),
      freeShippingFrom: data.get("freeShippingFrom"),
      publicUrl: data.get("publicUrl"),
      minAgeNotice: data.get("legalPolicy"),
    },
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

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const whatsappAnchor = target.closest("[data-whatsapp-link], .button-whatsapp, .whatsapp-inline");
  if (whatsappAnchor && whatsappAnchor.href) {
    event.preventDefault();
    window.location.assign(whatsappAnchor.href);
    return;
  }

  if (target.closest("[data-theme-toggle]")) {
    toggleTheme();
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

  const viewProductButton = target.closest("[data-view-product]");
  if (viewProductButton) {
    openProductDetail(viewProductButton.dataset.viewProduct);
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
    return;
  }

  const adminTabButton = target.closest("[data-admin-tab]");
  if (adminTabButton) {
    state.adminTab = adminTabButton.dataset.adminTab;
    renderAdminShell();
    return;
  }

  const editProductButton = target.closest("[data-edit-product]");
  if (editProductButton) {
    state.editingProductId = editProductButton.dataset.editProduct;
    renderAdminShell();
    document.querySelector("[data-product-form]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (target.closest("[data-new-product]")) {
    state.editingProductId = null;
    renderAdminShell();
    return;
  }

  const disableButton = target.closest("[data-disable-product]");
  if (disableButton) {
    await disableProduct(disableButton.dataset.disableProduct);
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
    if (form.matches("#checkoutForm")) await submitOrder(form);
    if (form.matches("[data-product-form]")) await saveProduct(form);
    if (form.matches("[data-coupon-form]")) await saveCoupon(form);
    if (form.matches("[data-review-form]")) await saveReview(form);
    if (form.matches("[data-settings-form]")) await saveSettings(form);
    if (form.matches("[data-password-form]")) await saveAdminPassword(form);
    if (form.matches("[data-cash-form]")) await saveCashEntry(form);
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
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  if (target.matches('#checkoutForm input[name="couponCode"]')) {
    state.checkout.couponCode = target.value.trim();
    try {
      await refreshCheckoutPricing();
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

window.addEventListener("hashchange", syncAdminRoute);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeCheckout();
    closeProductDetail();
    closeAuthModal();
  }
});

applyTheme();
syncAdminRoute();

loadBootstrap()
  .then(handlePaymentReturn)
  .catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="notice" style="margin: 18px">Não foi possível conectar ao servidor local. Rode <strong>npm start</strong> ou abra pelo endereço do servidor.</div>`,
  );
});
