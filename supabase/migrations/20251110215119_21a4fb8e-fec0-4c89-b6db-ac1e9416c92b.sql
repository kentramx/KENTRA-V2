-- Create table to track property expiry reminders sent
CREATE TABLE IF NOT EXISTS public.property_expiry_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  days_before INTEGER NOT NULL CHECK (days_before IN (7, 3, 1)),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, days_before)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expiry_reminders_property ON public.property_expiry_reminders(property_id);
CREATE INDEX IF NOT EXISTS idx_expiry_reminders_agent ON public.property_expiry_reminders(agent_id);
CREATE INDEX IF NOT EXISTS idx_expiry_reminders_sent_at ON public.property_expiry_reminders(sent_at);

-- Enable RLS
ALTER TABLE public.property_expiry_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can view their own reminders
CREATE POLICY "Agents can view their own expiry reminders"
  ON public.property_expiry_reminders
  FOR SELECT
  USING (auth.uid() = agent_id);

-- Policy: Service role can insert reminders
CREATE POLICY "Service role can insert expiry reminders"
  ON public.property_expiry_reminders
  FOR INSERT
  WITH CHECK (true);