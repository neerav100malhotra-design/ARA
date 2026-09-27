(() => {
  "use strict";
  const PRODUCTS_KEY = "ara_products_v1";
  const $ = (selector) => document.querySelector(selector);
  const form = $("#productForm");

  function readProducts() {
    try {
      const saved = localStorage.getItem(PRODUCTS_KEY);
      return saved ? JSON.parse(saved) : (window.ARA_DEFAULT_PRODUCTS || []);
    } catch {
      return window.ARA_DEFAULT_PRODUCTS || [];
    }
  }
  function saveProducts(products) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }
  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }
  function money(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function render() {
    const products = readProducts();
    $("#productCount").textContent = `(${products.length})`;
    $("#adminProductList").innerHTML = products.length ? products.map((p) => `
      <article class="admin-product">
        <img src="${escapeHTML(p.image || "")}" alt="${escapeHTML(p.name)}" onerror="this.style.visibility='hidden'">
        <div>
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.category)} · ${money(p.price)} · ${p.active === false ? "Hidden" : "Visible"}</p>
          <p>${escapeHTML(p.description || "")}</p>
        </div>
        <div class="admin-actions">
          <button type="button" data-edit="${escapeHTML(p.id)}">Edit</button>
          <button type="button" class="danger" data-delete="${escapeHTML(p.id)}">Delete</button>
        </div>
      </article>
    `).join("") : "<p>No products yet. Add your first product using the form.</p>";
  }
  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.active.checked = true;
    $("#formHeading").textContent = "Add a product";
    $("#cancelEdit").hidden = true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const id = String(data.get("id") || `ara-${Date.now().toString(36)}`);
    const product = {
      id,
      name: String(data.get("name")).trim(),
      category: String(data.get("category")),
      price: Number(data.get("price")),
      image: String(data.get("image")).trim(),
      description: String(data.get("description") || "").trim(),
      active: form.elements.active.checked
    };
    if (!product.name || !Number.isFinite(product.price) || product.price <= 0) {
      $("#adminStatus").textContent = "Enter a product name and a valid price.";
      return;
    }
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index >= 0) products[index] = product;
    else products.unshift(product);
    saveProducts(products);
    $("#adminStatus").textContent = index >= 0 ? "Product updated in this browser." : "Product added in this browser.";
    resetForm();
    render();
  });

  $("#adminProductList").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    const products = readProducts();
    if (edit) {
      const p = products.find((item) => item.id === edit.dataset.edit);
      if (!p) return;
      for (const key of ["id", "name", "category", "price", "image", "description"]) {
        form.elements[key].value = p[key] ?? "";
      }
      form.elements.active.checked = p.active !== false;
      $("#formHeading").textContent = "Edit product";
      $("#cancelEdit").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (del) {
      const product = products.find((item) => item.id === del.dataset.delete);
      if (!product || !window.confirm(`Delete "${product.name}"?`)) return;
      saveProducts(products.filter((item) => item.id !== del.dataset.delete));
      $("#adminStatus").textContent = "Product deleted in this browser.";
      render();
    }
  });

  $("#cancelEdit").addEventListener("click", resetForm);
  if (!localStorage.getItem(PRODUCTS_KEY)) saveProducts(window.ARA_DEFAULT_PRODUCTS || []);
  render();
})();
