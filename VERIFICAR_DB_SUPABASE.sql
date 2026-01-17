-- ============================================
-- SCRIPT DE VERIFICACIÓN DE BASE DE DATOS
-- Proyecto: Kentra
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Este script verifica que tu base de datos tenga
-- todas las estructuras necesarias para el proyecto

-- ============================================
-- 1. VERIFICAR EXTENSIONES
-- ============================================
SELECT '=== EXTENSIONES ===' as seccion;

SELECT 
  extname as extension,
  CASE WHEN extname IS NOT NULL THEN '✅ Instalada' ELSE '❌ Faltante' END as estado
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pg_trgm', 'unaccent', 'postgis')
ORDER BY extname;

-- Verificar extensiones faltantes
SELECT 
  e.required as extension_requerida,
  CASE WHEN pe.extname IS NOT NULL THEN '✅' ELSE '❌ FALTANTE' END as estado
FROM (
  VALUES ('uuid-ossp'), ('pg_trgm'), ('unaccent'), ('postgis')
) as e(required)
LEFT JOIN pg_extension pe ON pe.extname = e.required;

-- ============================================
-- 2. VERIFICAR TIPOS ENUM
-- ============================================
SELECT '=== TIPOS ENUM ===' as seccion;

SELECT 
  t.typname as tipo_enum,
  CASE WHEN t.typname IS NOT NULL THEN '✅ Existe' ELSE '❌ Faltante' END as estado,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as valores
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'app_role', 
  'user_status', 
  'property_status', 
  'property_type',
  'ai_moderation_status', 
  'invitation_status', 
  'moderation_action'
)
GROUP BY t.typname
ORDER BY t.typname;

-- Verificar ENUMs faltantes
SELECT 
  e.required as enum_requerido,
  CASE WHEN t.typname IS NOT NULL THEN '✅' ELSE '❌ FALTANTE' END as estado
FROM (
  VALUES 
    ('app_role'), 
    ('user_status'), 
    ('property_status'), 
    ('property_type'),
    ('ai_moderation_status'), 
    ('invitation_status'), 
    ('moderation_action')
) as e(required)
LEFT JOIN pg_type t ON t.typname = e.required AND t.typtype = 'e';

-- ============================================
-- 3. VERIFICAR TABLAS (52 tablas requeridas)
-- ============================================
SELECT '=== TABLAS ===' as seccion;

WITH required_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'user_roles',
    'user_subscriptions',
    'subscription_plans',
    'subscription_changes',
    'subscription_audit_log',
    'properties',
    'images',
    'property_views',
    'property_moderation_history',
    'property_assignment_history',
    'property_expiration_log',
    'property_expiry_reminders',
    'featured_properties',
    'favorites',
    'saved_searches',
    'agencies',
    'agency_agents',
    'agency_invitations',
    'developers',
    'developer_team',
    'developer_projects',
    'developer_invitations',
    'conversations',
    'messages',
    'conversation_participants',
    'agent_reviews',
    'user_badges',
    'badge_definitions',
    'identity_verifications',
    'kyc_verification_history',
    'phone_verifications',
    'upsells',
    'user_active_upsells',
    'payment_history',
    'pending_payments',
    'payment_disputes',
    'promotion_coupons',
    'coupon_redemptions',
    'newsletter_subscriptions',
    'notification_preferences',
    'admin_notification_preferences',
    'conversion_events',
    'whatsapp_interactions',
    'geocoding_cache',
    'image_ai_analysis',
    'auth_tokens',
    'trial_tracking',
    'stripe_webhook_events',
    'processed_webhook_events',
    'app_settings',
    'demo_setup_log'
  ]) as table_name
)
SELECT 
  rt.table_name as tabla_requerida,
  CASE 
    WHEN t.tablename IS NOT NULL THEN '✅ Existe'
    ELSE '❌ FALTANTE'
  END as estado
FROM required_tables rt
LEFT JOIN pg_tables t ON t.tablename = rt.table_name AND t.schemaname = 'public'
ORDER BY 
  CASE WHEN t.tablename IS NULL THEN 0 ELSE 1 END,
  rt.table_name;

-- Resumen de tablas
SELECT 
  COUNT(*) FILTER (WHERE t.tablename IS NOT NULL) as tablas_existentes,
  COUNT(*) FILTER (WHERE t.tablename IS NULL) as tablas_faltantes,
  52 as tablas_requeridas
FROM (
  SELECT unnest(ARRAY[
    'profiles', 'user_roles', 'user_subscriptions', 'subscription_plans',
    'subscription_changes', 'subscription_audit_log', 'properties', 'images',
    'property_views', 'property_moderation_history', 'property_assignment_history',
    'property_expiration_log', 'property_expiry_reminders', 'featured_properties',
    'favorites', 'saved_searches', 'agencies', 'agency_agents', 'agency_invitations',
    'developers', 'developer_team', 'developer_projects', 'developer_invitations',
    'conversations', 'messages', 'conversation_participants', 'agent_reviews',
    'user_badges', 'badge_definitions', 'identity_verifications', 'kyc_verification_history',
    'phone_verifications', 'upsells', 'user_active_upsells', 'payment_history',
    'pending_payments', 'payment_disputes', 'promotion_coupons', 'coupon_redemptions',
    'newsletter_subscriptions', 'notification_preferences', 'admin_notification_preferences',
    'conversion_events', 'whatsapp_interactions', 'geocoding_cache', 'image_ai_analysis',
    'auth_tokens', 'trial_tracking', 'stripe_webhook_events', 'processed_webhook_events',
    'app_settings', 'demo_setup_log'
  ]) as table_name
) rt
LEFT JOIN pg_tables t ON t.tablename = rt.table_name AND t.schemaname = 'public';

-- ============================================
-- 4. VERIFICAR COLUMNAS CRÍTICAS
-- ============================================
SELECT '=== COLUMNAS CRÍTICAS ===' as seccion;

-- Verificar columnas de profiles
SELECT 
  'profiles' as tabla,
  column_name as columna,
  data_type as tipo,
  '✅' as estado
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'name', 'phone', 'avatar_url', 'status', 'whatsapp_number', 'whatsapp_verified')
ORDER BY column_name;

-- Verificar columnas de properties
SELECT 
  'properties' as tabla,
  column_name as columna,
  data_type as tipo,
  '✅' as estado
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'properties'
  AND column_name IN ('id', 'agent_id', 'title', 'price', 'status', 'type', 'lat', 'lng', 'geom')
ORDER BY column_name;

-- Verificar columna geom tiene tipo geometry
SELECT 
  'properties.geom' as columna,
  CASE 
    WHEN udt_name = 'geometry' THEN '✅ Tipo correcto (geometry)'
    ELSE '❌ Tipo incorrecto: ' || udt_name
  END as estado
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'properties'
  AND column_name = 'geom';

-- ============================================
-- 5. VERIFICAR FUNCIONES
-- ============================================
SELECT '=== FUNCIONES ===' as seccion;

WITH required_functions AS (
  SELECT unnest(ARRAY[
    'is_super_admin',
    'has_role',
    'has_any_role',
    'has_admin_access',
    'can_manage_subscription',
    'can_create_property_with_upsells',
    'can_feature_property',
    'get_property_limit',
    'get_featured_limit',
    'auto_assign_badges',
    'update_property_geometry',
    'generate_property_code',
    'handle_new_user',
    'update_updated_at_column',
    'log_kyc_status_change',
    'update_profile_on_kyc_approval',
    'increment_featured_count_on_insert',
    'audit_subscription_change'
  ]) as function_name
)
SELECT 
  rf.function_name as funcion_requerida,
  CASE 
    WHEN p.proname IS NOT NULL THEN '✅ Existe'
    ELSE '❌ FALTANTE'
  END as estado
FROM required_functions rf
LEFT JOIN pg_proc p ON p.proname = rf.function_name
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid AND n.nspname = 'public'
ORDER BY 
  CASE WHEN p.proname IS NULL THEN 0 ELSE 1 END,
  rf.function_name;

-- ============================================
-- 6. VERIFICAR TRIGGERS
-- ============================================
SELECT '=== TRIGGERS ===' as seccion;

SELECT 
  trigger_name as trigger,
  event_object_table as tabla,
  event_manipulation as evento,
  '✅ Existe' as estado
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verificar triggers críticos
WITH required_triggers AS (
  SELECT * FROM (VALUES 
    ('on_auth_user_created', 'users'),
    ('update_profiles_updated_at', 'profiles'),
    ('update_properties_updated_at', 'properties'),
    ('set_property_geom', 'properties'),
    ('set_property_code', 'properties'),
    ('on_featured_property_insert', 'featured_properties'),
    ('on_kyc_status_change', 'identity_verifications'),
    ('on_kyc_approval', 'identity_verifications'),
    ('on_subscription_change', 'user_subscriptions')
  ) as t(trigger_name, table_name)
)
SELECT 
  rt.trigger_name as trigger_requerido,
  rt.table_name as tabla,
  CASE 
    WHEN t.trigger_name IS NOT NULL THEN '✅ Existe'
    ELSE '❌ FALTANTE'
  END as estado
FROM required_triggers rt
LEFT JOIN information_schema.triggers t 
  ON t.trigger_name = rt.trigger_name 
  AND (t.event_object_table = rt.table_name OR rt.table_name = 'users')
ORDER BY 
  CASE WHEN t.trigger_name IS NULL THEN 0 ELSE 1 END,
  rt.trigger_name;

-- ============================================
-- 7. VERIFICAR POLÍTICAS RLS
-- ============================================
SELECT '=== POLÍTICAS RLS ===' as seccion;

-- Tablas con RLS habilitado
SELECT 
  schemaname as schema,
  tablename as tabla,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Habilitado'
    ELSE '❌ RLS Deshabilitado'
  END as estado_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'user_roles', 'user_subscriptions', 'properties', 
    'images', 'favorites', 'conversations', 'messages', 
    'agencies', 'agency_agents', 'identity_verifications'
  )
ORDER BY tablename;

-- Contar políticas por tabla
SELECT 
  tablename as tabla,
  COUNT(*) as num_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Resumen de RLS
SELECT 
  COUNT(*) FILTER (WHERE rowsecurity = true) as tablas_con_rls,
  COUNT(*) FILTER (WHERE rowsecurity = false) as tablas_sin_rls,
  COUNT(*) as total_tablas
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================
-- 8. VERIFICAR STORAGE BUCKETS
-- ============================================
SELECT '=== STORAGE BUCKETS ===' as seccion;

SELECT 
  id as bucket,
  name as nombre,
  public as es_publico,
  '✅ Existe' as estado
FROM storage.buckets
WHERE id IN ('avatars', 'property-images', 'kyc-documents')
ORDER BY id;

-- Verificar buckets faltantes
WITH required_buckets AS (
  SELECT unnest(ARRAY['avatars', 'property-images', 'kyc-documents']) as bucket_name
)
SELECT 
  rb.bucket_name as bucket_requerido,
  CASE 
    WHEN b.id IS NOT NULL THEN '✅ Existe'
    ELSE '❌ FALTANTE'
  END as estado
FROM required_buckets rb
LEFT JOIN storage.buckets b ON b.id = rb.bucket_name;

-- ============================================
-- 9. VERIFICAR ÍNDICES IMPORTANTES
-- ============================================
SELECT '=== ÍNDICES ===' as seccion;

SELECT 
  indexname as indice,
  tablename as tabla,
  '✅ Existe' as estado
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_properties_agent_id',
    'idx_properties_status',
    'idx_properties_type',
    'idx_properties_state',
    'idx_properties_municipality',
    'idx_properties_geom',
    'idx_properties_search_vector',
    'idx_messages_conversation',
    'idx_favorites_user_property'
  )
ORDER BY indexname;

-- ============================================
-- 10. VERIFICAR REALTIME
-- ============================================
SELECT '=== REALTIME ===' as seccion;

SELECT 
  schemaname as schema,
  tablename as tabla,
  '✅ Habilitado' as realtime
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 11. RESUMEN FINAL
-- ============================================
SELECT '=== RESUMEN FINAL ===' as seccion;

WITH checks AS (
  SELECT 'Extensiones' as categoria, 
    (SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'unaccent', 'postgis')) as encontrados,
    4 as requeridos
  UNION ALL
  SELECT 'Tipos ENUM',
    (SELECT COUNT(DISTINCT typname) FROM pg_type WHERE typname IN ('app_role', 'user_status', 'property_status', 'property_type', 'ai_moderation_status', 'invitation_status', 'moderation_action')),
    7
  UNION ALL
  SELECT 'Tablas',
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
      'profiles', 'user_roles', 'user_subscriptions', 'subscription_plans',
      'properties', 'images', 'favorites', 'conversations', 'messages',
      'agencies', 'developers', 'badge_definitions', 'upsells'
    )),
    13 -- principales
  UNION ALL
  SELECT 'Buckets Storage',
    (SELECT COUNT(*) FROM storage.buckets WHERE id IN ('avatars', 'property-images', 'kyc-documents')),
    3
)
SELECT 
  categoria,
  encontrados || '/' || requeridos as progreso,
  CASE 
    WHEN encontrados = requeridos THEN '✅ COMPLETO'
    WHEN encontrados > 0 THEN '⚠️ PARCIAL'
    ELSE '❌ FALTANTE'
  END as estado
FROM checks;

-- ============================================
-- VERIFICACIÓN FINAL DE COMPATIBILIDAD
-- ============================================
SELECT '=== VERIFICACIÓN DE COMPATIBILIDAD ===' as seccion;

SELECT 
  CASE 
    WHEN (
      -- Verificar extensiones críticas
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AND
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') AND
      -- Verificar tablas críticas
      EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') AND
      EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties') AND
      EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_subscriptions') AND
      EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_plans') AND
      -- Verificar ENUMs críticos
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') AND
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_status')
    )
    THEN '✅✅✅ BASE DE DATOS LISTA PARA KENTRA ✅✅✅'
    ELSE '❌❌❌ BASE DE DATOS INCOMPLETA - REVISAR ERRORES ARRIBA ❌❌❌'
  END as resultado_final;
