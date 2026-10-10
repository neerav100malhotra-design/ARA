
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const form = $("#productForm");
  const client = window.ARA_SUPABASE_CLIENT;
  const BUCKET = "product-images";
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  let products = [];
  let saving = false;

  if (!form) {
    console.error("ARA admin: #productForm was not found.");
    return;
  }

  // ---------- Login interface ----------

  const login = document.createElement("section");
  login.className = "admin-card";
  login.id = "adminLogin";

  login.innerHTML = `
    <h2>ARA administrator login</h2>
    <form id="loginForm" class="admin-form">
      <label>Email
        <input name="email" type="email"
          autocomplete="username" required>
      </label>
      <label>Password
        <input name="password" type="password"
          autocomplete="current-password" required>
      </label>
      <button class="button button-dark" type="submit">
        Sign in
      </button>
      <p id="loginStatus" class="admin-status"
        aria-live="polite"></p>
    </form>
  `;

  const adminWrap = $(".admin-wrap");
  const adminLayout = $(".admin-layout");

  if (!adminWrap || !adminLayout) {
    console.error("ARA admin: required page containers are missing.");
    return;
  }

  adminWrap.insertBefore(login, adminLayout);
  adminLayout.hidden = true;

  const note = $(".admin-note");
  if (note) {
    note.textContent =
      "Sign in with your authorized ARA account to manage products.";
  }

  // ---------- Status messages ----------

  function status(message, isError = false) {
    const element = $("#adminStatus");
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#a32626" : "#28633a";
  }

  function loginStatus(message, isError = false) {
    const element = $("#loginStatus");
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#a32626" : "#28633a";
  }

  // ---------- Helpers ----------

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function normalise(product) {
    return {
      id: product.id,
      name: product.name || "",
      category: (product.category || "rings").toLowerCase(),
      price: Number(product.price) || 0,
      image: product.image_url || "",
      description: product.description || "",
      active: product.is_active !== false
    };
  }

  function getFileInput() {
    return form.querySelector('input[type="file"]');
  }

  function getImageURLInput() {
    // Prefer the existing optional URL input.
    return form.querySelector(
      'input[name="image"][type="url"], ' +
      'input[name="image"][type="text"], ' +
      'input[name="image_url"][type="url"], ' +
      'input[name="image_url"][type="text"]'
    );
  }

  function setSaving(isSaving) {
    saving = isSaving;

    const submitButton = form.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = isSaving;
      submitButton.textContent = isSaving
        ? "Saving…"
        : "Save product";
    }
  }

  // ---------- Image upload ----------

  async function uploadProductImage(file) {
    if (!file || !file.size) {
      throw new Error("Please choose a product image.");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Use a JPG, PNG, or WebP image.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("The image must be 5 MB or smaller.");
    }

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      throw new Error("Could not verify your login session.");
    }

    if (!sessionData.session) {
      throw new Error("Please sign in before uploading images.");
    }

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[file.type];

    // Unique names prevent accidental overwrites.
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw new Error(
        "Image upload failed: " + uploadError.message
      );
    }

    const { data } = client.storage
      .from(BUCKET)
      .getPublicUrl(path);

    if (!data || !data.publicUrl) {
      throw new Error("Could not generate the public image URL.");
    }

    return {
      url: data.publicUrl,
      path
    };
  }

  // ---------- Load products ----------

  async function loadProducts() {
    status("Loading products…");

    const { data, error } = await client
      .from("products")
      .select(
        "id,name,category,price,image_url,description,is_active"
      )
      .order("id", { ascending: false });

    if (error) {
      status("Couldn't load products: " + error.message, true);
      return false;
    }

    products = (data || []).map(normalise);
    render();

    status("Products loaded from Supabase.");
    return true;
  }

  // ---------- Render product list ----------

  function render() {
    const count = $("#productCount");
    const list = $("#adminProductList");

    if (!count || !list) return;

    count.textContent = `(${products.length})`;

    if (!products.length) {
      list.innerHTML = "<p>No products yet. Add one using the form.</p>";
      return;
    }

    list.innerHTML = products.map((product) => `
      <article class="admin-product">
        ${
          product.image
            ? `<img src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.name)}"
                loading="lazy"
                onerror="this.style.visibility='hidden'">`
            : `<div class="admin-image-placeholder">
                No product image
              </div>`
        }
        <div>
          <h3>${escapeHTML(product.name)}</h3>
          <p>
            ${escapeHTML(product.category)} ·
            ${money(product.price)} ·
            ${product.active ? "Visible" : "Hidden"}
          </p>
          <p>${escapeHTML(product.description)}</p>
        </div>
        <div class="admin-actions">
          <button type="button"
            data-edit="${escapeHTML(product.id)}">
            Edit
          </button>
          <button type="button" class="danger"
            data-delete="${escapeHTML(product.id)}">
            Delete
          </button>
        </div>
      </article>
    `).join("");
  }

  // ---------- Reset form ----------

  function resetForm() {
    form.reset();

    if (form.elements.id) {
      form.elements.id.value = "";
    }

    if (form.elements.active) {
      form.elements.active.checked = true;
    }

    const fileInput = getFileInput();
    if (fileInput) fileInput.value = "";

    const heading = $("#formHeading");
    if (heading) heading.textContent = "Add a product";

    const cancelButton = $("#cancelEdit");
    if (cancelButton) cancelButton.hidden = true;
  }

  // ---------- Admin login state ----------

  async function showAdmin(user) {
    login.hidden = true;
    adminLayout.hidden = false;

    let logout = $("#araLogout");

    if (!logout) {
      logout = document.createElement("button");
      logout.id = "araLogout";
      logout.className = "button";
      logout.textContent = "Sign out";

      const top = $(".admin-top");
      if (top) top.appendChild(logout);

      logout.addEventListener("click", async () => {
        const { error } = await client.auth.signOut();

        if (error) {
          status("Sign-out failed: " + error.message, true);
        }
      });
    }

    status("Signed in as " + (user.email || "ARA administrator"));
    await loadProducts();
  }

  function showLogin() {
    login.hidden = false;
    adminLayout.hidden = true;

    const logout = $("#araLogout");
    if (logout) logout.remove();
  }

  // ---------- Sign in ----------

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!client) {
      loginStatus(
        "Supabase client unavailable. Check configuration.",
        true
      );
      return;
    }

    const loginForm = event.currentTarget;
    const data = new FormData(loginForm);

    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    const button = loginForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    loginStatus("Signing in…");

    try {
      const { data: result, error } =
        await client.auth.signInWithPassword({ email, password });

      if (error) {
        loginStatus("Sign-in failed. Check your credentials.", true);
        return;
      }

      loginStatus("");
      await showAdmin(result.user);
    } catch (error) {
      loginStatus(error.message || "Sign-in failed.", true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  // ---------- Add or edit a product ----------

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (saving || !form.reportValidity()) return;

    if (!client) {
      status("Supabase client is unavailable.", true);
      return;
    }

    const data = new FormData(form);
    const rawId = String(data.get("id") || "");
    const name = String(data.get("name") || "").trim();
    const price = Number(data.get("price"));
    const category = String(data.get("category") || "rings");
    const description = String(data.get("description") || "").trim();

    if (!name || !Number.isFinite(price) || price <= 0) {
      status("Enter a product name and a valid price.", true);
      return;
    }

    const existing = rawId
      ? products.find((product) => String(product.id) === rawId)
      : null;

    if (rawId && !existing) {
      status("Product not found. Reload and try again.", true);
      return;
    }

    const fileInput = getFileInput();
    const imageFile = fileInput?.files?.[0] || null;
    const urlInput = getImageURLInput();

    let imageUrl = String(urlInput?.value || "").trim();
    let newlyUploadedPath = null;

    // Keep the old image if editing and no replacement is selected.
    if (!imageUrl && existing) {
      imageUrl = existing.image;
    }

    setSaving(true);

    try {
      if (imageFile) {
        status("Uploading image to Supabase Storage…");

        const uploaded = await uploadProductImage(imageFile);
        imageUrl = uploaded.url;
        newlyUploadedPath = uploaded.path;
      }

      if (!imageUrl) {
        status(
          "Choose an image file or enter an image URL.",
          true
        );
        return;
      }

      if (!/^https?:\/\//i.test(imageUrl)) {
        status("The image URL must start with http:// or https://.", true);
        return;
      }

      const product = {
        name,
        category,
        price,
        image_url: imageUrl,
        description,
        is_active: Boolean(form.elements.active?.checked)
      };

      status("Saving product details…");

      let result;

      if (existing) {
        result = await client
          .from("products")
          .update(product)
          .eq("id", existing.id)
          .select("id");
      } else {
        result = await client
          .from("products")
          .insert(product)
          .select("id");
      }

      if (result.error) {
        // Best-effort cleanup of a new upload if DB save fails.
        if (newlyUploadedPath) {
          await client.storage
            .from(BUCKET)
            .remove([newlyUploadedPath]);
        }

        status("Product save failed: " + result.error.message, true);
        return;
      }

      if (!result.data || result.data.length === 0) {
        status(
          "No product row was changed. Check the products table policies.",
          true
        );
        return;
      }

      resetForm();

      const refreshed = await loadProducts();

      if (refreshed) {
        status(
          existing
            ? "Product updated successfully."
            : "Product added successfully."
        );
      }
    } catch (error) {
      status(error.message || "Unexpected error saving product.", true);
    } finally {
      setSaving(false);
    }
  });

  // ---------- Edit and delete buttons ----------

  const productList = $("#adminProductList");

  if (productList) {
    productList.addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");

      if (editButton) {
        const product = products.find(
          (item) => String(item.id) === editButton.dataset.edit
        );

        if (!product) return;

        for (const key of [
          "id", "name", "category", "price", "description"
        ]) {
          if (form.elements[key]) {
            form.elements[key].value = product[key] ?? "";
          }
        }

        const urlInput = getImageURLInput();
        if (urlInput) urlInput.value = product.image || "";

        const fileInput = getFileInput();
        if (fileInput) fileInput.value = "";

        if (form.elements.active) {
          form.elements.active.checked = product.active;
        }

        const heading = $("#formHeading");
        if (heading) heading.textContent = "Edit product";

        const cancelButton = $("#cancelEdit");
        if (cancelButton) cancelButton.hidden = false;

        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (deleteButton) {
        const product = products.find(
          (item) => String(item.id) === deleteButton.dataset.delete
        );

        if (!product) return;

        const confirmed = window.confirm(
          `Delete "${product.name}" from the catalogue?`
        );

        if (!confirmed) return;

        status("Deleting product…");

        const { data, error } = await client
          .from("products")
          .delete()
          .eq("id", product.id)
          .select("id");

        if (error) {
          status("Delete failed: " + error.message, true);
          return;
        }

        if (!data || data.length === 0) {
          status(
            "No product was deleted. Check the products table policies.",
            true
          );
          return;
        }

        resetForm();
        await loadProducts();
        status("Product deleted.");
      }
    });
  }

  // ---------- Cancel editing ----------

  const cancelButton = $("#cancelEdit");
  if (cancelButton) {
    cancelButton.addEventListener("click", resetForm);
  }

  // ---------- Initialize ----------

  async function init() {
    if (!client) {
      loginStatus(
        "Supabase client unavailable. Check script order and configuration.",
        true
      );
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();

      if (error) {
        loginStatus("Couldn't check login session.", true);
        return;
      }

      if (data.session) {
        await showAdmin(data.session.user);
      } else {
        showLogin();
      }

      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          showLogin();
        } else if (event === "SIGNED_IN") {
          // Defer async work out of the auth callback.
          Promise.resolve().then(() => showAdmin(session.user));
        }
      });
    } catch (error) {
      loginStatus(error.message || "Could not initialize admin.", true);
    }
  }

  init();
})();
