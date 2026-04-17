-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can manage agent config" ON public.agent_config;

-- Create a permissive policy for anyone to manage config (for development without auth)
CREATE POLICY "Anyone can manage agent config" 
ON public.agent_config 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Also update storage policy for agent-assets bucket
DROP POLICY IF EXISTS "Admins can upload agent assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update agent assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete agent assets" ON storage.objects;

CREATE POLICY "Anyone can upload agent assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'agent-assets');

CREATE POLICY "Anyone can update agent assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'agent-assets');

CREATE POLICY "Anyone can delete agent assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'agent-assets');