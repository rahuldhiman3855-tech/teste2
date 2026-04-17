ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS rag_context TEXT;

ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS retrieved_chunks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS context_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS debug_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
