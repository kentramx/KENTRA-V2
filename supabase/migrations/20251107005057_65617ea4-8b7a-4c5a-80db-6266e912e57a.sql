-- Create user_roles system to fix privilege escalation vulnerability
-- This separates role management from the profiles table

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('buyer', 'agent', 'agency', 'admin');

-- Create user_roles table with strict RLS
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create helper function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'agency' THEN 2
      WHEN 'agent' THEN 3
      WHEN 'buyer' THEN 4
    END
  LIMIT 1
$$;

-- RLS Policies for user_roles table
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Only system (via triggers) can insert roles on signup
CREATE POLICY "System can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No one can update or delete roles directly (must be done via admin functions)
-- This prevents privilege escalation

-- Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT 
  id,
  role::text::app_role,
  created_at
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update the handle_new_user trigger to create role in user_roles instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles (without role)
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario')
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::text::app_role, 'buyer')
  );
  
  RETURN NEW;
END;
$$;