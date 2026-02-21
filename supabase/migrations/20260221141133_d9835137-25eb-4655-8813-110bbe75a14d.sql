-- Storage policies for the 'invoices' bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

-- Allow public read (bucket is already public)
CREATE POLICY "Public can read invoices"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'invoices');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');
