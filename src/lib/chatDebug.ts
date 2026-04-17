export interface DebugImage {
  path: string;
  url?: string;
}

export interface DebugChunk {
  result_index: number;
  document_id: string;
  original_filename: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  matched_terms: string[];
  score: number;
  occurrences: number;
  text: string;
  compressed_text?: string;
  image_paths: string[];
  visual_summary?: string;
}

export interface ChatDebugPayload {
  session_id?: string | null;
  source?: "supabase" | "local";
  provider?: string;
  model?: string;
  query?: string;
  rag_used?: boolean;
  rag_context?: string | null;
  retrieved_chunks?: DebugChunk[];
  context_images?: DebugImage[];
}

export function getRagAssetUrl(assetPath: string): string {
  const ragBaseUrl = import.meta.env.VITE_RAG_API_URL || "http://localhost:8080";
  return `${ragBaseUrl}/api/assets/${assetPath}`;
}

export function getChatDebugBaseUrl(): string {
  const chatUrl = import.meta.env.VITE_CHAT_FUNCTION_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  return chatUrl.replace(/\/chat$/, "/debug");
}

export function getSupabaseChatDebugBaseUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  return `${supabaseUrl}/functions/v1/chat/debug`;
}

export function getLocalChatDebugBaseUrl(): string {
  const chatUrl = import.meta.env.VITE_CHAT_FUNCTION_URL || "";
  return chatUrl ? chatUrl.replace(/\/chat$/, "/debug") : "";
}
