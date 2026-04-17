-- Create enum types for source statuses
CREATE TYPE source_status AS ENUM ('idle', 'running', 'completed', 'failed', 'pending');
CREATE TYPE source_type AS ENUM ('web_crawler', 'file', 'integration');
CREATE TYPE sync_frequency AS ENUM ('manual', 'hourly', 'daily', 'weekly');

-- Knowledge Sources base table
CREATE TABLE public.knowledge_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type source_type NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  status source_status NOT NULL DEFAULT 'idle',
  last_indexed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Web Crawler Sources
CREATE TABLE public.web_crawler_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  seed_url TEXT NOT NULL,
  crawl_entire_domain BOOLEAN NOT NULL DEFAULT false,
  crawl_depth INTEGER NOT NULL DEFAULT 2,
  include_patterns TEXT[] DEFAULT '{}',
  exclude_patterns TEXT[] DEFAULT '{}',
  crawl_frequency sync_frequency NOT NULL DEFAULT 'manual',
  auth_type TEXT, -- 'basic', 'headers', null
  auth_credentials JSONB, -- encrypted in production
  last_crawl_at TIMESTAMP WITH TIME ZONE,
  pages_crawled INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- File Sources
CREATE TABLE public.file_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, docx, txt, csv, xls, ppt
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  content_extracted TEXT,
  indexing_status source_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Integration Sources (CRM, Helpdesk, CMS)
CREATE TABLE public.integration_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- salesforce, hubspot, zendesk, etc.
  auth_type TEXT NOT NULL, -- oauth, api_key
  auth_credentials JSONB, -- encrypted in production
  selected_objects TEXT[] DEFAULT '{}', -- contacts, deals, tickets, etc.
  selected_fields JSONB DEFAULT '{}', -- object -> fields mapping
  sync_frequency sync_frequency NOT NULL DEFAULT 'daily',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  records_synced INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Source Audit Logs
CREATE TABLE public.source_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created, updated, indexed, deleted, enabled, disabled
  details JSONB DEFAULT '{}',
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Source Usage Analytics
CREATE TABLE public.source_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  queries_count INTEGER NOT NULL DEFAULT 0,
  hits_count INTEGER NOT NULL DEFAULT 0,
  avg_relevance_score NUMERIC(5,4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_crawler_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only access)
CREATE POLICY "Admins can manage knowledge sources" 
ON public.knowledge_sources 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage web crawler sources" 
ON public.web_crawler_sources 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage file sources" 
ON public.file_sources 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage integration sources" 
ON public.integration_sources 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view audit logs" 
ON public.source_audit_logs 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view source analytics" 
ON public.source_analytics 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_knowledge_sources_updated_at
BEFORE UPDATE ON public.knowledge_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_web_crawler_sources_updated_at
BEFORE UPDATE ON public.web_crawler_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_file_sources_updated_at
BEFORE UPDATE ON public.file_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_sources_updated_at
BEFORE UPDATE ON public.integration_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();