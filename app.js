
(() => {
  "use strict";

  const PRODUCTS_KEY = "ara_products_v1";
  const CART_KEY = "ara_cart_v1";

  const $ = (selector) => document.querySelector(selector);

  const money = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);

  // -----------------------------
  // Local storage helpers
  // -----------------------------

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
    if (Array.isArray(window.ARA_PRODUCTS_FROM_DB)) {
      return window.ARA_PRODUCTS_FROM_DB;
    }

    const saved = readJSON(PRODUCTS_KEY, null);

    return Array.isArray(saved)
      ? saved
      : (window.ARA_DEFAULT_PRODUCTS || []);
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

  // -----------------------------
  // Safe HTML and notifications
  // -----------------------------

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  // -----------------------------
  // Product catalogue
  // -----------------------------

  function renderProducts() {
    const grid = $("#productGrid");
    if (!grid) return;

    const activeFilter =
      document.querySelector(".filter-button.active")
        ?.dataset.category || "all";

    const search = ($("#searchInput")?.value || "")
      .trim()
      .toLowerCase();

    const products = getProducts().filter(
      (product) => product.active !== false
    );

    const filtered = products.filter((product) => {
      const categoryMatch =
        activeFilter === "all" ||
        product.category === activeFilter;

      const searchableText = [
        product.name,
        product.description || "",
        product.category || ""
      ].join(" ").toLowerCase();

      return categoryMatch && searchableText.includes(search);
    });

    grid.innerHTML = filtered.map((product) => `
      <article class="product-card">
        <div class="product-image-wrap">
          <a class="product-image-link" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHTML(product.name)}">
          <img
            class="product-image"
            src="${escapeHTML(product.image || "")}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            onerror="this.style.display='none'; this.parentElement.classList.add('image-missing')"
          >
          </a>
        </div>

        <div class="product-info">
          <span class="product-category">
            ${escapeHTML(product.category || "")}
          </span>

          <h3><a class="product-title-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a></h3>

          <p class="product-description">
            ${escapeHTML(product.description || "")}
          </p>

          <div class="product-buy-row">
            <strong>${money(product.price)}</strong>

            <button
              class="button button-dark add-to-cart"
              type="button"
              data-add="${escapeHTML(product.id)}"
            >
              Add to bag
            </button>
          </div>
        </div>
      </article>
    `).join("");

    const noProducts = $("#noProducts");

    if (noProducts) {
      noProducts.classList.toggle("hidden", filtered.length > 0);
    }
  }

  // -----------------------------
  // Shopping bag
  // -----------------------------

  function addToCart(productId) {
    const product = getProducts().find(
      (item) =>
        String(item.id) === String(productId) &&
        item.active !== false
    );

    if (!product) {
      showToast("This product is no longer available.");
      return;
    }

    const cart = getCart();

    const existing = cart.find(
      (item) => String(item.productId) === String(productId)
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: String(product.id),
        quantity: 1
      });
    }

    saveCart(cart);
    renderCart();
    showToast("Added to your bag.");
  }

  function changeQuantity(productId, delta) {
    const cart = getCart();

    const item = cart.find(
      (entry) => String(entry.productId) === String(productId)
    );

    if (!item) return;

    item.quantity += delta;

    const updated = cart.filter(
      (entry) => entry.quantity > 0
    );

    saveCart(updated);
    renderCart();
  }

  function removeFromCart(productId) {
    const updated = getCart().filter(
      (item) => String(item.productId) !== String(productId)
    );

    saveCart(updated);
    renderCart();
  }

  function cartDetails() {
    const products = getProducts();
    const cart = getCart();

    const lines = cart.map((item) => {
      const product = products.find(
        (entry) =>
          String(entry.id) === String(item.productId)
      );

      if (!product) return null;

      const quantity = Number(item.quantity);

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return null;
      }

      return {
        ...product,
        quantity,
        lineTotal: Number(product.price) * quantity
      };
    }).filter(Boolean);

    const subtotal = lines.reduce(
      (sum, item) => sum + item.lineTotal,
      0
    );

    return { lines, subtotal };
  }

  function renderCart() {
    const { lines, subtotal } = cartDetails();

    const cartItems = $("#cartItems");
    const emptyCart = $("#emptyCart");
    const summary = $("#cartSummary");

    const count = lines.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if ($("#cartCount")) {
      $("#cartCount").textContent = String(count);
    }

    if (cartItems) {
      cartItems.innerHTML = lines.map((item) => `
        <div class="cart-item">
          <img
            src="${escapeHTML(item.image || "")}"
            alt="${escapeHTML(item.name)}"
            onerror="this.style.display='none'"
          >

          <div class="cart-item-info">
            <strong>${escapeHTML(item.name)}</strong>
            <span>${money(item.price)}</span>

            <div class="quantity-controls">
              <button
                type="button"
                aria-label="Decrease quantity"
                data-minus="${escapeHTML(item.id)}"
              >−</button>

              <span>${item.quantity}</span>

              <button
                type="button"
                aria-label="Increase quantity"
                data-plus="${escapeHTML(item.id)}"
              >+</button>

              <button
                type="button"
                class="remove-item"
                data-remove="${escapeHTML(item.id)}"
              >Remove</button>
            </div>
          </div>

          <strong>${money(item.lineTotal)}</strong>
        </div>
      `).join("");
    }

    if (emptyCart) {
      emptyCart.classList.toggle("hidden", lines.length > 0);
    }

    if (summary) {
      summary.classList.toggle("hidden", lines.length === 0);
    }

    if ($("#cartSubtotal")) {
      $("#cartSubtotal").textContent = money(subtotal);
    }
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

  // -----------------------------
  // Checkout form
  // -----------------------------

  function showCheckout() {
    const { lines, subtotal } = cartDetails();

    if (!lines.length) {
      showToast("Your bag is empty.");
      return;
    }

    let modal = $("#checkoutModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "checkoutModal";
      modal.className = "checkout-modal";

      modal.innerHTML = `
        <div
          class="checkout-backdrop"
          data-checkout-close
        ></div>

        <section
          class="checkout-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkoutTitle"
        >
          <button
            class="checkout-close"
            type="button"
            aria-label="Close checkout"
            data-checkout-close
          >×</button>

          <h2 id="checkoutTitle">Delivery details</h2>

          <p class="checkout-total">
            Order subtotal:
            <strong id="checkoutSubtotal"></strong>
          </p>

          <form id="checkoutForm" class="checkout-form">
            <label>
              Full name
              <input
                name="fullName"
                autocomplete="name"
                required
                maxlength="100"
              >
            </label>

            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                autocomplete="tel"
                required
                minlength="7"
                maxlength="20"
              >
            </label>

            <label>
              Email address
              <input
                name="email"
                type="email"
                autocomplete="email"
                required
                maxlength="254"
              >
            </label>

            <label>
              Address line 1
              <input
                name="address1"
                autocomplete="address-line1"
                required
                maxlength="180"
              >
            </label>

            <label>
              Address line 2 (optional)
              <input
                name="address2"
                autocomplete="address-line2"
                maxlength="180"
              >
            </label>

            <div class="checkout-two-col">
              <label>
                City
                <input
                  name="city"
                  autocomplete="address-level2"
                  required
                  maxlength="100"
                >
              </label>

              <label>
                State / Province
                <input
                  name="state"
                  autocomplete="address-level1"
                  required
                  maxlength="100"
                >
              </label>
            </div>

            <div class="checkout-two-col">
              <label>
                Postal / ZIP code
                <input
                  name="postalCode"
                  autocomplete="postal-code"
                  required
                  maxlength="20"
                >
              </label>

              <label>
                Country
                <input
                  name="country"
                  autocomplete="country-name"
                  required
                  maxlength="80"
                  value="India"
                >
              </label>
            </div>

            <label>
              Payment method
              <select name="paymentMethod" required>
                <option value="COD">Cash on delivery</option>
              </select>
            </label>

            <button
              class="button button-dark full-width"
              type="submit"
            >
              Place order
            </button>

            <p class="checkout-disclaimer">
              Your order will be sent to ARA.
              Payment is not processed online.
            </p>

            <p
              id="checkoutStatus"
              class="form-status"
              aria-live="polite"
            ></p>
          </form>
        </section>
      `;

      document.body.appendChild(modal);
    }

    const subtotalElement = $("#checkoutSubtotal");

    if (subtotalElement) {
      subtotalElement.textContent = money(subtotal);
    }

    const status = $("#checkoutStatus");

    if (status) {
      status.textContent = "";
      status.classList.remove("success");
    }

    const submitButton = modal.querySelector(
      '#checkoutForm button[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Place order";
    }

    modal.classList.add("visible");
  }

  // -----------------------------
  // Submit order to Supabase
  // -----------------------------

  async function submitOrder(form) {
    const { lines } = cartDetails();

    if (!lines.length) {
      showToast("Your bag is empty.");
      return;
    }

    const button = form.querySelector(
      'button[type="submit"]'
    );

    const status = $("#checkoutStatus");

    if (
      !window.ARA_SUPABASE_URL ||
      !window.ARA_SUPABASE_PUBLISHABLE_KEY ||
      !window.ARA_SUPABASE_URL.startsWith("https://")
    ) {
      if (status) {
        status.textContent =
          "Checkout is not configured. Please try again later.";
      }
      return;
    }

    // Send product IDs and quantities only.
    // The server must calculate prices from Supabase.
    const items = lines.map((item) => ({
      product_id: Number(item.id),
      quantity: Number(item.quantity)
    }));

    if (items.some((item) =>
      !Number.isSafeInteger(item.product_id) ||
      item.product_id <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 20
    )) {
      if (status) {
        status.textContent =
          "Your cart contains an invalid item. Refresh the page and try again.";
      }
      return;
    }

    const data = new FormData(form);

    const payload = {
      customer_name: String(
        data.get("fullName") || ""
      ).trim(),

      customer_email: String(
        data.get("email") || ""
      ).trim(),

      customer_phone: String(
        data.get("phone") || ""
      ).trim(),

      shipping_address: {
        address1: String(
          data.get("address1") || ""
        ).trim(),

        address2: String(
          data.get("address2") || ""
        ).trim(),

        city: String(
          data.get("city") || ""
        ).trim(),

        state: String(
          data.get("state") || ""
        ).trim(),

        postalCode: String(
          data.get("postalCode") || ""
        ).trim(),

        country: String(
          data.get("country") || ""
        ).trim()
      },

      payment_method: "cash_on_delivery",
      items
    };

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Placing order...";
      }

      if (status) {
        status.textContent = "Submitting your order...";
        status.classList.remove("success");
      }

      const endpoint =
        `${window.ARA_SUPABASE_URL}/functions/v1/create-order`;

      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "apikey": window.ARA_SUPABASE_PUBLISHABLE_KEY,
          "Authorization":
            `Bearer ${window.ARA_SUPABASE_PUBLISHABLE_KEY}`
        },

        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          `Checkout failed (HTTP ${response.status}).`
        );
      }

      // Only clear the bag after the server confirms success.
      saveCart([]);
      renderCart();

      if (status) {
        status.textContent =
          `Order placed successfully! Your order number is ` +
          `${result.order_number}. No online payment was taken.`;

        status.classList.add("success");
      }

      form.reset();

      showToast("Your order has been placed.");

    } catch (error) {
      console.error("ARA checkout error:", error);

      if (status) {
        status.textContent =
          error.message ||
          "We couldn't place your order. Please try again.";
      }

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Place order";
      }
    }
  }

  // -----------------------------
  // Contact form
  // -----------------------------

  function initContactForm() {
    $("#contactForm")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const status = $("#contactStatus");

      if (status) {
        status.textContent =
          "This contact form is not connected to an email service yet.";
      }

      showToast(
        "Contact form needs an email service connection."
      );
    });
  }

  // -----------------------------
  // Click events
  // -----------------------------

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const add = target.closest("[data-add]");
    if (add) {
      addToCart(add.dataset.add);
      return;
    }

    const plus = target.closest("[data-plus]");
    if (plus) {
      changeQuantity(plus.dataset.plus, 1);
      return;
    }

    const minus = target.closest("[data-minus]");
    if (minus) {
      changeQuantity(minus.dataset.minus, -1);
      return;
    }

    const remove = target.closest("[data-remove]");
    if (remove) {
      removeFromCart(remove.dataset.remove);
      return;
    }

    if (target.closest("#cartButton")) {
      openCart();
      return;
    }

    if (
      target.closest("#closeCart") ||
      target.closest("#cartOverlay")
    ) {
      closeCart();
      return;
    }

    if (target.closest("#checkoutButton")) {
      showCheckout();
      return;
    }

    if (target.closest("[data-checkout-close]")) {
      $("#checkoutModal")?.classList.remove("visible");
      return;
    }

    const filter = target.closest(".filter-button");

    if (filter) {
      document.querySelectorAll(".filter-button").forEach(
        (button) => button.classList.remove("active")
      );

      filter.classList.add("active");
      renderProducts();
    }
  });

  // -----------------------------
  // Form submission
  // -----------------------------

  document.addEventListener("submit", (event) => {
    if (event.target.id === "checkoutForm") {
      event.preventDefault();

      if (!event.target.reportValidity()) return;

      submitOrder(event.target);
    }
  });

  // -----------------------------
  // Search and Supabase updates
  // -----------------------------

  $("#searchInput")?.addEventListener(
    "input",
    renderProducts
  );

  window.addEventListener("ara-products-loaded", () => {
    renderProducts();
    renderCart();
  });

  // -----------------------------
  // Initialize storefront
  // -----------------------------

  if (!localStorage.getItem(PRODUCTS_KEY)) {
    saveProducts(window.ARA_DEFAULT_PRODUCTS || []);
  }

  renderProducts();
  renderCart();
  initContactForm();

})();
