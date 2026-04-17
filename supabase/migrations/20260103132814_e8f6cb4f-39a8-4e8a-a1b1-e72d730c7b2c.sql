-- Create chat_sessions table to track user sessions
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_messages INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_sessions
CREATE POLICY "Admins can view all chat sessions"
ON public.chat_sessions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create chat sessions"
ON public.chat_sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update their own sessions"
ON public.chat_sessions
FOR UPDATE
USING (true);

-- Add session_id to chat_logs to link messages to sessions
ALTER TABLE public.chat_logs 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.chat_sessions(id);

-- Add topic column to chat_logs for categorization
ALTER TABLE public.chat_logs 
ADD COLUMN IF NOT EXISTS topic TEXT;

-- Add confidence_score to chat_logs (calculated based on response quality)
ALTER TABLE public.chat_logs 
ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

-- Create chat_analytics table for aggregated daily stats
CREATE TABLE public.chat_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  thumbs_up_count INTEGER NOT NULL DEFAULT 0,
  thumbs_down_count INTEGER NOT NULL DEFAULT 0,
  topics JSONB DEFAULT '{}'::jsonb,
  peak_hour INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on chat_analytics
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_analytics
CREATE POLICY "Admins can view all analytics"
ON public.chat_analytics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert analytics"
ON public.chat_analytics
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update analytics"
ON public.chat_analytics
FOR UPDATE
USING (true);

-- Create function to update chat_analytics when chat_logs are inserted
CREATE OR REPLACE FUNCTION public.update_chat_analytics()
RETURNS TRIGGER AS $$
DECLARE
  log_date DATE;
  current_topics JSONB;
BEGIN
  log_date := DATE(NEW.created_at);
  
  -- Try to get existing topics for the date
  SELECT topics INTO current_topics FROM public.chat_analytics WHERE date = log_date;
  
  -- Update topic count if topic is set
  IF NEW.topic IS NOT NULL AND current_topics IS NOT NULL THEN
    current_topics := jsonb_set(
      current_topics,
      ARRAY[NEW.topic],
      to_jsonb(COALESCE((current_topics->>NEW.topic)::integer, 0) + 1)
    );
  ELSIF NEW.topic IS NOT NULL THEN
    current_topics := jsonb_build_object(NEW.topic, 1);
  ELSE
    current_topics := '{}'::jsonb;
  END IF;
  
  -- Upsert analytics for the date
  INSERT INTO public.chat_analytics (date, total_conversations, total_messages, unique_users, avg_response_time_ms, topics, peak_hour)
  VALUES (
    log_date,
    1,
    1,
    CASE WHEN NEW.user_id IS NOT NULL THEN 1 ELSE 0 END,
    NEW.response_time_ms,
    current_topics,
    EXTRACT(HOUR FROM NEW.created_at)::integer
  )
  ON CONFLICT (date) DO UPDATE SET
    total_messages = chat_analytics.total_messages + 1,
    avg_response_time_ms = CASE 
      WHEN NEW.response_time_ms IS NOT NULL THEN 
        (COALESCE(chat_analytics.avg_response_time_ms, 0) * chat_analytics.total_messages + NEW.response_time_ms) / (chat_analytics.total_messages + 1)
      ELSE chat_analytics.avg_response_time_ms
    END,
    topics = CASE 
      WHEN NEW.topic IS NOT NULL THEN 
        jsonb_set(
          COALESCE(chat_analytics.topics, '{}'::jsonb),
          ARRAY[NEW.topic],
          to_jsonb(COALESCE((chat_analytics.topics->>NEW.topic)::integer, 0) + 1)
        )
      ELSE chat_analytics.topics
    END,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update analytics on chat_log insert
CREATE TRIGGER update_analytics_on_chat
AFTER INSERT ON public.chat_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_analytics();

-- Create function to update feedback counts in analytics
CREATE OR REPLACE FUNCTION public.update_feedback_analytics()
RETURNS TRIGGER AS $$
DECLARE
  log_date DATE;
BEGIN
  -- Get the date from the associated chat_log
  SELECT DATE(created_at) INTO log_date 
  FROM public.chat_logs 
  WHERE id = NEW.chat_log_id;
  
  IF log_date IS NOT NULL THEN
    INSERT INTO public.chat_analytics (date, thumbs_up_count, thumbs_down_count)
    VALUES (
      log_date,
      CASE WHEN NEW.rating = 'thumbs_up' THEN 1 ELSE 0 END,
      CASE WHEN NEW.rating = 'thumbs_down' THEN 1 ELSE 0 END
    )
    ON CONFLICT (date) DO UPDATE SET
      thumbs_up_count = chat_analytics.thumbs_up_count + CASE WHEN NEW.rating = 'thumbs_up' THEN 1 ELSE 0 END,
      thumbs_down_count = chat_analytics.thumbs_down_count + CASE WHEN NEW.rating = 'thumbs_down' THEN 1 ELSE 0 END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update analytics on feedback insert
CREATE TRIGGER update_analytics_on_feedback
AFTER INSERT ON public.chat_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_feedback_analytics();