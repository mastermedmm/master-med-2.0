-- Create storage bucket for banners
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true);

-- Policy: authenticated users can upload banners
CREATE POLICY "Authenticated users can upload banners" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'banners');

-- Policy: authenticated users can update banners
CREATE POLICY "Authenticated users can update banners" 
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'banners');

-- Policy: authenticated users can delete banners
CREATE POLICY "Authenticated users can delete banners" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'banners');

-- Policy: public can view banners
CREATE POLICY "Public can view banners" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'banners');

-- Insert new system setting for banner
INSERT INTO system_settings (key, value, description) 
VALUES ('doctor_portal_banner', NULL, 'URL da imagem do banner do Portal do Médico');