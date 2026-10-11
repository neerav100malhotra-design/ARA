-- ARA product gallery migration
-- Run this in Supabase Dashboard -> SQL Editor.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Supabase Storage: create/update the product-images bucket with a hard 5 MiB limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep your existing Storage policies. The admin upload page still requires an
-- authenticated Supabase user; make sure only authorized admins can upload.
