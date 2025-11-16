-- Create secure phone_verifications table
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT DEFAULT 0 NOT NULL,
  max_attempts INT DEFAULT 5 NOT NULL,
  blocked_until TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  request_count_hour INT DEFAULT 1 NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- No SELECT policies for users - only service_role can read verification codes
-- This prevents users from reading their own verification codes

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON public.phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires_at ON public.phone_verifications(expires_at);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_phone_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phone_verifications_updated_at
  BEFORE UPDATE ON public.phone_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_phone_verifications_updated_at();