-- Add policy to allow anyone to view all feedback (for analytics purposes)
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.chat_feedback;
CREATE POLICY "Anyone can view feedback" 
ON public.chat_feedback 
FOR SELECT 
USING (true);