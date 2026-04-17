/**
 * useRag Hook
 * Provides RAG pipeline data and operations
 * Standalone hook that doesn't interfere with existing useSources hook
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  getRagDocuments,
  searchChunks,
  indexPdf,
  deleteRagDocument,
  checkRagAvailability,
  RagDocument,
  RagStats,
  RagSearchResponse,
} from '@/services/ragService';

export function useRag() {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check availability and fetch documents
  const fetchRagData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const available = await checkRagAvailability();
      setIsAvailable(available);

      if (available) {
        const data = await getRagDocuments();
        setDocuments(data.documents || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load RAG data';
      setError(message);
      setIsAvailable(false);
      console.warn('RAG pipeline unavailable:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRagData();
  }, [fetchRagData]);

  // Index a PDF
  const addDocument = useCallback(
    async (file: File) => {
      try {
        const result = await indexPdf(file);
        await fetchRagData(); // Refresh data
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to index document';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchRagData]
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      try {
        const result = await deleteRagDocument(documentId);
        await fetchRagData();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete document';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [fetchRagData]
  );

  // Search documents
  const search = useCallback(
    async (query: string, options?: Record<string, any>): Promise<RagSearchResponse> => {
      if (!isAvailable) {
        throw new Error('RAG pipeline not available');
      }
      return searchChunks(query, options);
    },
    [isAvailable]
  );

  return {
    documents,
    stats,
    loading,
    isAvailable,
    error,
    refresh: fetchRagData,
    addDocument,
    deleteDocument,
    search,
  };
}
