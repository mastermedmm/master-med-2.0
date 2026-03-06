-- Create storage bucket for NFS-e documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nfse-documentos',
  'nfse-documentos',
  false,
  10485760, -- 10MB
  ARRAY['application/xml', 'text/xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
-- Authenticated users can read documents from their tenant
CREATE POLICY "Tenant users can read nfse documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'nfse-documentos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tenants WHERE id = public.get_user_tenant_id(auth.uid())
  )
);

-- Authenticated users can upload documents for their tenant
CREATE POLICY "Tenant users can upload nfse documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'nfse-documentos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tenants WHERE id = public.get_user_tenant_id(auth.uid())
  )
);

-- No update policy - documents are immutable
-- No delete policy for regular users - documents cannot be deleted

-- Super admins can manage all documents
CREATE POLICY "Super admins can manage nfse documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'nfse-documentos'
  AND public.is_super_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'nfse-documentos'
  AND public.is_super_admin(auth.uid())
);

-- Add storage_path column to documentos_nfse if not exists (already exists per schema)
-- Add hash column for SHA256 integrity check (already exists per schema)
-- Ensure the table supports immutability by removing update capabilities
-- Create policy to prevent updates on documentos_nfse
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documentos_nfse' AND policyname = 'Documents are immutable - no updates'
  ) THEN
    CREATE POLICY "Documents are immutable - no updates"
    ON public.documentos_nfse FOR UPDATE
    TO authenticated
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documentos_nfse' AND policyname = 'Documents cannot be deleted'
  ) THEN
    CREATE POLICY "Documents cannot be deleted"
    ON public.documentos_nfse FOR DELETE
    TO authenticated
    USING (false);
  END IF;
END $$;