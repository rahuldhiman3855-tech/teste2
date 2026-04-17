-- Allow anonymous inserts with null user_id
DROP POLICY IF EXISTS "Users can create their own responses" ON public.saved_responses;
CREATE POLICY "Anyone can create responses" 
ON public.saved_responses 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to view responses (will filter by localStorage IDs in code)
DROP POLICY IF EXISTS "Users can view their own responses" ON public.saved_responses;
CREATE POLICY "Anyone can view responses" 
ON public.saved_responses 
FOR SELECT 
USING (true);

-- Allow anyone to update responses  
DROP POLICY IF EXISTS "Users can update their own responses" ON public.saved_responses;
CREATE POLICY "Anyone can update responses" 
ON public.saved_responses 
FOR UPDATE 
USING (true);

-- Allow anyone to delete responses
DROP POLICY IF EXISTS "Users can delete their own responses" ON public.saved_responses;
CREATE POLICY "Anyone can delete responses" 
ON public.saved_responses 
FOR DELETE 
USING (true);

-- Make user_id nullable for anonymous saves
ALTER TABLE public.saved_responses ALTER COLUMN user_id DROP NOT NULL;

-- Same for categories
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
CREATE POLICY "Anyone can create categories" 
ON public.categories 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Anyone can update categories" 
ON public.categories 
FOR UPDATE 
USING (true);

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Anyone can delete categories" 
ON public.categories 
FOR DELETE 
USING (true);

-- Make categories user_id nullable
ALTER TABLE public.categories ALTER COLUMN user_id DROP NOT NULL;