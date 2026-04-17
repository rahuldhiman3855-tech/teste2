-- Create feedback table for thumbs up/down and CSAT
CREATE TABLE public.chat_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_log_id UUID REFERENCES public.chat_logs(id) ON DELETE CASCADE,
  user_id UUID,
  rating TEXT CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  csat_score INTEGER CHECK (csat_score >= 1 AND csat_score <= 5),
  is_abandoned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can insert feedback" 
ON public.chat_feedback 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all feedback" 
ON public.chat_feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add response_time_ms column to chat_logs for tracking response times
ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Add is_repeated column to chat_logs for tracking repeated questions
ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS is_repeated BOOLEAN DEFAULT false;