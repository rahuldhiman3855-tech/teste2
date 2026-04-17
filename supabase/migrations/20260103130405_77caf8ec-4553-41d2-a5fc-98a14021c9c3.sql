-- Update chat_logs policy to allow anyone to insert (including anonymous users)
DROP POLICY IF EXISTS "Users can create their own chat logs" ON public.chat_logs;

CREATE POLICY "Anyone can create chat logs"
ON public.chat_logs
FOR INSERT
WITH CHECK (true);

-- Update chat_feedback policy to allow inserts with matching chat_log_id
-- The "Anyone can insert feedback" policy already exists and allows this