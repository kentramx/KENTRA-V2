-- =====================================================
-- SCRIPT COMPLETO DE MIGRACIÓN: KENTRA
-- Para ejecutar en Supabase SQL Editor
-- =====================================================
-- IMPORTANTE: Ejecutar en orden, sección por sección
-- Tiempo estimado: 2-3 minutos
-- =====================================================

-- =====================================================
-- SECCIÓN 1: EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- SECCIÓN 2: TIPOS ENUM PERSONALIZADOS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('buyer', 'agent', 'agency', 'developer', 'moderator', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE property_status AS ENUM ('borrador', 'pendiente_aprobacion', 'activa', 'pausada', 'expirada', 'vendida', 'rentada', 'rechazada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE property_type AS ENUM ('casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'edificio', 'rancho', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_moderation_status AS ENUM ('pending', 'approved', 'rejected', 'manual_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_action AS ENUM ('submitted', 'approved', 'rejected', 'resubmitted', 'auto_approved', 'auto_rejected', 'auto_flagged', 'manual_override');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- SECCIÓN 3: TABLAS PRINCIPALES
-- =====================================================

-- 3.1 Profiles (usuarios)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  is_verified BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  whatsapp_number TEXT,
  whatsapp_verified BOOLEAN DEFAULT false,
  whatsapp_verified_at TIMESTAMPTZ,
  whatsapp_business_hours TEXT,
  phone_verified BOOLEAN DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  phone_verification_code TEXT,
  phone_verification_expires_at TIMESTAMPTZ,
  status user_status NOT NULL DEFAULT 'active',
  suspended_at TIMESTAMPTZ,
  suspended_by UUID,
  suspended_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.2 User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'buyer',
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 3.3 Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL,
  price_yearly NUMERIC,
  currency TEXT DEFAULT 'MXN',
  features JSONB NOT NULL DEFAULT '{}',
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.4 User Subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  featured_used_this_month INTEGER DEFAULT 0,
  featured_reset_date TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 3.5 Agencies
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.6 Agency Agents
CREATE TABLE IF NOT EXISTS public.agency_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'agent',
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, agent_id)
);

-- 3.7 Agency Invitations
CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 Developers
CREATE TABLE IF NOT EXISTS public.developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.9 Developer Team
CREATE TABLE IF NOT EXISTS public.developer_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'sales',
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(developer_id, user_id)
);

-- 3.10 Developer Projects
CREATE TABLE IF NOT EXISTS public.developer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  gallery JSONB DEFAULT '[]',
  address TEXT,
  city TEXT,
  state TEXT,
  lat NUMERIC,
  lng NUMERIC,
  total_units INTEGER DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  delivery_date DATE,
  amenities JSONB DEFAULT '[]',
  status TEXT DEFAULT 'planning',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.11 Developer Invitations
CREATE TABLE IF NOT EXISTS public.developer_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'sales',
  token UUID DEFAULT gen_random_uuid(),
  status invitation_status DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.12 Properties
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.developer_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  property_code TEXT,
  type property_type NOT NULL,
  listing_type TEXT DEFAULT 'sale',
  for_sale BOOLEAN DEFAULT false,
  for_rent BOOLEAN DEFAULT false,
  price NUMERIC NOT NULL,
  sale_price NUMERIC,
  rent_price NUMERIC,
  currency TEXT DEFAULT 'MXN',
  address TEXT NOT NULL,
  municipality TEXT NOT NULL,
  state TEXT NOT NULL,
  colonia TEXT,
  lat NUMERIC,
  lng NUMERIC,
  geom geometry(Point, 4326),
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking INTEGER,
  sqft NUMERIC,
  lot_size NUMERIC,
  amenities JSONB,
  video_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  status property_status DEFAULT 'borrador',
  expires_at TIMESTAMPTZ,
  last_renewed_at TIMESTAMPTZ,
  price_history JSONB,
  resubmission_count INTEGER DEFAULT 0,
  rejection_history JSONB,
  requires_manual_review BOOLEAN DEFAULT false,
  ai_moderation_status ai_moderation_status,
  ai_moderation_score NUMERIC,
  ai_moderation_notes TEXT,
  ai_moderated_at TIMESTAMPTZ,
  duplicate_warning BOOLEAN DEFAULT false,
  duplicate_warning_data JSONB,
  has_inappropriate_images BOOLEAN DEFAULT false,
  has_manipulated_images BOOLEAN DEFAULT false,
  images_analyzed_count INTEGER DEFAULT 0,
  images_quality_avg NUMERIC,
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.13 Images
CREATE TABLE IF NOT EXISTS public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.14 Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- 3.15 Saved Searches
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.16 Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, agent_id, property_id)
);

-- 3.17 Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  image_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.18 Conversation Participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(conversation_id, user_id)
);

-- 3.19 Agent Reviews
CREATE TABLE IF NOT EXISTS public.agent_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, agent_id)
);

-- 3.20 Badge Definitions
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  requirements JSONB NOT NULL DEFAULT '{}',
  is_secret BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.21 User Badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES public.badge_definitions(code),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);

-- 3.22 Featured Properties
CREATE TABLE IF NOT EXISTS public.featured_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  featured_type TEXT NOT NULL DEFAULT 'standard',
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  cost NUMERIC,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'active',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.23 Property Views
CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.24 Property Moderation History
CREATE TABLE IF NOT EXISTS public.property_moderation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  admin_id UUID REFERENCES auth.users(id),
  action moderation_action NOT NULL,
  previous_data JSONB,
  rejection_reason JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.25 Identity Verifications (KYC)
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  address TEXT,
  curp TEXT,
  ine_front_url TEXT,
  ine_back_url TEXT,
  rfc_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.26 KYC Verification History
CREATE TABLE IF NOT EXISTS public.kyc_verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.identity_verifications(id) ON DELETE CASCADE,
  reviewed_by UUID,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.27 Payment History
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'MXN',
  status TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.28 Pending Payments
CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  checkout_session_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.29 Payment Disputes
CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'mxn',
  status TEXT NOT NULL,
  reason TEXT,
  evidence_submitted BOOLEAN DEFAULT false,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.30 Promotion Coupons
CREATE TABLE IF NOT EXISTS public.promotion_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  stripe_coupon_id TEXT NOT NULL,
  stripe_promotion_code_id TEXT,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  currency TEXT DEFAULT 'mxn',
  applies_to TEXT,
  max_redemptions INTEGER,
  times_redeemed INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  campaign_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.31 Coupon Redemptions
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.promotion_coupons(id),
  user_id UUID REFERENCES auth.users(id),
  plan_id UUID REFERENCES public.subscription_plans(id),
  discount_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'mxn',
  stripe_session_id TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- 3.32 Subscription Changes
CREATE TABLE IF NOT EXISTS public.subscription_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_plan_id UUID REFERENCES public.subscription_plans(id),
  new_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  previous_billing_cycle TEXT,
  new_billing_cycle TEXT NOT NULL,
  change_type TEXT NOT NULL,
  prorated_amount NUMERIC,
  metadata JSONB DEFAULT '{}',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.33 Subscription Audit Log
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.34 Upsells
CREATE TABLE IF NOT EXISTS public.upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  upsell_type TEXT DEFAULT 'other',
  user_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stripe_price_id TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Plus',
  badge TEXT,
  quantity_per_upsell INTEGER DEFAULT 1,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.35 User Active Upsells
CREATE TABLE IF NOT EXISTS public.user_active_upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upsell_id UUID NOT NULL REFERENCES public.upsells(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.36 Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_new_messages BOOLEAN DEFAULT true,
  email_new_properties BOOLEAN DEFAULT false,
  email_price_changes BOOLEAN DEFAULT false,
  email_saved_searches BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT false,
  push_new_messages BOOLEAN DEFAULT true,
  push_new_properties BOOLEAN DEFAULT false,
  push_price_changes BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.37 Admin Notification Preferences
CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notify_on_bypass BOOLEAN NOT NULL DEFAULT true,
  notify_on_upgrade BOOLEAN NOT NULL DEFAULT true,
  notify_on_downgrade BOOLEAN NOT NULL DEFAULT false,
  use_toast BOOLEAN NOT NULL DEFAULT true,
  use_sound BOOLEAN NOT NULL DEFAULT false,
  use_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.38 Newsletter Subscriptions
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  user_id UUID REFERENCES auth.users(id),
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.39 Phone Verifications
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  request_count_hour INTEGER NOT NULL DEFAULT 1,
  last_request_at TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.40 Conversion Events
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'facebook_pixel',
  value NUMERIC,
  currency TEXT DEFAULT 'MXN',
  user_email TEXT,
  user_role TEXT,
  content_name TEXT,
  content_category TEXT,
  session_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.41 Property Expiry Reminders
CREATE TABLE IF NOT EXISTS public.property_expiry_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  days_before INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.42 Property Expiration Log
CREATE TABLE IF NOT EXISTS public.property_expiration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  property_title TEXT NOT NULL,
  property_created_at TIMESTAMPTZ NOT NULL,
  last_renewed_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ DEFAULT now()
);

-- 3.43 Property Assignment History
CREATE TABLE IF NOT EXISTS public.property_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  previous_agent_id UUID,
  new_agent_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.44 Geocoding Cache
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key TEXT NOT NULL UNIQUE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  components JSONB,
  hits INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.45 Auth Tokens
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.46 App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3.47 Demo Setup Log
CREATE TABLE IF NOT EXISTS public.demo_setup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.48 Processed Webhook Events
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.49 Stripe Webhook Events
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.50 Trial Tracking
CREATE TABLE IF NOT EXISTS public.trial_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.51 WhatsApp Interactions
CREATE TABLE IF NOT EXISTS public.whatsapp_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  property_id UUID REFERENCES public.properties(id),
  agent_id UUID REFERENCES auth.users(id),
  interaction_type TEXT NOT NULL,
  phone_number TEXT,
  message_preview TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.52 Image AI Analysis
CREATE TABLE IF NOT EXISTS public.image_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
  quality_score NUMERIC,
  resolution_score NUMERIC,
  lighting_score NUMERIC,
  composition_score NUMERIC,
  is_blurry BOOLEAN DEFAULT false,
  is_dark BOOLEAN DEFAULT false,
  is_inappropriate BOOLEAN DEFAULT false,
  is_manipulated BOOLEAN DEFAULT false,
  detected_issues TEXT[],
  ai_notes TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SECCIÓN 4: ÍNDICES DE RENDIMIENTO
-- =====================================================

-- Índices para properties
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON public.properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_agency_id ON public.properties(agency_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_state ON public.properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_municipality ON public.properties(municipality);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_expires_at ON public.properties(expires_at);
CREATE INDEX IF NOT EXISTS idx_properties_search_location ON public.properties(state, municipality, status);
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng_brin ON public.properties USING BRIN (lat, lng) WITH (pages_per_range = 128);

-- Índice geoespacial PostGIS
CREATE INDEX IF NOT EXISTS idx_properties_geom ON public.properties USING GIST (geom);

-- Índices para búsqueda full-text
CREATE INDEX IF NOT EXISTS idx_properties_search_vector ON public.properties USING GIN (search_vector);

-- Índices para user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub_id ON public.user_subscriptions(stripe_subscription_id);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Índices para favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_property_id ON public.favorites(property_id);

-- Índices para property_views
CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON public.property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_viewed_at ON public.property_views(viewed_at DESC);

-- Índices para payment_history
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON public.payment_history(created_at DESC);

-- Índices para geocoding_cache
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_normalized_key ON public.geocoding_cache(normalized_key);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON public.conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations(agent_id);

-- =====================================================
-- SECCIÓN 5: FUNCIONES DE BASE DE DATOS
-- =====================================================

-- 5.1 Función is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role = 'super_admin'
  );
END;
$$;

-- 5.2 Función has_role
CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role = check_role
  );
END;
$$;

-- 5.3 Función has_admin_access
CREATE OR REPLACE FUNCTION public.has_admin_access(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid 
    AND role IN ('admin', 'super_admin', 'moderator')
  );
END;
$$;

-- 5.4 Handle new user (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Crear perfil
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  
  -- Asignar rol por defecto (buyer)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

-- 5.5 Can create property with upsells
CREATE OR REPLACE FUNCTION public.can_create_property_with_upsells(user_uuid UUID)
RETURNS TABLE(can_create BOOLEAN, reason TEXT, current_count INTEGER, max_allowed INTEGER, additional_slots INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  base_max_props INTEGER;
  current_props INTEGER;
  sub_status TEXT;
  extra_slots INTEGER := 0;
  total_max INTEGER;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE user_id = user_uuid LIMIT 1;
  SELECT COUNT(*) INTO current_props FROM properties WHERE agent_id = user_uuid AND status = 'activa';
  
  IF user_role = 'buyer' THEN
    IF current_props < 1 THEN
      RETURN QUERY SELECT true, 'Puedes publicar tu primera propiedad gratis'::TEXT, current_props, 1, 0;
    ELSE
      RETURN QUERY SELECT false, 'Ya tienes 1 propiedad publicada. Conviértete en Agente para publicar más.'::TEXT, current_props, 1, 0;
    END IF;
    RETURN;
  END IF;
  
  IF user_role IN ('agent', 'agency') THEN
    SELECT us.status, (sp.features->>'max_properties')::INTEGER
    INTO sub_status, base_max_props
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = user_uuid AND us.status IN ('active', 'trialing');
    
    IF sub_status IS NULL THEN
      RETURN QUERY SELECT false, 'Necesitas una suscripción activa para publicar propiedades'::TEXT, current_props, 0, 0;
      RETURN;
    END IF;
    
    -- Calcular slots adicionales de upsells activos
    SELECT COALESCE(SUM(uau.quantity * u.quantity_per_upsell), 0)
    INTO extra_slots
    FROM user_active_upsells uau
    JOIN upsells u ON u.id = uau.upsell_id
    WHERE uau.user_id = user_uuid
      AND uau.status = 'active'
      AND u.upsell_type = 'slot_propiedad'
      AND (uau.end_date IS NULL OR uau.end_date > NOW());
    
    IF base_max_props = -1 THEN
      RETURN QUERY SELECT true, 'Propiedades ilimitadas'::TEXT, current_props, -1, extra_slots;
      RETURN;
    END IF;
    
    total_max := base_max_props + extra_slots;
    
    IF current_props < total_max THEN
      RETURN QUERY SELECT true, format('Puedes publicar %s propiedades más', total_max - current_props)::TEXT, current_props, total_max, extra_slots;
    ELSE
      RETURN QUERY SELECT false, format('Has alcanzado tu límite de %s propiedades', total_max)::TEXT, current_props, total_max, extra_slots;
    END IF;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT false, 'Rol no válido'::TEXT, 0, 0, 0;
END;
$$;

-- 5.6 Can feature property
CREATE OR REPLACE FUNCTION public.can_feature_property(user_uuid UUID)
RETURNS TABLE(can_feature BOOLEAN, reason TEXT, featured_used INTEGER, featured_limit INTEGER, plan_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_featured_limit INTEGER;
  v_featured_used INTEGER;
  v_plan_name TEXT;
  v_reset_date TIMESTAMPTZ;
BEGIN
  SELECT 
    (sp.features->>'featured_listings')::INTEGER,
    COALESCE(us.featured_used_this_month, 0),
    sp.display_name,
    us.featured_reset_date
  INTO v_featured_limit, v_featured_used, v_plan_name, v_reset_date
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = user_uuid 
    AND us.status = 'active';

  IF v_featured_limit IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      'No tienes una suscripción activa'::TEXT,
      0,
      0,
      ''::TEXT;
    RETURN;
  END IF;

  IF v_reset_date IS NOT NULL AND v_reset_date <= NOW() THEN
    UPDATE user_subscriptions
    SET 
      featured_used_this_month = 0,
      featured_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE user_id = user_uuid AND status = 'active';
    
    v_featured_used := 0;
  END IF;

  IF v_featured_used < v_featured_limit THEN
    RETURN QUERY SELECT 
      true,
      format('Puedes destacar %s propiedades más este mes', v_featured_limit - v_featured_used),
      v_featured_used,
      v_featured_limit,
      v_plan_name;
  ELSE
    RETURN QUERY SELECT 
      false,
      format('Has usado tus %s destacadas de este mes', v_featured_limit),
      v_featured_used,
      v_featured_limit,
      v_plan_name;
  END IF;
END;
$$;

-- 5.7 Auto assign badges
CREATE OR REPLACE FUNCTION public.auto_assign_badges(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_stats RECORD;
  v_plan_level TEXT;
  v_badge_code TEXT;
  v_requirements JSONB;
  v_eligible BOOLEAN;
BEGIN
  SELECT 
    COUNT(CASE WHEN p.status = 'vendida' THEN 1 END) as sold_count,
    COUNT(CASE WHEN p.status = 'activa' THEN 1 END) as active_count,
    COALESCE(AVG(ar.rating), 0) as avg_rating,
    COUNT(ar.id) as review_count
  INTO v_agent_stats
  FROM profiles prof
  LEFT JOIN properties p ON p.agent_id = prof.id
  LEFT JOIN agent_reviews ar ON ar.agent_id = prof.id
  WHERE prof.id = p_user_id
  GROUP BY prof.id;

  SELECT sp.name INTO v_plan_level
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  LIMIT 1;

  FOR v_badge_code, v_requirements IN 
    SELECT code, requirements FROM badge_definitions
  LOOP
    v_eligible := true;

    IF v_requirements ? 'min_sold_properties' THEN
      IF COALESCE(v_agent_stats.sold_count, 0) < (v_requirements->>'min_sold_properties')::INTEGER THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_requirements ? 'min_active_properties' THEN
      IF COALESCE(v_agent_stats.active_count, 0) < (v_requirements->>'min_active_properties')::INTEGER THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_requirements ? 'min_avg_rating' THEN
      IF COALESCE(v_agent_stats.avg_rating, 0) < (v_requirements->>'min_avg_rating')::NUMERIC THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_requirements ? 'min_reviews' THEN
      IF COALESCE(v_agent_stats.review_count, 0) < (v_requirements->>'min_reviews')::INTEGER THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_requirements ? 'plan_level' THEN
      IF v_plan_level IS NULL OR v_plan_level != (v_requirements->>'plan_level') THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_eligible THEN
      INSERT INTO user_badges (user_id, badge_code)
      VALUES (p_user_id, v_badge_code)
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    ELSE
      DELETE FROM user_badges
      WHERE user_id = p_user_id AND badge_code = v_badge_code;
    END IF;
  END LOOP;
END;
$$;

-- 5.8 Increment featured count
CREATE OR REPLACE FUNCTION public.increment_featured_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_subscriptions
  SET featured_used_this_month = COALESCE(featured_used_this_month, 0) + 1
  WHERE user_id = NEW.agent_id 
    AND status = 'active';
  
  RETURN NEW;
END;
$$;

-- 5.9 Log KYC verification change
CREATE OR REPLACE FUNCTION public.log_kyc_verification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.kyc_verification_history (
      verification_id,
      reviewed_by,
      previous_status,
      new_status,
      rejection_reason,
      admin_notes
    ) VALUES (
      NEW.id,
      NEW.reviewed_by,
      OLD.status,
      NEW.status,
      NEW.rejection_reason,
      NEW.admin_notes
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5.10 Update profile verified on KYC approval
CREATE OR REPLACE FUNCTION public.update_profile_verified_on_kyc_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.profiles
    SET is_verified = true
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    UPDATE public.profiles
    SET is_verified = false
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 5.11 Create conversation participants
CREATE OR REPLACE FUNCTION public.create_conversation_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id, unread_count)
  VALUES 
    (NEW.id, NEW.buyer_id, 0),
    (NEW.id, NEW.agent_id, 0);
  RETURN NEW;
END;
$$;

-- 5.12 Increment unread count
CREATE OR REPLACE FUNCTION public.increment_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
  AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$$;

-- 5.13 Expire old invitations
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agency_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- 5.14 Cleanup expired auth tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.auth_tokens
  WHERE expires_at < now() - interval '7 days'
     OR (used_at IS NOT NULL AND used_at < now() - interval '1 day');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5.15 Reactivate property
CREATE OR REPLACE FUNCTION public.reactivate_property(property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE properties
  SET 
    status = 'activa',
    last_renewed_at = now(),
    expires_at = now() + interval '30 days',
    updated_at = now()
  WHERE id = property_id
    AND status = 'pausada';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found or not paused';
  END IF;
END;
$$;

-- 5.16 Set property code
CREATE OR REPLACE FUNCTION public.set_property_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_code IS NULL THEN
    NEW.property_code := 'KNT-' || UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

-- 5.17 Update geometry from lat/lng
CREATE OR REPLACE FUNCTION public.update_property_geometry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$;

-- 5.18 Get system health metrics
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  is_super_admin_user BOOLEAN;
BEGIN
  SELECT public.is_super_admin(auth.uid()) INTO is_super_admin_user;
  
  IF NOT is_super_admin_user THEN
    RAISE EXCEPTION 'Solo super_admin puede acceder a métricas del sistema';
  END IF;
  
  SELECT json_build_object(
    'subscriptions', (
      SELECT json_build_object(
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'past_due', COUNT(*) FILTER (WHERE status = 'past_due'),
        'canceled', COUNT(*) FILTER (WHERE status = 'canceled'),
        'trialing', COUNT(*) FILTER (WHERE status = 'trialing'),
        'total', COUNT(*)
      )
      FROM user_subscriptions
      WHERE created_at >= NOW() - INTERVAL '90 days'
    ),
    'payment_stats_30d', (
      SELECT json_build_object(
        'total_attempts', COUNT(*),
        'successful', COUNT(*) FILTER (WHERE status = 'succeeded'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'success_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'succeeded')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
          ELSE 0
        END
      )
      FROM payment_history
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ),
    'subscription_changes_7d', (
      SELECT json_build_object(
        'total', COUNT(*),
        'upgrades', COUNT(*) FILTER (WHERE change_type = 'upgrade'),
        'downgrades', COUNT(*) FILTER (WHERE change_type = 'downgrade'),
        'cancellations', COUNT(*) FILTER (WHERE change_type = 'cancellation')
      )
      FROM subscription_changes
      WHERE changed_at >= NOW() - INTERVAL '7 days'
    ),
    'expiring_soon', (
      SELECT COUNT(*)
      FROM user_subscriptions
      WHERE status = 'active'
        AND current_period_end <= NOW() + INTERVAL '7 days'
        AND current_period_end > NOW()
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 5.19 Get churn metrics
CREATE OR REPLACE FUNCTION public.get_churn_metrics(start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'), end_date TIMESTAMPTZ DEFAULT NOW())
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  is_super_admin_user BOOLEAN;
BEGIN
  SELECT public.is_super_admin(auth.uid()) INTO is_super_admin_user;
  
  IF NOT is_super_admin_user THEN
    RAISE EXCEPTION 'Solo super_admin puede acceder a métricas de churn';
  END IF;
  
  SELECT json_build_object(
    'total_active_start', (
      SELECT COUNT(*) FROM user_subscriptions 
      WHERE status = 'active' AND created_at <= start_date
    ),
    'total_churned', (
      SELECT COUNT(*) FROM subscription_changes 
      WHERE change_type = 'cancellation' 
      AND changed_at BETWEEN start_date AND end_date
    ),
    'cancellation_reasons', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          COALESCE(us.cancellation_reason, 'No especificada') as reason,
          COUNT(*) as count
        FROM subscription_changes sc
        LEFT JOIN user_subscriptions us ON us.user_id = sc.user_id
        WHERE sc.change_type = 'cancellation'
          AND sc.changed_at BETWEEN start_date AND end_date
        GROUP BY us.cancellation_reason
        ORDER BY count DESC
        LIMIT 10
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 5.20 Get marketing metrics
CREATE OR REPLACE FUNCTION public.get_marketing_metrics(start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'), end_date TIMESTAMPTZ DEFAULT NOW())
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  is_super_admin_user BOOLEAN;
BEGIN
  SELECT public.is_super_admin(auth.uid()) INTO is_super_admin_user;
  
  IF NOT is_super_admin_user THEN
    RAISE EXCEPTION 'Solo super_admin puede acceder a métricas de marketing';
  END IF;
  
  SELECT json_build_object(
    'total_events', (
      SELECT COUNT(*) 
      FROM conversion_events 
      WHERE created_at BETWEEN start_date AND end_date
    ),
    'conversions', (
      SELECT COUNT(*) 
      FROM conversion_events 
      WHERE event_type IN ('Purchase', 'CompleteRegistration') 
        AND created_at BETWEEN start_date AND end_date
    ),
    'total_value', (
      SELECT COALESCE(SUM(value), 0) 
      FROM conversion_events 
      WHERE created_at BETWEEN start_date AND end_date
    ),
    'events_by_type', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT event_type, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY event_type
        ORDER BY count DESC
      ) t
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =====================================================
-- SECCIÓN 6: TRIGGERS
-- =====================================================

-- Trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para incrementar contador de destacadas
DROP TRIGGER IF EXISTS on_featured_property_created ON public.featured_properties;
CREATE TRIGGER on_featured_property_created
  AFTER INSERT ON public.featured_properties
  FOR EACH ROW EXECUTE FUNCTION public.increment_featured_count();

-- Trigger para log de cambios KYC
DROP TRIGGER IF EXISTS on_kyc_status_change ON public.identity_verifications;
CREATE TRIGGER on_kyc_status_change
  AFTER UPDATE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.log_kyc_verification_change();

-- Trigger para actualizar perfil verificado con KYC
DROP TRIGGER IF EXISTS on_kyc_approval ON public.identity_verifications;
CREATE TRIGGER on_kyc_approval
  AFTER UPDATE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_verified_on_kyc_approval();

-- Trigger para crear participantes de conversación
DROP TRIGGER IF EXISTS on_conversation_created ON public.conversations;
CREATE TRIGGER on_conversation_created
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.create_conversation_participants();

-- Trigger para incrementar mensajes no leídos
DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.increment_unread_count();

-- Trigger para generar código de propiedad
DROP TRIGGER IF EXISTS on_property_code ON public.properties;
CREATE TRIGGER on_property_code
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_property_code();

-- Trigger para actualizar geometría PostGIS
DROP TRIGGER IF EXISTS on_property_coords_change ON public.properties;
CREATE TRIGGER on_property_coords_change
  BEFORE INSERT OR UPDATE OF lat, lng ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_property_geometry();

-- =====================================================
-- SECCIÓN 7: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_moderation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_expiry_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_expiration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_setup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_ai_analysis ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS: PROFILES
-- =====================================================
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- POLÍTICAS RLS: USER_ROLES
-- =====================================================
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
  );

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: SUBSCRIPTION_PLANS
-- =====================================================
CREATE POLICY "Plans viewable by everyone" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

-- =====================================================
-- POLÍTICAS RLS: USER_SUBSCRIPTIONS
-- =====================================================
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all subscriptions" ON public.user_subscriptions
  FOR SELECT USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: AGENCIES
-- =====================================================
CREATE POLICY "Agencies are viewable by everyone" ON public.agencies
  FOR SELECT USING (true);

CREATE POLICY "Agency owners can insert their own agency" ON public.agencies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Agency owners can update their own agency" ON public.agencies
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Agency owners can delete their own agency" ON public.agencies
  FOR DELETE USING (auth.uid() = owner_id);

-- =====================================================
-- POLÍTICAS RLS: AGENCY_AGENTS
-- =====================================================
CREATE POLICY "Agency agents relationships are viewable by involved parties" ON public.agency_agents
  FOR SELECT USING (
    auth.uid() = agent_id OR 
    auth.uid() IN (SELECT owner_id FROM agencies WHERE id = agency_agents.agency_id)
  );

CREATE POLICY "Agency owners can add agents" ON public.agency_agents
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM agencies WHERE id = agency_agents.agency_id)
  );

CREATE POLICY "Agency owners can update agent relationships" ON public.agency_agents
  FOR UPDATE USING (
    auth.uid() IN (SELECT owner_id FROM agencies WHERE id = agency_agents.agency_id)
  );

CREATE POLICY "Agency owners can remove agents" ON public.agency_agents
  FOR DELETE USING (
    auth.uid() IN (SELECT owner_id FROM agencies WHERE id = agency_agents.agency_id)
  );

-- =====================================================
-- POLÍTICAS RLS: PROPERTIES
-- =====================================================
CREATE POLICY "Active properties are viewable by everyone" ON public.properties
  FOR SELECT USING (status = 'activa');

CREATE POLICY "Agents can view own properties" ON public.properties
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Admins can view all properties" ON public.properties
  FOR SELECT USING (has_admin_access(auth.uid()));

CREATE POLICY "Agents can insert own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = agent_id);

CREATE POLICY "Agents can delete own draft properties" ON public.properties
  FOR DELETE USING (auth.uid() = agent_id AND status = 'borrador');

CREATE POLICY "Admins can update all properties" ON public.properties
  FOR UPDATE USING (has_admin_access(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: IMAGES
-- =====================================================
CREATE POLICY "Images are viewable by everyone" ON public.images
  FOR SELECT USING (true);

CREATE POLICY "Agents can insert images for own properties" ON public.images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM properties WHERE id = images.property_id AND agent_id = auth.uid())
  );

CREATE POLICY "Agents can delete images for own properties" ON public.images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM properties WHERE id = images.property_id AND agent_id = auth.uid())
  );

-- =====================================================
-- POLÍTICAS RLS: FAVORITES
-- =====================================================
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: SAVED_SEARCHES
-- =====================================================
CREATE POLICY "Users can view own saved searches" ON public.saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches" ON public.saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches" ON public.saved_searches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" ON public.saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: CONVERSATIONS
-- =====================================================
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = agent_id);

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id OR auth.uid() = agent_id);

-- =====================================================
-- POLÍTICAS RLS: MESSAGES
-- =====================================================
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND (buyer_id = auth.uid() OR agent_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND (buyer_id = auth.uid() OR agent_id = auth.uid())
    )
  );

-- =====================================================
-- POLÍTICAS RLS: CONVERSATION_PARTICIPANTS
-- =====================================================
CREATE POLICY "Users can view own participant records" ON public.conversation_participants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own participant records" ON public.conversation_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert participant records" ON public.conversation_participants
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: AGENT_REVIEWS
-- =====================================================
CREATE POLICY "Reviews are viewable by everyone" ON public.agent_reviews
  FOR SELECT USING (true);

CREATE POLICY "Buyers can create reviews if they contacted the agent" ON public.agent_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND 
    EXISTS (
      SELECT 1 FROM conversations
      WHERE (buyer_id = auth.uid() AND agent_id = agent_reviews.agent_id)
         OR (agent_id = auth.uid() AND buyer_id = agent_reviews.agent_id)
    )
  );

CREATE POLICY "Buyers can update own reviews" ON public.agent_reviews
  FOR UPDATE USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can delete own reviews" ON public.agent_reviews
  FOR DELETE USING (auth.uid() = buyer_id);

-- =====================================================
-- POLÍTICAS RLS: BADGE_DEFINITIONS
-- =====================================================
CREATE POLICY "Badge definitions are viewable by everyone" ON public.badge_definitions
  FOR SELECT USING (true);

-- =====================================================
-- POLÍTICAS RLS: USER_BADGES
-- =====================================================
CREATE POLICY "User badges are viewable by everyone" ON public.user_badges
  FOR SELECT USING (true);

-- =====================================================
-- POLÍTICAS RLS: FEATURED_PROPERTIES
-- =====================================================
CREATE POLICY "Active featured viewable by all" ON public.featured_properties
  FOR SELECT USING (status = 'active' AND end_date > now());

CREATE POLICY "Agents view own featured" ON public.featured_properties
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Agents create featured" ON public.featured_properties
  FOR INSERT WITH CHECK (auth.uid() = agent_id);

-- =====================================================
-- POLÍTICAS RLS: PROPERTY_VIEWS
-- =====================================================
CREATE POLICY "Anyone can insert views" ON public.property_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Agents can view their property views" ON public.property_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_views.property_id AND agent_id = auth.uid())
  );

-- =====================================================
-- POLÍTICAS RLS: IDENTITY_VERIFICATIONS
-- =====================================================
CREATE POLICY "Users can view own verification" ON public.identity_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verification" ON public.identity_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending verification" ON public.identity_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all verifications" ON public.identity_verifications
  FOR SELECT USING (has_admin_access(auth.uid()));

CREATE POLICY "Admins can update verifications" ON public.identity_verifications
  FOR UPDATE USING (has_admin_access(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: KYC_VERIFICATION_HISTORY
-- =====================================================
CREATE POLICY "Admins pueden ver historial de KYC" ON public.kyc_verification_history
  FOR SELECT USING (has_admin_access(auth.uid()));

CREATE POLICY "Sistema puede insertar historial de KYC" ON public.kyc_verification_history
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: PAYMENT_HISTORY
-- =====================================================
CREATE POLICY "Users view own payments" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: PENDING_PAYMENTS
-- =====================================================
CREATE POLICY "Users can view their own pending payments" ON public.pending_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending payments" ON public.pending_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: PAYMENT_DISPUTES
-- =====================================================
CREATE POLICY "Admins can manage disputes" ON public.payment_disputes
  FOR ALL USING (has_admin_access(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: PROMOTION_COUPONS
-- =====================================================
CREATE POLICY "Active coupons viewable by everyone" ON public.promotion_coupons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage coupons" ON public.promotion_coupons
  FOR ALL USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: COUPON_REDEMPTIONS
-- =====================================================
CREATE POLICY "Users can view their own redemptions" ON public.coupon_redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all redemptions" ON public.coupon_redemptions
  FOR SELECT USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: SUBSCRIPTION_CHANGES
-- =====================================================
CREATE POLICY "Users can view own subscription changes" ON public.subscription_changes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all subscription changes" ON public.subscription_changes
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert subscription changes" ON public.subscription_changes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: SUBSCRIPTION_AUDIT_LOG
-- =====================================================
CREATE POLICY "Super admins can view audit log" ON public.subscription_audit_log
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert audit logs" ON public.subscription_audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: UPSELLS
-- =====================================================
CREATE POLICY "Upsells viewable by everyone" ON public.upsells
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admin puede actualizar upsells" ON public.upsells
  FOR UPDATE USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admin puede eliminar upsells" ON public.upsells
  FOR DELETE USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin puede insertar upsells" ON public.upsells
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: USER_ACTIVE_UPSELLS
-- =====================================================
CREATE POLICY "Users can view own active upsells" ON public.user_active_upsells
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: NOTIFICATION_PREFERENCES
-- =====================================================
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: ADMIN_NOTIFICATION_PREFERENCES
-- =====================================================
CREATE POLICY "Admin users can view own notification preferences" ON public.admin_notification_preferences
  FOR SELECT USING (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'moderator'))
  );

CREATE POLICY "Admin users can insert own notification preferences" ON public.admin_notification_preferences
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'moderator'))
  );

CREATE POLICY "Admin users can update own notification preferences" ON public.admin_notification_preferences
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'moderator'))
  );

-- =====================================================
-- POLÍTICAS RLS: NEWSLETTER_SUBSCRIPTIONS
-- =====================================================
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own subscriptions" ON public.newsletter_subscriptions
  FOR SELECT USING (auth.uid() = user_id OR email = (auth.jwt() ->> 'email'));

CREATE POLICY "Users can update own subscriptions" ON public.newsletter_subscriptions
  FOR UPDATE USING (auth.uid() = user_id OR email = (auth.jwt() ->> 'email'));

CREATE POLICY "Users can unsubscribe" ON public.newsletter_subscriptions
  FOR DELETE USING (auth.uid() = user_id OR email = (auth.jwt() ->> 'email'));

-- =====================================================
-- POLÍTICAS RLS: PHONE_VERIFICATIONS
-- =====================================================
CREATE POLICY "Users can view their own phone verifications" ON public.phone_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone verifications" ON public.phone_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone verifications" ON public.phone_verifications
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: CONVERSION_EVENTS
-- =====================================================
CREATE POLICY "Sistema puede insertar eventos de conversión" ON public.conversion_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Super admins pueden ver eventos de conversión" ON public.conversion_events
  FOR SELECT USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: PROPERTY_EXPIRY_REMINDERS
-- =====================================================
CREATE POLICY "Agents can view their own expiry reminders" ON public.property_expiry_reminders
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Service role can insert expiry reminders" ON public.property_expiry_reminders
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: PROPERTY_EXPIRATION_LOG
-- =====================================================
CREATE POLICY "Agents can view own expiration logs" ON public.property_expiration_log
  FOR SELECT USING (auth.uid() = agent_id);

-- =====================================================
-- POLÍTICAS RLS: PROPERTY_MODERATION_HISTORY
-- =====================================================
CREATE POLICY "Agentes pueden ver su propio historial" ON public.property_moderation_history
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "Admins pueden ver todo el historial" ON public.property_moderation_history
  FOR SELECT USING (has_admin_access(auth.uid()));

CREATE POLICY "Solo sistema puede insertar registros" ON public.property_moderation_history
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: APP_SETTINGS
-- =====================================================
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Only super_admins can insert app_settings" ON public.app_settings
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Only super_admins can update app_settings" ON public.app_settings
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "Only super_admins can delete app_settings" ON public.app_settings
  FOR DELETE USING (is_super_admin(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: DEMO_SETUP_LOG
-- =====================================================
CREATE POLICY "Users can view own demo setup log" ON public.demo_setup_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert demo setup logs" ON public.demo_setup_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS: PROCESSED_WEBHOOK_EVENTS
-- =====================================================
CREATE POLICY "Super admins can view processed webhooks" ON public.processed_webhook_events
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert webhook events" ON public.processed_webhook_events
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: TRIAL_TRACKING
-- =====================================================
CREATE POLICY "Super admins pueden ver trial tracking" ON public.trial_tracking
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Sistema puede insertar trial tracking" ON public.trial_tracking
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: WHATSAPP_INTERACTIONS
-- =====================================================
CREATE POLICY "Users can view own interactions" ON public.whatsapp_interactions
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = agent_id);

CREATE POLICY "Anyone can insert interactions" ON public.whatsapp_interactions
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- POLÍTICAS RLS: IMAGE_AI_ANALYSIS
-- =====================================================
CREATE POLICY "Agents can view analysis for their property images" ON public.image_ai_analysis
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM properties WHERE id = image_ai_analysis.property_id AND agent_id = auth.uid())
  );

CREATE POLICY "Admins can view all image analysis" ON public.image_ai_analysis
  FOR SELECT USING (has_admin_access(auth.uid()));

-- =====================================================
-- POLÍTICAS RLS: GEOCODING_CACHE
-- =====================================================
CREATE POLICY "Geocoding cache readable by authenticated" ON public.geocoding_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert geocoding cache" ON public.geocoding_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update geocoding cache" ON public.geocoding_cache
  FOR UPDATE USING (true);

-- =====================================================
-- POLÍTICAS RLS: DEVELOPERS
-- =====================================================
CREATE POLICY "Developers are viewable by everyone" ON public.developers
  FOR SELECT USING (true);

CREATE POLICY "Developer owners can insert their own developer" ON public.developers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Developer owners can update their own developer" ON public.developers
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Developer owners can delete their own developer" ON public.developers
  FOR DELETE USING (auth.uid() = owner_id);

-- =====================================================
-- POLÍTICAS RLS: DEVELOPER_TEAM
-- =====================================================
CREATE POLICY "Developer team viewable by involved parties" ON public.developer_team
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT owner_id FROM developers WHERE id = developer_team.developer_id)
  );

CREATE POLICY "Developer owners can manage team" ON public.developer_team
  FOR ALL USING (
    auth.uid() IN (SELECT owner_id FROM developers WHERE id = developer_team.developer_id)
  );

-- =====================================================
-- POLÍTICAS RLS: DEVELOPER_PROJECTS
-- =====================================================
CREATE POLICY "Projects are viewable by everyone" ON public.developer_projects
  FOR SELECT USING (true);

CREATE POLICY "Developer owners can manage projects" ON public.developer_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM developers d WHERE d.id = developer_projects.developer_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Developer team managers can manage projects" ON public.developer_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM developer_team dt 
      WHERE dt.developer_id = developer_projects.developer_id 
      AND dt.user_id = auth.uid() 
      AND dt.role IN ('manager', 'admin') 
      AND dt.status = 'active'
    )
  );

-- =====================================================
-- POLÍTICAS RLS: DEVELOPER_INVITATIONS
-- =====================================================
CREATE POLICY "Developer owners can manage invitations" ON public.developer_invitations
  FOR ALL USING (
    auth.uid() IN (SELECT owner_id FROM developers WHERE id = developer_invitations.developer_id)
  );

CREATE POLICY "Invitees can view their invitations" ON public.developer_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::TEXT
  );

-- =====================================================
-- POLÍTICAS RLS: AGENCY_INVITATIONS
-- =====================================================
CREATE POLICY "Agency owners can view own invitations" ON public.agency_invitations
  FOR SELECT USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Agency owners can create invitations" ON public.agency_invitations
  FOR INSERT WITH CHECK (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid()) AND invited_by = auth.uid()
  );

CREATE POLICY "Agency owners can update own invitations" ON public.agency_invitations
  FOR UPDATE USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Invited users can view and update their invitations" ON public.agency_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::TEXT
  );

CREATE POLICY "Invited users can accept invitations" ON public.agency_invitations
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::TEXT AND status = 'pending'
  );

-- =====================================================
-- POLÍTICAS RLS: PROPERTY_ASSIGNMENT_HISTORY
-- =====================================================
CREATE POLICY "Agents can view their property assignment history" ON public.property_assignment_history
  FOR SELECT USING (new_agent_id = auth.uid() OR previous_agent_id = auth.uid());

CREATE POLICY "Agency owners can view assignment history" ON public.property_assignment_history
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN agencies a ON p.agency_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

-- =====================================================
-- SECCIÓN 8: STORAGE BUCKETS
-- =====================================================

-- Crear buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('property-images', 'property-images', true),
  ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage: Avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Políticas de Storage: Property Images
CREATE POLICY "Property images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

CREATE POLICY "Agents can upload property images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Agents can update property images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Agents can delete property images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-images' AND 
    auth.role() = 'authenticated'
  );

-- Políticas de Storage: KYC Documents (privado)
CREATE POLICY "Users can view own KYC documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own KYC documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kyc-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all KYC documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents' AND 
    public.has_admin_access(auth.uid())
  );

-- =====================================================
-- SECCIÓN 9: HABILITAR REALTIME
-- =====================================================

-- Habilitar realtime para tablas que lo necesitan
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;

-- =====================================================
-- SECCIÓN 10: DATOS INICIALES
-- =====================================================

-- Insertar definiciones de badges
INSERT INTO public.badge_definitions (code, name, description, icon, color, priority, requirements) VALUES
  ('top_seller', 'Top Vendedor', 'Has vendido más de 10 propiedades', 'Trophy', '#FFD700', 100, '{"min_sold_properties": 10}'),
  ('verified', 'Verificado', 'Identidad verificada por Kentra', 'BadgeCheck', '#22C55E', 90, '{}'),
  ('super_host', 'Super Anfitrión', 'Calificación promedio superior a 4.5', 'Star', '#F59E0B', 80, '{"min_avg_rating": 4.5, "min_reviews": 5}'),
  ('early_adopter', 'Early Adopter', 'Uno de los primeros en unirse', 'Rocket', '#8B5CF6', 70, '{}'),
  ('premium', 'Premium', 'Suscriptor del plan Premium', 'Crown', '#6366F1', 60, '{"plan_level": "premium"}')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECCIÓN 11: ANÁLISIS FINAL
-- =====================================================

-- Analizar tablas para optimizar queries
ANALYZE public.profiles;
ANALYZE public.properties;
ANALYZE public.user_roles;
ANALYZE public.user_subscriptions;
ANALYZE public.favorites;
ANALYZE public.messages;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- 
-- PRÓXIMOS PASOS:
-- 1. Configurar Auth en Supabase Dashboard:
--    - Email Auth habilitado con auto-confirm
--    - Site URL: https://kentramx.lovable.app
--    - Redirect URLs: https://kentramx.lovable.app/*
--    - Google OAuth (opcional)
--
-- 2. Copiar Edge Functions:
--    - Todas las funciones de supabase/functions/
--
-- 3. Actualizar variables de entorno en tu proyecto:
--    - VITE_SUPABASE_URL
--    - VITE_SUPABASE_PUBLISHABLE_KEY
--
-- 4. Configurar Stripe webhooks apuntando al nuevo proyecto
--
-- 5. Migrar datos existentes si es necesario
--
-- =====================================================
