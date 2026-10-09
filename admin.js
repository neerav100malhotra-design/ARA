
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const form = $("#productForm");
  const client = window.ARA_SUPABASE_CLIENT;
  let products = [];

  // Add a login panel without replacing the existing page design.
  const login = document.createElement("section");
  login.className = "admin-card";
  login.id = "adminLogin";
  login.innerHTML = `
    <h2>ARA administrator login</h2>
    <form id="loginForm" class="admin-form">
      <label>Email
        <input name="email" type="email" autocomplete="username" required>
      </label>
      <label>Password
        <input name="password" type="password"
          autocomplete="current-password" required>
      </label>
      <button class="button button-dark" type="submit">Sign in</button>
      <p id="loginStatus" class="admin-status" aria-live="polite"></p>
    </form>
  `;
  $(".admin-wrap").insertBefore(login, $(".admin-layout"));
  $(".admin-layout").hidden = true;

  // Replace the prototype warning.
  const note = document.querySelector(".admin-note");
  if (note) {
    note.textContent =
      "Sign in with your authorized ARA account to manage products.";
  }

  function status(message, isError = false) {
    $("#adminStatus").textContent = message;
    $("#adminStatus").style.color = isError ? "#a32626" : "#28633a";
  }

  function loginStatus(message, isError = false) {
    $("#loginStatus").textContent = message;
    $("#loginStatus").style.color = isError ? "#a32626" : "#28633a";
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function normalise(p) {
    return {
      id: p.id,
      name: p.name || "",
      category: (p.category || "rings").toLowerCase(),
      price: Number(p.price) || 0,
      image: p.image_url || "",
      description: p.description || "",
      active: p.is_active !== false
    };
  }

  async function loadProducts() {
    status("Loading products…");

    const { data, error } = await client
      .from("products")
      .select("id,name,category,price,image_url,description,is_active")
      .order("id", { ascending: false });

    if (error) {
      status("Couldn't load products: " + error.message, true);
      return;
    }

    products = data.map(normalise);
    render();
    status("Products loaded from Supabase.");
  }

  function render() {
    $("#productCount").textContent = `(${products.length})`;

    $("#adminProductList").innerHTML = products.length
      ? products.map((p) => `
        <article class="admin-product">
          <img src="${escapeHTML(p.image)}"
            alt="${escapeHTML(p.name)}"
            onerror="this.style.visibility='hidden'">
          <div>
            <h3>${escapeHTML(p.name)}</h3>
            <p>${escapeHTML(p.category)} · ${money(p.price)} ·
              ${p.active ? "Visible" : "Hidden"}</p>
            <p>${escapeHTML(p.description)}</p>
          </div>
          <div class="admin-actions">
            <button type="button" data-edit="${escapeHTML(p.id)}">Edit</button>
            <button type="button" class="danger"
              data-delete="${escapeHTML(p.id)}">Delete</button>
          </div>
        </article>
      `).join("")
      : "<p>No products yet. Add one using the form.</p>";
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.active.checked = true;
    $("#formHeading").textContent = "Add a product";
    $("#cancelEdit").hidden = true;
  }

  async function showAdmin(user) {
    login.hidden = true;
    $(".admin-layout").hidden = false;

    let logout = $("#araLogout");
    if (!logout) {
      logout = document.createElement("button");
      logout.id = "araLogout";
      logout.className = "button";
      logout.textContent = "Sign out";
      $(".admin-top").appendChild(logout);

      logout.addEventListener("click", async () => {
        const { error } = await client.auth.signOut();
        if (error) status(error.message, true);
      });
    }

    status("Signed in as " + user.email);
    await loadProducts();
  }

  function showLogin() {
    login.hidden = false;
    $(".admin-layout").hidden = true;
    const logout = $("#araLogout");
    if (logout) logout.remove();
  }

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      loginStatus("Supabase didn't load. Check the script configuration.", true);
      return;
    }

    const data = new FormData(event.currentTarget);
    const { data: result, error } = await client.auth.signInWithPassword({
      email: String(data.get("email")).trim(),
      password: String(data.get("password"))
    });

    if (error) {
      loginStatus("Sign-in failed. Check your email and password.", true);
      return;
    }

    loginStatus("");
    await showAdmin(result.user);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const rawId = String(data.get("id") || "");
    const price = Number(data.get("price"));
    const name = String(data.get("name") || "").trim();

    if (!name || !Number.isFinite(price) || price <= 0) {
      status("Enter a product name and a valid price.", true);
      return;
    }

    const product = {
      name,
      category: String(data.get("category")),
      price,
      image_url: String(data.get("image") || "").trim(),
      description: String(data.get("description") || "").trim(),
      is_active: form.elements.active.checked
    };

    let query;
    if (rawId) {
      const existing = products.find((p) => String(p.id) === rawId);
      if (!existing) {
        status("Product not found. Reload the list and try again.", true);
        return;
      }

      query = client.from("products")
        .update(product)
        .eq("id", existing.id);
    } else {
      query = client.from("products").insert(product);
    }

    const { error } = await query;

    if (error) {
      status("Save failed: " + error.message, true);
      return;
    }

    resetForm();
    await loadProducts();
    status(rawId ? "Product updated." : "Product added.");
  });

  $("#adminProductList").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      const p = products.find(
        (item) => String(item.id) === edit.dataset.edit
      );
      if (!p) return;

      for (const key of ["id", "name", "category", "price",
                         "image", "description"]) {
        form.elements[key].value = p[key] ?? "";
      }

      form.elements.active.checked = p.active;
      $("#formHeading").textContent = "Edit product";
      $("#cancelEdit").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (del) {
      const p = products.find(
        (item) => String(item.id) === del.dataset.delete
      );
      if (!p || !window.confirm(`Delete "${p.name}"?`)) return;

      const { error } = await client
        .from("products")
        .delete()
        .eq("id", p.id);

      if (error) {
        status("Delete failed: " + error.message, true);
        return;
      }

      resetForm();
      await loadProducts();
      status("Product deleted.");
    }
  });

  $("#cancelEdit").addEventListener("click", resetForm);

  async function init() {
    if (!client) {
      loginStatus(
        "Supabase client unavailable. Check script order and configuration.",
        true
      );
      return;
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      loginStatus("Couldn't check login session: " + error.message, true);
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
        showAdmin(session.user);
      }
    });
  }

  init();
})();
