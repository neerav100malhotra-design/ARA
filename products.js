// ARA starter catalogue + Supabase storefront loading.
window.ARA_DEFAULT_PRODUCTS = [
  {
    id: "ara-ring-001",
    name: "Classic Silver Ring",
    category: "rings",
    price: 1499,
    image: "images/classic-ring.jpg",
    description: "A simple everyday 925 sterling silver ring.",
    active: true
  },
  {
    id: "ara-necklace-001",
    name: "Everyday Silver Necklace",
    category: "necklaces",
    price: 2299,
    image: "images/everyday-necklace.jpg",
    description: "A timeless necklace in sterling silver.",
    active: true
  },
  {
    id: "ara-earrings-001",
    name: "Silver Stud Earrings",
    category: "earrings",
    price: 999,
    image: "images/silver-studs.jpg",
    description: "Minimal sterling silver stud earrings.",
    active: true
  }
];

// The local catalogue remains a fallback if Supabase isn't configured or reachable.
window.ARA_PRODUCTS_FROM_DB = null;

window.ARA_LOAD_PRODUCTS = async function () {
  const client = window.ARA_SUPABASE_CLIENT;
  if (!client) {
    console.warn("ARA Supabase is not configured yet; showing starter catalogue.");
    return;
  }

  try {
    const { data, error } = await client
      .from("products")
      .select("id, name, slug, description, sku, price, category, image_url, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw error;

    const defaults = window.ARA_DEFAULT_PRODUCTS || [];
    window.ARA_PRODUCTS_FROM_DB = (data || []).map((row) => {
      const category = String(row.category || "").toLowerCase();
      const fallback = defaults.find((item) =>
        item.category === category ||
        String(item.name).toLowerCase().includes(String(row.name || "").toLowerCase())
      );
      return {
        id: String(row.id),
        name: row.name,
        category,
        price: Number(row.price),
        image: row.image_url || (fallback ? fallback.image : ""),
        description: row.description || "",
        active: row.is_active !== false,
        sku: row.sku || "",
        slug: row.slug || ""
      };
    });

    window.dispatchEvent(new CustomEvent("ara-products-loaded"));
  } catch (error) {
    console.error("Could not load ARA products from Supabase:", error.message || error);
    window.dispatchEvent(new CustomEvent("ara-products-load-failed"));
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.ARA_LOAD_PRODUCTS();
});
