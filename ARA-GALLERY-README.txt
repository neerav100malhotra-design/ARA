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
