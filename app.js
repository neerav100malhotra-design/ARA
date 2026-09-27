(() => {
  "use strict";

  const PRODUCTS_KEY = "ara_products_v1";
  const CART_KEY = "ara_cart_v1";
  const ORDERS_KEY = "ara_orders_v1";

  const $ = (selector) => document.querySelector(selector);
  const money = (amount) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(Number(amount) || 0);

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Could not read ${key}`, error);
      return fallback;
    }
  }

  function getProducts() {
    const saved = readJSON(PRODUCTS_KEY, null);
    return Array.isArray(saved) ? saved : (window.ARA_DEFAULT_PRODUCTS || []);
  }

  function saveProducts(products) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }

  function getCart() {
    return readJSON(CART_KEY, []);
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function renderProducts() {
    const grid = $("#productGrid");
    if (!grid) return;

    const activeFilter = document.querySelector(".filter-button.active")?.dataset.category || "all";
    const search = ($("#searchInput")?.value || "").trim().toLowerCase();
    const products = getProducts().filter((p) => p.active !== false);
    const filtered = products.filter((p) => {
      const categoryMatch = activeFilter === "all" || p.category === activeFilter;
      const searchMatch = `${p.name} ${p.description || ""} ${p.category}`.toLowerCase().includes(search);
      return categoryMatch && searchMatch;
    });

    grid.innerHTML = filtered.map((p) => `
      <article class="product-card">
        <div class="product-image-wrap">
          <img class="product-image" src="${escapeHTML(p.image || "")}" alt="${escapeHTML(p.name)}"
               loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('image-missing')">
        </div>
        <div class="product-info">
          <span class="product-category">${escapeHTML(p.category || "")}</span>
          <h3>${escapeHTML(p.name)}</h3>
          <p class="product-description">${escapeHTML(p.description || "")}</p>
          <div class="product-buy-row">
            <strong>${money(p.price)}</strong>
            <button class="button button-dark add-to-cart" type="button" data-add="${escapeHTML(p.id)}">Add to bag</button>
          </div>
        </div>
      </article>
    `).join("");

    const noProducts = $("#noProducts");
    if (noProducts) noProducts.classList.toggle("hidden", filtered.length > 0);
  }

  function addToCart(productId) {
    const product = getProducts().find((p) => p.id === productId && p.active !== false);
    if (!product) return showToast("This product is no longer available.");

    const cart = getCart();
    const existing = cart.find((item) => item.productId === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ productId, quantity: 1 });
    saveCart(cart);
    renderCart();
    showToast("Added to your bag.");
  }

  function changeQuantity(productId, delta) {
    const cart = getCart();
    const item = cart.find((entry) => entry.productId === productId);
    if (!item) return;
    item.quantity += delta;
    const updated = cart.filter((entry) => entry.quantity > 0);
    saveCart(updated);
    renderCart();
  }

  function removeFromCart(productId) {
    saveCart(getCart().filter((item) => item.productId !== productId));
    renderCart();
  }

  function cartDetails() {
    const products = getProducts();
    const cart = getCart();
    const lines = cart.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { ...product, quantity: item.quantity, lineTotal: product.price * item.quantity } : null;
    }).filter(Boolean);
    return { lines, subtotal: lines.reduce((sum, item) => sum + item.lineTotal, 0) };
  }

  function renderCart() {
    const { lines, subtotal } = cartDetails();
    const cartItems = $("#cartItems");
    const emptyCart = $("#emptyCart");
    const summary = $("#cartSummary");
    const count = lines.reduce((sum, item) => sum + item.quantity, 0);

    if ($("#cartCount")) $("#cartCount").textContent = String(count);
    if (cartItems) {
      cartItems.innerHTML = lines.map((item) => `
        <div class="cart-item">
          <img src="${escapeHTML(item.image || "")}" alt="${escapeHTML(item.name)}"
               onerror="this.style.display='none'">
          <div class="cart-item-info">
            <strong>${escapeHTML(item.name)}</strong>
            <span>${money(item.price)}</span>
            <div class="quantity-controls">
              <button type="button" aria-label="Decrease quantity" data-minus="${escapeHTML(item.id)}">−</button>
              <span>${item.quantity}</span>
              <button type="button" aria-label="Increase quantity" data-plus="${escapeHTML(item.id)}">+</button>
              <button type="button" class="remove-item" data-remove="${escapeHTML(item.id)}">Remove</button>
            </div>
          </div>
          <strong>${money(item.lineTotal)}</strong>
        </div>
      `).join("");
    }
    if (emptyCart) emptyCart.classList.toggle("hidden", lines.length > 0);
    if (summary) summary.classList.toggle("hidden", lines.length === 0);
    if ($("#cartSubtotal")) $("#cartSubtotal").textContent = money(subtotal);
  }

  function openCart() {
    $("#cartPanel")?.classList.add("open");
    $("#cartOverlay")?.classList.remove("hidden");
    document.body.classList.add("cart-open");
  }

  function closeCart() {
    $("#cartPanel")?.classList.remove("open");
    $("#cartOverlay")?.classList.add("hidden");
    document.body.classList.remove("cart-open");
  }

  function showCheckout() {
    const { lines, subtotal } = cartDetails();
    if (!lines.length) return showToast("Your bag is empty.");

    let modal = $("#checkoutModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "checkoutModal";
      modal.className = "checkout-modal";
      modal.innerHTML = `
        <div class="checkout-backdrop" data-checkout-close></div>
        <section class="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
          <button class="checkout-close" type="button" aria-label="Close checkout" data-checkout-close>×</button>
          <h2 id="checkoutTitle">Delivery details</h2>
          <p class="checkout-total">Order subtotal: <strong id="checkoutSubtotal"></strong></p>
          <form id="checkoutForm" class="checkout-form">
            <label>Full name<input name="fullName" autocomplete="name" required maxlength="100"></label>
            <label>Phone number<input name="phone" type="tel" autocomplete="tel" required minlength="7" maxlength="20"></label>
            <label>Email address<input name="email" type="email" autocomplete="email" required></label>
            <label>Address line 1<input name="address1" autocomplete="address-line1" required maxlength="180"></label>
            <label>Address line 2 (optional)<input name="address2" autocomplete="address-line2" maxlength="180"></label>
            <div class="checkout-two-col">
              <label>City<input name="city" autocomplete="address-level2" required></label>
              <label>State / Province<input name="state" autocomplete="address-level1" required></label>
            </div>
            <div class="checkout-two-col">
              <label>Postal / ZIP code<input name="postalCode" autocomplete="postal-code" required></label>
              <label>Country<input name="country" autocomplete="country-name" required value="India"></label>
            </div>
            <label>Payment preference
              <select name="paymentMethod" required>
                <option value="COD">Cash on delivery (if available)</option>
                <option value="Online payment">Online payment (payment link to be arranged)</option>
              </select>
            </label>
            <button class="button button-dark full-width" type="submit">Place demo order</button>
            <p class="checkout-disclaimer">Demo checkout only. No payment is processed and no order is sent to ARA.</p>
            <p id="checkoutStatus" class="form-status" aria-live="polite"></p>
          </form>
        </section>`;
      document.body.appendChild(modal);
    }
    $("#checkoutSubtotal").textContent = money(subtotal);
    modal.classList.add("visible");
  }

  function submitOrder(form) {
    const { lines, subtotal } = cartDetails();
    if (!lines.length) return;

    const formData = new FormData(form);
    const address = Object.fromEntries(formData.entries());
    const order = {
      orderId: `ARA-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      customer: address,
      items: lines.map(({ id, name, price, quantity }) => ({ productId: id, name, price, quantity })),
      subtotal,
      status: "Demo order — not transmitted"
    };

    const orders = readJSON(ORDERS_KEY, []);
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    saveCart([]);
    renderCart();

    const status = $("#checkoutStatus");
    if (status) {
      status.textContent = `Demo order ${order.orderId} saved in this browser. No payment was taken.`;
      status.classList.add("success");
    }
    form.querySelector('button[type="submit"]').disabled = true;
    showToast("Demo order saved.");
  }

  function initContactForm() {
    $("#contactForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = $("#contactStatus");
      if (status) status.textContent = "This demo form is not connected to an email service yet.";
      showToast("Contact form needs an email service connection.");
    });
  }

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) return addToCart(add.dataset.add);

    const plus = event.target.closest("[data-plus]");
    if (plus) return changeQuantity(plus.dataset.plus, 1);

    const minus = event.target.closest("[data-minus]");
    if (minus) return changeQuantity(minus.dataset.minus, -1);

    const remove = event.target.closest("[data-remove]");
    if (remove) return removeFromCart(remove.dataset.remove);

    if (event.target.closest("#cartButton")) return openCart();
    if (event.target.closest("#closeCart") || event.target.closest("#cartOverlay")) return closeCart();
    if (event.target.closest("#checkoutButton")) return showCheckout();

    if (event.target.closest("[data-checkout-close]")) {
      $("#checkoutModal")?.classList.remove("visible");
    }
  });

  document.addEventListener("click", (event) => {
    const filter = event.target.closest(".filter-button");
    if (!filter) return;
    document.querySelectorAll(".filter-button").forEach((button) => button.classList.remove("active"));
    filter.classList.add("active");
    renderProducts();
  });

  $("#searchInput")?.addEventListener("input", renderProducts);

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "checkoutForm") return;
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    submitOrder(event.target);
  });

  // Seed the browser catalogue only once. Admin changes are saved in this browser.
  if (!localStorage.getItem(PRODUCTS_KEY)) {
    saveProducts(window.ARA_DEFAULT_PRODUCTS || []);
  }

  renderProducts();
  renderCart();
  initContactForm();
})(); 
