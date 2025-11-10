-- Create admin notification preferences table
CREATE TABLE public.admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_on_bypass BOOLEAN NOT NULL DEFAULT true,
  notify_on_upgrade BOOLEAN NOT NULL DEFAULT true,
  notify_on_downgrade BOOLEAN NOT NULL DEFAULT false,
  use_toast BOOLEAN NOT NULL DEFAULT true,
  use_sound BOOLEAN NOT NULL DEFAULT false,
  use_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view own preferences
CREATE POLICY "Admins can view own notification preferences"
ON public.admin_notification_preferences
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Policy: Admins can insert own preferences
CREATE POLICY "Admins can insert own notification preferences"
ON public.admin_notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Policy: Admins can update own preferences
CREATE POLICY "Admins can update own notification preferences"
ON public.admin_notification_preferences
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);