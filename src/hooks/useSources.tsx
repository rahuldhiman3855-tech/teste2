import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface KnowledgeSource {
  id: string;
  name: string;
  source_type: 'web_crawler' | 'file' | 'integration';
  is_enabled: boolean;
  priority: number;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'pending';
  last_indexed_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebCrawlerSource {
  id: string;
  source_id: string;
  seed_url: string;
  crawl_entire_domain: boolean;
  crawl_depth: number;
  include_patterns: string[];
  exclude_patterns: string[];
  crawl_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  auth_type: string | null;
  auth_credentials: Record<string, any> | null;
  last_crawl_at: string | null;
  pages_crawled: number;
  created_at: string;
  updated_at: string;
  knowledge_source?: KnowledgeSource;
}

export interface FileSource {
  id: string;
  source_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  tags: string[];
  version: number;
  content_extracted: string | null;
  indexing_status: 'idle' | 'running' | 'completed' | 'failed' | 'pending';
  created_at: string;
  updated_at: string;
  knowledge_source?: KnowledgeSource;
}

export interface IntegrationSource {
  id: string;
  source_id: string;
  integration_type: string;
  auth_type: string;
  auth_credentials: Record<string, any> | null;
  selected_objects: string[];
  selected_fields: Record<string, any>;
  sync_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  last_sync_at: string | null;
  records_synced: number;
  created_at: string;
  updated_at: string;
  knowledge_source?: KnowledgeSource;
}

export interface SourceAuditLog {
  id: string;
  source_id: string;
  action: string;
  details: Record<string, any>;
  performed_by: string | null;
  created_at: string;
}

export function useSources() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [webCrawlers, setWebCrawlers] = useState<WebCrawlerSource[]>([]);
  const [files, setFiles] = useState<FileSource[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSource[]>([]);
  const [auditLogs, setAuditLogs] = useState<SourceAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('knowledge_sources')
        .select('*')
        .order('priority', { ascending: false });

      if (sourcesError) throw sourcesError;
      setSources((sourcesData || []) as KnowledgeSource[]);

      // Fetch web crawlers
      const { data: crawlersData, error: crawlersError } = await supabase
        .from('web_crawler_sources')
        .select('*, knowledge_sources(*)');
      
      if (crawlersError) throw crawlersError;
      setWebCrawlers((crawlersData || []).map((c: any) => ({
        ...c,
        knowledge_source: c.knowledge_sources
      })));

      // Fetch files
      const { data: filesData, error: filesError } = await supabase
        .from('file_sources')
        .select('*, knowledge_sources(*)');
      
      if (filesError) throw filesError;
      setFiles((filesData || []).map((f: any) => ({
        ...f,
        knowledge_source: f.knowledge_sources
      })));

      // Fetch integrations
      const { data: integrationsData, error: integrationsError } = await supabase
        .from('integration_sources')
        .select('*, knowledge_sources(*)');
      
      if (integrationsError) throw integrationsError;
      setIntegrations((integrationsData || []).map((i: any) => ({
        ...i,
        knowledge_source: i.knowledge_sources
      })));

    } catch (error) {
      console.error('Error fetching sources:', error);
      toast({
        title: "Error",
        description: "Failed to fetch knowledge sources",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (sourceId?: string) => {
    try {
      let query = supabase
        .from('source_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAuditLogs((data || []) as SourceAuditLog[]);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  }, []);

  const updateSourceStatus = useCallback(async (
    sourceId: string,
    sourceType: KnowledgeSource['source_type'] | undefined,
    status: KnowledgeSource['status'],
    options?: {
      lastIndexedAt?: string | null;
      errorMessage?: string | null;
    }
  ) => {
    const sourceUpdates: Record<string, unknown> = { status };

    if (options && 'lastIndexedAt' in options) {
      sourceUpdates.last_indexed_at = options.lastIndexedAt;
    }

    if (options && 'errorMessage' in options) {
      sourceUpdates.error_message = options.errorMessage;
    }

    const { error: sourceError } = await supabase
      .from('knowledge_sources')
      .update(sourceUpdates)
      .eq('id', sourceId);

    if (sourceError) {
      throw sourceError;
    }

    if (sourceType === 'file') {
      const { error: fileError } = await supabase
        .from('file_sources')
        .update({ indexing_status: status })
        .eq('source_id', sourceId);

      if (fileError) {
        throw fileError;
      }
    }
  }, []);

  const startIndexingFlow = useCallback(async (
    sourceId: string,
    sourceType?: KnowledgeSource['source_type']
  ) => {
    if (sourceType === 'file') {
      // Use the process-file edge function for real content extraction
      try {
        // Mark as pending in UI immediately
        await updateSourceStatus(sourceId, sourceType, 'running', {
          errorMessage: null,
        });
        await fetchSources();

        const { data, error } = await supabase.functions.invoke('process-file', {
          body: { source_id: sourceId },
        });

        if (error) {
          console.error('Edge function error:', error);
          toast({
            title: "Indexing Failed",
            description: error.message || "Failed to process file",
            variant: "destructive",
          });
        } else {
          console.log('File processed:', data);
        }

        await fetchSources();
      } catch (error) {
        console.error('Error in file indexing:', error);
        await fetchSources();
      }
    } else {
      // For non-file sources, use simple status update (no real processing yet)
      await updateSourceStatus(sourceId, sourceType, 'running', {
        errorMessage: null,
      });
      await fetchSources();

      setTimeout(async () => {
        try {
          await updateSourceStatus(sourceId, sourceType, 'completed', {
            lastIndexedAt: new Date().toISOString(),
            errorMessage: null,
          });
        } catch (error) {
          console.error('Error completing indexing:', error);
        } finally {
          await fetchSources();
        }
      }, 1500);
    }
  }, [fetchSources, updateSourceStatus]);

  const createWebCrawlerSource = async (data: {
    name: string;
    seed_url: string;
    crawl_entire_domain: boolean;
    crawl_depth: number;
    include_patterns: string[];
    exclude_patterns: string[];
    crawl_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
    auth_type?: string;
    auth_credentials?: Record<string, any>;
  }) => {
    try {
      // Create knowledge source first
      const { data: sourceData, error: sourceError } = await supabase
        .from('knowledge_sources')
        .insert({
          name: data.name,
          source_type: 'web_crawler',
          status: 'idle',
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create web crawler source
      const { error: crawlerError } = await supabase
        .from('web_crawler_sources')
        .insert({
          source_id: sourceData.id,
          seed_url: data.seed_url,
          crawl_entire_domain: data.crawl_entire_domain,
          crawl_depth: data.crawl_depth,
          include_patterns: data.include_patterns,
          exclude_patterns: data.exclude_patterns,
          crawl_frequency: data.crawl_frequency,
          auth_type: data.auth_type,
          auth_credentials: data.auth_credentials,
        });

      if (crawlerError) throw crawlerError;

      // Log audit
      await supabase.from('source_audit_logs').insert({
        source_id: sourceData.id,
        action: 'created',
        details: { source_type: 'web_crawler', url: data.seed_url },
      });

      toast({ title: "Success", description: "Web crawler source created" });
      await fetchSources();
      return sourceData;
    } catch (error) {
      console.error('Error creating web crawler:', error);
      toast({
        title: "Error",
        description: "Failed to create web crawler source",
        variant: "destructive",
      });
      throw error;
    }
  };

  const createFileSource = async (data: {
    name: string;
    file_name: string;
    file_type: string;
    file_size: number;
    file_url: string;
    tags?: string[];
  }) => {
    try {
      // Create knowledge source first
      const { data: sourceData, error: sourceError } = await supabase
        .from('knowledge_sources')
        .insert({
          name: data.name,
          source_type: 'file',
          status: 'pending',
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create file source
      const { error: fileError } = await supabase
        .from('file_sources')
        .insert({
          source_id: sourceData.id,
          file_name: data.file_name,
          file_type: data.file_type,
          file_size: data.file_size,
          file_url: data.file_url,
          tags: data.tags || [],
          indexing_status: 'pending',
        });

      if (fileError) throw fileError;

      // Log audit
      await supabase.from('source_audit_logs').insert({
        source_id: sourceData.id,
        action: 'created',
        details: { source_type: 'file', file_name: data.file_name },
      });

      await startIndexingFlow(sourceData.id, 'file');
      toast({ title: "Success", description: "File uploaded and indexing started" });
      return sourceData;
    } catch (error) {
      console.error('Error creating file source:', error);
      toast({
        title: "Error",
        description: "Failed to create file source",
        variant: "destructive",
      });
      throw error;
    }
  };

  const createIntegrationSource = async (data: {
    name: string;
    integration_type: string;
    auth_type: string;
    auth_credentials?: Record<string, any>;
    selected_objects?: string[];
    selected_fields?: Record<string, any>;
    sync_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  }) => {
    try {
      // Create knowledge source first
      const { data: sourceData, error: sourceError } = await supabase
        .from('knowledge_sources')
        .insert({
          name: data.name,
          source_type: 'integration',
          status: 'idle',
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create integration source
      const { error: integrationError } = await supabase
        .from('integration_sources')
        .insert({
          source_id: sourceData.id,
          integration_type: data.integration_type,
          auth_type: data.auth_type,
          auth_credentials: data.auth_credentials,
          selected_objects: data.selected_objects || [],
          selected_fields: data.selected_fields || {},
          sync_frequency: data.sync_frequency,
        });

      if (integrationError) throw integrationError;

      // Log audit
      await supabase.from('source_audit_logs').insert({
        source_id: sourceData.id,
        action: 'created',
        details: { source_type: 'integration', type: data.integration_type },
      });

      toast({ title: "Success", description: "Integration source created" });
      await fetchSources();
      return sourceData;
    } catch (error) {
      console.error('Error creating integration:', error);
      toast({
        title: "Error",
        description: "Failed to create integration source",
        variant: "destructive",
      });
      throw error;
    }
  };

  const toggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('knowledge_sources')
        .update({ is_enabled: enabled })
        .eq('id', sourceId);

      if (error) throw error;

      await supabase.from('source_audit_logs').insert({
        source_id: sourceId,
        action: enabled ? 'enabled' : 'disabled',
        details: {},
      });

      toast({ title: "Success", description: `Source ${enabled ? 'enabled' : 'disabled'}` });
      await fetchSources();
    } catch (error) {
      console.error('Error toggling source:', error);
      toast({
        title: "Error",
        description: "Failed to update source",
        variant: "destructive",
      });
    }
  };

  const deleteSource = async (sourceId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_sources')
        .delete()
        .eq('id', sourceId);

      if (error) throw error;

      toast({ title: "Success", description: "Source deleted" });
      await fetchSources();
    } catch (error) {
      console.error('Error deleting source:', error);
      toast({
        title: "Error",
        description: "Failed to delete source",
        variant: "destructive",
      });
    }
  };

  const updateSourcePriority = async (sourceId: string, priority: number) => {
    try {
      const { error } = await supabase
        .from('knowledge_sources')
        .update({ priority })
        .eq('id', sourceId);

      if (error) throw error;
      await fetchSources();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const triggerReindex = async (sourceId: string) => {
    try {
      const source = sources.find((item) => item.id === sourceId);

      await supabase.from('source_audit_logs').insert({
        source_id: sourceId,
        action: 'reindex_triggered',
        details: {},
      });

      await startIndexingFlow(sourceId, source?.source_type);

      toast({ title: "Success", description: "Re-indexing started" });
    } catch (error) {
      console.error('Error triggering reindex:', error);
      toast({
        title: "Error",
        description: "Failed to trigger re-indexing",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchSources();
    fetchAuditLogs();
  }, [fetchSources, fetchAuditLogs]);

  return {
    sources,
    webCrawlers,
    files,
    integrations,
    auditLogs,
    loading,
    fetchSources,
    fetchAuditLogs,
    createWebCrawlerSource,
    createFileSource,
    createIntegrationSource,
    toggleSource,
    deleteSource,
    updateSourcePriority,
    triggerReindex,
  };
}
