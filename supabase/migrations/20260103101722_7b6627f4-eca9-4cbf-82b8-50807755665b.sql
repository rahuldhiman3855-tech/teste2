-- Create storage bucket for agent logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-assets', 'agent-assets', true);

-- Allow anyone to view agent assets (public bucket)
CREATE POLICY "Anyone can view agent assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-assets');

-- Allow admins to upload agent assets
CREATE POLICY "Admins can upload agent assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to update agent assets
CREATE POLICY "Admins can update agent assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete agent assets
CREATE POLICY "Admins can delete agent assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);