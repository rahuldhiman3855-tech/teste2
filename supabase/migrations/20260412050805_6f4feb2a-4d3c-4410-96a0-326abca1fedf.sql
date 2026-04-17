
-- Add anon policies for knowledge_sources
CREATE POLICY "Anon can view knowledge sources"
ON public.knowledge_sources FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert knowledge sources"
ON public.knowledge_sources FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update knowledge sources"
ON public.knowledge_sources FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete knowledge sources"
ON public.knowledge_sources FOR DELETE TO anon USING (true);

-- Add anon policies for file_sources
CREATE POLICY "Anon can view file sources"
ON public.file_sources FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert file sources"
ON public.file_sources FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update file sources"
ON public.file_sources FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete file sources"
ON public.file_sources FOR DELETE TO anon USING (true);

-- Add anon policies for web_crawler_sources
CREATE POLICY "Anon can view web crawler sources"
ON public.web_crawler_sources FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert web crawler sources"
ON public.web_crawler_sources FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update web crawler sources"
ON public.web_crawler_sources FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete web crawler sources"
ON public.web_crawler_sources FOR DELETE TO anon USING (true);

-- Add anon policies for integration_sources
CREATE POLICY "Anon can view integration sources"
ON public.integration_sources FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert integration sources"
ON public.integration_sources FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update integration sources"
ON public.integration_sources FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete integration sources"
ON public.integration_sources FOR DELETE TO anon USING (true);

-- Add anon policies for source_audit_logs
CREATE POLICY "Anon can view audit logs"
ON public.source_audit_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert audit logs"
ON public.source_audit_logs FOR INSERT TO anon WITH CHECK (true);

-- Add anon policies for source_analytics
CREATE POLICY "Anon can view source analytics"
ON public.source_analytics FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert source analytics"
ON public.source_analytics FOR INSERT TO anon WITH CHECK (true);

-- Add anon storage policy for uploads
CREATE POLICY "Anon can upload to agent-assets"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'agent-assets');
