/**
 * RAG Pipeline Service
 * Handles communication with the RAG pipeline API
 * Minimal integration without impacting existing functionality
 */

const RAG_API_URL = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8080';

export interface RagDocument {
  id: string;
  original_filename: string;
  file_sha256: string;
  page_count: number;
  image_count: number;
  chunk_count: number;
  extraction_method: string;
  created_at_epoch: number;
}

export interface RagStats {
  document_count: number;
  total_chunks: number;
  total_images: number;
}

export interface RagSearchResult {
  id: number;
  document_id: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  text: string;
}

export interface RagSearchResponse {
  terms: string[];
  case_sensitive: boolean;
  exact_phrase: boolean;
  results: RagSearchResult[];
}

export interface RagIndexResponse {
  status: 'success' | 'already_indexed' | 'error';
  document: RagDocument;
  error?: string;
}

export interface RagDeleteResponse {
  status: 'deleted';
  document_id: string;
}

/**
 * Index a PDF file in the RAG pipeline
 */
export async function indexPdf(file: File): Promise<RagIndexResponse> {
  const formData = new FormData();
  formData.append('pdf', file);

  const response = await fetch(`${RAG_API_URL}/api/index`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to index PDF: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search chunks in the RAG pipeline
 */
export async function searchChunks(
  query: string,
  options?: {
    limit?: number;
    case_sensitive?: boolean;
    exact_phrase?: boolean;
    document_id?: string;
    min_matches?: number;
  }
): Promise<RagSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    ...(options?.limit && { limit: options.limit.toString() }),
    ...(options?.case_sensitive && { case_sensitive: 'true' }),
    ...(options?.exact_phrase && { exact_phrase: 'true' }),
    ...(options?.document_id && { document_id: options.document_id }),
    ...(options?.min_matches && { min_matches: options.min_matches.toString() }),
  });

  const response = await fetch(`${RAG_API_URL}/api/search?${params}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get RAG pipeline documents and statistics
 */
export async function getRagDocuments(): Promise<{
  stats: RagStats;
  documents: RagDocument[];
}> {
  const response = await fetch(`${RAG_API_URL}/api/documents`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a document from the RAG pipeline
 */
export async function deleteRagDocument(documentId: string): Promise<RagDeleteResponse> {
  const response = await fetch(`${RAG_API_URL}/api/documents/${documentId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if RAG pipeline is available
 */
export async function checkRagAvailability(): Promise<boolean> {
  try {
    await getRagDocuments();
    return true;
  } catch {
    return false;
  }
}
