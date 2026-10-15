ARA: Ordered optional gallery of up to 10 photos + 5 MB limit
==============================================

Files changed:
- products.js: loads image_urls from Supabase.
- product-page.js: gallery with up to four clickable thumbnails.
- admin.html/admin.js: admin can select up to 10 individually numbered JPG/PNG/WebP photo slots; every slot is optional and each selected file is checked against 5 MiB before upload. The saved gallery order follows Image 1, Image 2, ... Image 10.
- style.css: gallery layout.
- ARA-gallery-migration.sql: adds the image_urls column and configures the product-images Storage bucket limit.

IMPORTANT: Do not deploy before running ARA-gallery-migration.sql in Supabase Dashboard > SQL Editor.
This adds image_urls and configures the bucket's server-side maximum file size (5 MiB) and MIME types.
Review your existing Storage RLS policies: uploads should be limited to authenticated/authorized admins.

Existing products:
Existing products may have one or more images. When editing, leave all image slots empty to keep the existing gallery; selecting any photos replaces the gallery with only the selected photos, in numbered slot order. You may use as few as one image or up to ten.

Deploy by replacing the matching files in the same GitHub branch connected to the live Vercel deployment, then test:
1. Open /admin.html and sign in.
2. Add a product and choose any number of photos from 1 to 10 using the numbered slots. Leave unused slots empty.
3. Try a photo larger than 5 MB; it should be rejected before upload.
4. Open the product detail page and click each thumbnail.
5. Check Supabase Storage bucket settings show a 5 MiB limit.


SHOPIFY-INSPIRED STORE DASHBOARD
--------------------------------
Open admin-portal.html after deployment. Sign in using the existing authorized Supabase Auth account.
Dashboard sections: overview, orders, products, inventory, customers, analytics, and settings.
Order status/tracking/payment updates and stock quantity updates write to Supabase and require suitable UPDATE RLS policies for the signed-in admin.
Customer list is derived from order records; settings are intentionally stored in this browser only and are not shared between admins.
The portal uses the existing supabase-config.js publishable key. Never place a Supabase service-role secret in client-side files.
For a GitHub Pages project URL with a repository subpath, existing site pages that use root-relative paths may need a base-path adjustment; this project is configured for a custom domain/root path (see CNAME).


AUTOMATIC INVENTORY FOR ORDERS
-------------------------------
Run ARA-inventory-automation-migration.sql once in Supabase Dashboard > SQL Editor. It adds database triggers so new order items reduce stock, cancellation restores stock, and re-opening a cancelled order deducts it again. If stock is insufficient, creating the order item fails rather than allowing negative stock. This applies to orders created after the migration; existing orders are not backfilled because current stock may already have been adjusted manually. Test with one inexpensive/test product and a test order before going live.

Inventory edits from the admin portal should be verified in Supabase Table Editor > public.products after saving. If the portal says saved but the database row does not change, check that the updated admin-portal.js is deployed and that the signed-in admin has UPDATE and SELECT RLS policies on public.products.


CUSTOMER CART + ORDER CONFIRMATION / TRACKING
--------------------------------------------
New pages: cart.html (dedicated shopping bag) and thank-you.html (confirmation and order tracking form). Successful checkout redirects to thank-you.html?order=ORDER_NUMBER.

For privacy, order tracking calls a separate Supabase Edge Function named track-order; it must validate order_number + customer email and return only that order's limited fields. Deploy the included supabase/functions/track-order/index.ts with Supabase CLI, and set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets (never put the service-role key in browser files). See function source. The thank-you page won't be able to retrieve order status until that function is deployed.

The cart page uses the existing localStorage cart and existing create-order checkout flow. Header cart links should point to cart.html to make the separate cart page discoverable.
