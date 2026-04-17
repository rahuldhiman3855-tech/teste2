-- Create agent_config table for storing agent settings
CREATE TABLE public.agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (public agent)
CREATE POLICY "Anyone can read agent config"
ON public.agent_config
FOR SELECT
USING (true);

-- Only admins can update config
CREATE POLICY "Admins can manage agent config"
ON public.agent_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default configuration
INSERT INTO public.agent_config (key, value) VALUES
  ('welcome_message', '"Hello! I''m your AI troubleshooting assistant. I''m here to help you diagnose and solve technical issues. What problem are you experiencing today?"'),
  ('agent_name', '"AI Troubleshoot"'),
  ('agent_tagline', '"Your intelligent assistant"'),
  ('primary_color', '"hsl(262, 83%, 58%)"'),
  ('system_prompt', '"You are a helpful AI troubleshooting assistant. Help users diagnose and solve technical issues. Be clear, concise, and provide actionable solutions."');