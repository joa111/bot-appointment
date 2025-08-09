-- Fix RLS policies for queue_counters to allow appointment booking
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Only admins can manage queue counters" ON public.queue_counters;

-- Create separate policies for INSERT and UPDATE (allow public) and DELETE (admin only)
CREATE POLICY "Anyone can create queue counters" 
ON public.queue_counters 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update queue counters" 
ON public.queue_counters 
FOR UPDATE 
USING (true);

CREATE POLICY "Only admins can delete queue counters" 
ON public.queue_counters 
FOR DELETE 
USING (is_admin());