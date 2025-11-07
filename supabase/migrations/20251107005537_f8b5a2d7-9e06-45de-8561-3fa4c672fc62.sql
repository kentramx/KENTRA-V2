-- Create demo_setup_log table to track demo setup usage and prevent abuse
CREATE TABLE IF NOT EXISTS public.demo_setup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on demo_setup_log
ALTER TABLE public.demo_setup_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own setup log
CREATE POLICY "Users can view own demo setup log"
ON public.demo_setup_log
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: System can insert setup logs
CREATE POLICY "System can insert demo setup logs"
ON public.demo_setup_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_demo_setup_log_user_id ON public.demo_setup_log(user_id);