ARA: Four-photo product gallery + 5 MB limit
==============================================

Files changed:
- products.js: loads image_urls from Supabase.
- product-page.js: gallery with up to four clickable thumbnails.
- admin.html/admin.js: admin selects exactly four JPG/PNG/WebP photos; each is checked against 5 MiB before upload.
- style.css: gallery layout.
- ARA-gallery-migration.sql: adds the image_urls column and configures the product-images Storage bucket limit.

IMPORTANT: Do not deploy before running ARA-gallery-migration.sql in Supabase Dashboard > SQL Editor.
This adds image_urls and configures the bucket's server-side maximum file size (5 MiB) and MIME types.
Review your existing Storage RLS policies: uploads should be limited to authenticated/authorized admins.

Existing products:
Existing products may only have one image. The storefront will continue to show that image, but to satisfy the new four-photo rule, edit each product in admin.html and upload four photos. The admin form requires four new photos when editing an existing product that does not yet have four gallery URLs.

Deploy by replacing the matching files in the same GitHub branch connected to the live Vercel deployment, then test:
1. Open /admin.html and sign in.
2. Add a product and select exactly four photos.
3. Try a photo larger than 5 MB; it should be rejected before upload.
4. Open the product detail page and click each thumbnail.
5. Check Supabase Storage bucket settings show a 5 MiB limit.
