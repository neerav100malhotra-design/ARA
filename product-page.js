(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (n) => new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
  const productId = new URLSearchParams(window.location.search).get("id");
  function getProducts() { return Array.isArray(window.ARA_PRODUCTS_FROM_DB) ? window.ARA_PRODUCTS_FROM_DB : (window.ARA_DEFAULT_PRODUCTS || []); }
  function render() {
    const target = $("#productDetail"); if (!target) return;
    const product = getProducts().find(p => String(p.id) === String(productId) || (p.slug && p.slug === productId));
    if (!product || product.active === false) {
      target.innerHTML = '<div class="product-not-found"><h1>Product not found</h1><p>This item may have been removed or the link may be incorrect.</p><a class="button button-dark" href="shop.html">Return to shop</a></div>';
      document.title = 'Product not found | ARA'; return;
    }
    document.title = `${product.name} | ARA Silver Jewellery`;
    $("#productBreadcrumb").textContent = product.name;
    const image = product.image || "";
    target.innerHTML = `
      <div class="product-detail-image-wrap">${image ? `<img class="product-detail-image" src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" onerror="this.style.display='none';this.nextElementSibling.hidden=false">` : ''}<div class="product-image-placeholder" ${image ? 'hidden' : ''}>ARA</div></div>
      <div class="product-detail-info"><span class="eyebrow">${escapeHTML(product.category || 'ARA collection')}</span><h1>${escapeHTML(product.name)}</h1><p class="product-detail-price">${money(product.price)}</p><p class="product-detail-description">${escapeHTML(product.description || 'A considered piece from the ARA silver jewellery collection.')}</p><div class="product-detail-note"><strong>Everyday silver, thoughtfully chosen.</strong><p>Please check product specifications and availability with ARA before placing your order.</p></div><button class="button button-dark product-add-button" type="button" data-add="${escapeHTML(product.id)}">Add to bag</button><p class="product-shipping-note">Cash on delivery available at checkout, subject to confirmation.</p><a class="back-to-shop" href="shop.html">← Continue shopping</a></div>`;
  }
  document.addEventListener('DOMContentLoaded', () => {
    render();
    window.addEventListener('ara-products-loaded', render);
    window.addEventListener('ara-products-load-failed', render);
  });
})();
