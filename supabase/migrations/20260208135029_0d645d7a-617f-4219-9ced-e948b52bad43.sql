-- Create storage bucket for agent assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-assets', 'agent-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for agent-assets bucket
CREATE POLICY "Authenticated users can upload to agent-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-assets');

CREATE POLICY "Anyone can view agent-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-assets');

CREATE POLICY "Authenticated users can update agent-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-assets');

CREATE POLICY "Authenticated users can delete from agent-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-assets');

-- Fix RLS policies for knowledge_sources - allow any authenticated user to manage sources
-- First drop the existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage knowledge sources" ON public.knowledge_sources;

-- Create new policies that allow authenticated users
CREATE POLICY "Authenticated users can view knowledge sources"
ON public.knowledge_sources FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert knowledge sources"
ON public.knowledge_sources FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update knowledge sources"
ON public.knowledge_sources FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete knowledge sources"
ON public.knowledge_sources FOR DELETE
TO authenticated
USING (true);

-- Fix file_sources policies
DROP POLICY IF EXISTS "Admins can manage file sources" ON public.file_sources;

CREATE POLICY "Authenticated users can view file sources"
ON public.file_sources FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert file sources"
ON public.file_sources FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update file sources"
ON public.file_sources FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete file sources"
ON public.file_sources FOR DELETE
TO authenticated
USING (true);

-- Fix web_crawler_sources policies
DROP POLICY IF EXISTS "Admins can manage web crawler sources" ON public.web_crawler_sources;

CREATE POLICY "Authenticated users can view web crawler sources"
ON public.web_crawler_sources FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert web crawler sources"
ON public.web_crawler_sources FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update web crawler sources"
ON public.web_crawler_sources FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete web crawler sources"
ON public.web_crawler_sources FOR DELETE
TO authenticated
USING (true);

-- Fix integration_sources policies  
DROP POLICY IF EXISTS "Admins can manage integration sources" ON public.integration_sources;

CREATE POLICY "Authenticated users can view integration sources"
ON public.integration_sources FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert integration sources"
ON public.integration_sources FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update integration sources"
ON public.integration_sources FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete integration sources"
ON public.integration_sources FOR DELETE
TO authenticated
USING (true);

-- Fix source_audit_logs policies
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.source_audit_logs;

CREATE POLICY "Authenticated users can view audit logs"
ON public.source_audit_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.source_audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix source_analytics policies
DROP POLICY IF EXISTS "Admins can manage source analytics" ON public.source_analytics;

CREATE POLICY "Authenticated users can view source analytics"
ON public.source_analytics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert source analytics"
ON public.source_analytics FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update source analytics"
ON public.source_analytics FOR UPDATE
TO authenticated
USING (true);