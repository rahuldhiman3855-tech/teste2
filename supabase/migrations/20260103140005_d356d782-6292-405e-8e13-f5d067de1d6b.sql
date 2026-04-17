-- Allow anyone to view their own sessions (by session_id stored in localStorage)
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.chat_sessions;
CREATE POLICY "Anyone can view sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (true);

-- Allow anyone to delete sessions
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.chat_sessions;
CREATE POLICY "Anyone can delete sessions" 
ON public.chat_sessions 
FOR DELETE 
USING (true);

-- Allow anyone to view chat logs
DROP POLICY IF EXISTS "Users can view their own chat logs" ON public.chat_logs;
CREATE POLICY "Anyone can view chat logs" 
ON public.chat_logs 
FOR SELECT 
USING (true);

-- Allow anyone to delete chat logs
DROP POLICY IF EXISTS "Users can delete their own chat logs" ON public.chat_logs;
CREATE POLICY "Anyone can delete chat logs" 
ON public.chat_logs 
FOR DELETE 
USING (true);