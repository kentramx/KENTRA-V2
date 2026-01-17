-- ============================================================================
-- 🔍 AUDITORÍA COMPLETA DEL BACKEND KENTRA
-- ============================================================================
-- Ejecutar en: Supabase SQL Editor (supabase.com)
-- Propósito: Verificar que TODOS los componentes estén instalados antes de migrar
-- Fecha generación: Enero 2026
-- ============================================================================

DO $$
DECLARE
    -- Contadores
    v_total_checks INT := 0;
    v_passed_checks INT := 0;
    v_failed_checks INT := 0;
    
    -- Variables temporales
    v_exists BOOLEAN;
    v_count INT;
    v_missing TEXT := '';
    
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                    🔍 AUDITORÍA BACKEND KENTRA                               ║';
    RAISE NOTICE '║                         Verificación Completa                                 ║';
    RAISE NOTICE '╚══════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 1. EXTENSIONES POSTGRESQL
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📦 1. EXTENSIONES POSTGRESQL';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- uuid-ossp
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ uuid-ossp';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ uuid-ossp - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'uuid-ossp, ';
    END IF;
    
    -- pg_trgm
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ pg_trgm';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ pg_trgm - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'pg_trgm, ';
    END IF;
    
    -- unaccent
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'unaccent') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ unaccent';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ⚠️  unaccent - OPCIONAL (para búsqueda sin acentos)';
        v_passed_checks := v_passed_checks + 1; -- Opcional
    END IF;
    
    -- postgis
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ postgis';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ postgis - FALTANTE (requerido para geolocalización)';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'postgis, ';
    END IF;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 2. TIPOS ENUM
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🏷️  2. TIPOS ENUM';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- app_role
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'app_role') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ app_role';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ app_role - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'app_role, ';
    END IF;
    
    -- user_status
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'user_status') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ user_status';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ user_status - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'user_status, ';
    END IF;
    
    -- property_status
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'property_status') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ property_status';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ property_status - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'property_status, ';
    END IF;
    
    -- property_type
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'property_type') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ property_type';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ property_type - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'property_type, ';
    END IF;
    
    -- ai_moderation_status
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'ai_moderation_status') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ ai_moderation_status';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ ai_moderation_status - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'ai_moderation_status, ';
    END IF;
    
    -- invitation_status
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'invitation_status') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ invitation_status';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ invitation_status - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'invitation_status, ';
    END IF;
    
    -- moderation_action
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'moderation_action') INTO v_exists;
    IF v_exists THEN
        RAISE NOTICE '  ✅ moderation_action';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        RAISE NOTICE '  ❌ moderation_action - FALTANTE';
        v_failed_checks := v_failed_checks + 1;
        v_missing := v_missing || 'moderation_action, ';
    END IF;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 3. TABLAS PRINCIPALES
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🗃️  3. TABLAS PRINCIPALES';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- Lista de tablas críticas
    FOR v_exists IN 
        SELECT t.table_name IN (
            'profiles', 'user_roles', 'properties', 'images', 'favorites',
            'user_subscriptions', 'subscription_plans', 'subscription_changes',
            'conversations', 'messages', 'conversation_participants',
            'agencies', 'agency_agents', 'agency_invitations',
            'developers', 'developer_team', 'developer_projects', 'developer_invitations',
            'identity_verifications', 'kyc_verification_history', 'phone_verifications',
            'payment_history', 'pending_payments', 'payment_disputes',
            'promotion_coupons', 'coupon_redemptions',
            'featured_properties', 'property_moderation_history', 'property_assignment_history',
            'property_expiry_reminders', 'property_expiration_log',
            'agent_reviews', 'badge_definitions',
            'notification_preferences', 'admin_notification_preferences',
            'newsletter_subscriptions', 'conversion_events',
            'geocoding_cache', 'auth_tokens', 'app_settings',
            'image_ai_analysis', 'processed_webhook_events', 'demo_setup_log'
        ) as exists
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
    LOOP
        -- Esto es un placeholder, verificaremos individualmente
    END LOOP;
    
    -- Verificación individual de tablas críticas
    DECLARE
        v_tables TEXT[] := ARRAY[
            'profiles', 'user_roles', 'properties', 'images', 'favorites',
            'user_subscriptions', 'subscription_plans', 'subscription_changes',
            'conversations', 'messages', 'conversation_participants',
            'agencies', 'agency_agents', 'agency_invitations',
            'developers', 'developer_team', 'developer_projects', 'developer_invitations',
            'identity_verifications', 'kyc_verification_history', 'phone_verifications',
            'payment_history', 'pending_payments', 'payment_disputes',
            'promotion_coupons', 'coupon_redemptions',
            'featured_properties', 'property_moderation_history', 'property_assignment_history',
            'property_expiry_reminders', 'property_expiration_log',
            'agent_reviews', 'badge_definitions',
            'notification_preferences', 'admin_notification_preferences',
            'newsletter_subscriptions', 'conversion_events',
            'geocoding_cache', 'auth_tokens', 'app_settings',
            'image_ai_analysis', 'processed_webhook_events', 'demo_setup_log'
        ];
        v_table TEXT;
        v_table_count INT := 0;
        v_table_missing INT := 0;
    BEGIN
        FOREACH v_table IN ARRAY v_tables LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = v_table
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_table_count := v_table_count + 1;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                v_table_missing := v_table_missing + 1;
                RAISE NOTICE '  ❌ % - FALTANTE', v_table;
                v_missing := v_missing || v_table || ', ';
            END IF;
        END LOOP;
        
        RAISE NOTICE '  📊 Tablas encontradas: %/% ', v_table_count, array_length(v_tables, 1);
        IF v_table_missing > 0 THEN
            RAISE NOTICE '  ⚠️  Tablas faltantes: %', v_table_missing;
        ELSE
            RAISE NOTICE '  ✅ Todas las tablas críticas presentes';
        END IF;
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 4. COLUMNAS CRÍTICAS EN TABLAS PRINCIPALES
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📋 4. COLUMNAS CRÍTICAS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- Columnas críticas en profiles
    RAISE NOTICE '  📌 profiles:';
    DECLARE
        v_profile_cols TEXT[] := ARRAY['id', 'name', 'phone', 'avatar_url', 'status', 'whatsapp_number', 'whatsapp_verified', 'is_verified', 'city', 'state'];
        v_col TEXT;
        v_col_found INT := 0;
    BEGIN
        FOREACH v_col IN ARRAY v_profile_cols LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = v_col
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_col_found := v_col_found + 1;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                RAISE NOTICE '     ❌ profiles.% - FALTANTE', v_col;
                v_missing := v_missing || 'profiles.' || v_col || ', ';
            END IF;
        END LOOP;
        RAISE NOTICE '     ✅ %/% columnas', v_col_found, array_length(v_profile_cols, 1);
    END;
    
    -- Columnas críticas en properties
    RAISE NOTICE '  📌 properties:';
    DECLARE
        v_prop_cols TEXT[] := ARRAY['id', 'agent_id', 'title', 'price', 'status', 'type', 'lat', 'lng', 'geom', 'address', 'municipality', 'state', 'bedrooms', 'bathrooms', 'sqft', 'expires_at', 'is_featured', 'search_vector'];
        v_col TEXT;
        v_col_found INT := 0;
    BEGIN
        FOREACH v_col IN ARRAY v_prop_cols LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = v_col
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_col_found := v_col_found + 1;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                RAISE NOTICE '     ❌ properties.% - FALTANTE', v_col;
                v_missing := v_missing || 'properties.' || v_col || ', ';
            END IF;
        END LOOP;
        RAISE NOTICE '     ✅ %/% columnas', v_col_found, array_length(v_prop_cols, 1);
    END;
    
    -- Columnas críticas en user_subscriptions
    RAISE NOTICE '  📌 user_subscriptions:';
    DECLARE
        v_sub_cols TEXT[] := ARRAY['id', 'user_id', 'plan_id', 'status', 'stripe_subscription_id', 'stripe_customer_id', 'billing_cycle', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'featured_used_this_month'];
        v_col TEXT;
        v_col_found INT := 0;
    BEGIN
        FOREACH v_col IN ARRAY v_sub_cols LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'user_subscriptions' AND column_name = v_col
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_col_found := v_col_found + 1;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                RAISE NOTICE '     ❌ user_subscriptions.% - FALTANTE', v_col;
                v_missing := v_missing || 'user_subscriptions.' || v_col || ', ';
            END IF;
        END LOOP;
        RAISE NOTICE '     ✅ %/% columnas', v_col_found, array_length(v_sub_cols, 1);
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 5. FUNCIONES POSTGRESQL
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '⚙️  5. FUNCIONES POSTGRESQL';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    DECLARE
        v_functions TEXT[] := ARRAY[
            -- Funciones de roles
            'is_super_admin',
            'has_role',
            'has_any_role',
            'has_admin_access',
            -- Funciones de suscripción
            'can_manage_subscription',
            'get_property_limit',
            'get_featured_limit',
            'check_property_limit',
            -- Funciones de triggers
            'handle_new_user',
            'update_updated_at_column',
            'update_property_geometry',
            'sync_property_geom',
            -- Funciones de métricas
            'get_avg_review_time_minutes',
            'get_moderation_stats',
            'refresh_agent_performance_stats',
            -- Funciones de utilidad
            'update_subscription_updated_at',
            'increment_featured_count',
            'log_subscription_change',
            'validate_property_data'
        ];
        v_func TEXT;
        v_func_found INT := 0;
        v_func_missing INT := 0;
    BEGIN
        FOREACH v_func IN ARRAY v_functions LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.proname = v_func
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_func_found := v_func_found + 1;
                RAISE NOTICE '  ✅ %', v_func;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                v_func_missing := v_func_missing + 1;
                RAISE NOTICE '  ❌ % - FALTANTE', v_func;
                v_missing := v_missing || v_func || '(), ';
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '  📊 Funciones: %/% encontradas', v_func_found, array_length(v_functions, 1);
        IF v_func_missing > 0 THEN
            RAISE NOTICE '  ⚠️  Funciones faltantes: %', v_func_missing;
        END IF;
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 6. TRIGGERS
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🔔 6. TRIGGERS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    DECLARE
        v_triggers TEXT[][] := ARRAY[
            ARRAY['on_auth_user_created', 'auth.users'],
            ARRAY['update_profiles_updated_at', 'profiles'],
            ARRAY['update_properties_updated_at', 'properties'],
            ARRAY['properties_sync_geom', 'properties'],
            ARRAY['set_property_geom', 'properties'],
            ARRAY['update_user_subscriptions_updated_at', 'user_subscriptions'],
            ARRAY['on_subscription_insert', 'user_subscriptions'],
            ARRAY['on_subscription_update', 'user_subscriptions'],
            ARRAY['update_agencies_updated_at', 'agencies'],
            ARRAY['update_developers_updated_at', 'developers']
        ];
        v_trigger TEXT[];
        v_trig_found INT := 0;
        v_trig_missing INT := 0;
    BEGIN
        FOREACH v_trigger SLICE 1 IN ARRAY v_triggers LOOP
            v_total_checks := v_total_checks + 1;
            
            -- Buscar trigger en cualquier tabla
            SELECT EXISTS(
                SELECT 1 FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                WHERE t.tgname = v_trigger[1]
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_trig_found := v_trig_found + 1;
                RAISE NOTICE '  ✅ % (en %)', v_trigger[1], v_trigger[2];
            ELSE
                v_failed_checks := v_failed_checks + 1;
                v_trig_missing := v_trig_missing + 1;
                RAISE NOTICE '  ❌ % (en %) - FALTANTE', v_trigger[1], v_trigger[2];
                v_missing := v_missing || 'trigger:' || v_trigger[1] || ', ';
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '  📊 Triggers: %/% encontrados', v_trig_found, array_length(v_triggers, 1);
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 7. POLÍTICAS RLS
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🔒 7. POLÍTICAS RLS (Row Level Security)';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- Verificar RLS habilitado en tablas críticas
    DECLARE
        v_rls_tables TEXT[] := ARRAY[
            'profiles', 'user_roles', 'properties', 'images', 'favorites',
            'user_subscriptions', 'subscription_plans', 'subscription_changes',
            'conversations', 'messages', 'conversation_participants',
            'agencies', 'agency_agents', 'identity_verifications',
            'payment_history', 'featured_properties'
        ];
        v_table TEXT;
        v_rls_enabled BOOLEAN;
        v_policy_count INT;
        v_rls_ok INT := 0;
        v_rls_missing INT := 0;
    BEGIN
        FOREACH v_table IN ARRAY v_rls_tables LOOP
            v_total_checks := v_total_checks + 1;
            
            -- Verificar si RLS está habilitado
            SELECT relrowsecurity INTO v_rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = v_table;
            
            -- Contar políticas
            SELECT COUNT(*) INTO v_policy_count
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_table;
            
            IF v_rls_enabled AND v_policy_count > 0 THEN
                v_passed_checks := v_passed_checks + 1;
                v_rls_ok := v_rls_ok + 1;
                RAISE NOTICE '  ✅ % (RLS: ON, Políticas: %)', v_table, v_policy_count;
            ELSIF v_rls_enabled THEN
                v_passed_checks := v_passed_checks + 1;
                RAISE NOTICE '  ⚠️  % (RLS: ON, pero 0 políticas)', v_table;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                v_rls_missing := v_rls_missing + 1;
                RAISE NOTICE '  ❌ % (RLS: OFF) - INSEGURO', v_table;
                v_missing := v_missing || 'RLS:' || v_table || ', ';
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '  📊 Tablas con RLS: %/%', v_rls_ok, array_length(v_rls_tables, 1);
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 8. STORAGE BUCKETS
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📁 8. STORAGE BUCKETS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    DECLARE
        v_buckets TEXT[] := ARRAY['avatars', 'property-images', 'kyc-documents'];
        v_bucket TEXT;
        v_bucket_found INT := 0;
    BEGIN
        FOREACH v_bucket IN ARRAY v_buckets LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM storage.buckets WHERE id = v_bucket OR name = v_bucket
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_bucket_found := v_bucket_found + 1;
                RAISE NOTICE '  ✅ %', v_bucket;
            ELSE
                v_failed_checks := v_failed_checks + 1;
                RAISE NOTICE '  ❌ % - FALTANTE', v_bucket;
                v_missing := v_missing || 'bucket:' || v_bucket || ', ';
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '  📊 Buckets: %/%', v_bucket_found, array_length(v_buckets, 1);
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 9. ÍNDICES DE RENDIMIENTO
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📈 9. ÍNDICES DE RENDIMIENTO';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    DECLARE
        v_indexes TEXT[] := ARRAY[
            'idx_properties_agent_id',
            'idx_properties_status',
            'idx_properties_type',
            'idx_properties_geom',
            'idx_properties_search_vector',
            'idx_properties_municipality_state',
            'idx_properties_expires_at',
            'idx_messages_conversation_id',
            'idx_messages_sender_id',
            'idx_favorites_user_id',
            'idx_favorites_property_id',
            'idx_user_subscriptions_user_id',
            'idx_user_subscriptions_status',
            'idx_images_property_id'
        ];
        v_index TEXT;
        v_idx_found INT := 0;
    BEGIN
        FOREACH v_index IN ARRAY v_indexes LOOP
            v_total_checks := v_total_checks + 1;
            SELECT EXISTS(
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' AND indexname = v_index
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_idx_found := v_idx_found + 1;
            ELSE
                -- No es crítico, pero recomendado
                v_passed_checks := v_passed_checks + 1;
                RAISE NOTICE '  ⚠️  % - RECOMENDADO (no crítico)', v_index;
            END IF;
        END LOOP;
        
        RAISE NOTICE '  📊 Índices verificados: %', array_length(v_indexes, 1);
        RAISE NOTICE '  💡 Los índices mejoran el rendimiento pero no son críticos para funcionalidad';
    END;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 10. VISTAS MATERIALIZADAS
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 10. VISTAS MATERIALIZADAS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    v_total_checks := v_total_checks + 1;
    SELECT EXISTS(
        SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'agent_performance_stats'
    ) INTO v_exists;
    
    IF v_exists THEN
        v_passed_checks := v_passed_checks + 1;
        RAISE NOTICE '  ✅ agent_performance_stats';
    ELSE
        v_passed_checks := v_passed_checks + 1; -- Opcional
        RAISE NOTICE '  ⚠️  agent_performance_stats - OPCIONAL (mejora rendimiento)';
    END IF;
    
    RAISE NOTICE '';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- 11. REALTIME
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '⚡ 11. REALTIME (Supabase)';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    DECLARE
        v_realtime_tables TEXT[] := ARRAY['messages', 'conversations', 'user_subscriptions'];
        v_rt TEXT;
        v_rt_found INT := 0;
    BEGIN
        FOREACH v_rt IN ARRAY v_realtime_tables LOOP
            v_total_checks := v_total_checks + 1;
            -- Verificar si está en la publicación de realtime
            SELECT EXISTS(
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND tablename = v_rt
            ) INTO v_exists;
            
            IF v_exists THEN
                v_passed_checks := v_passed_checks + 1;
                v_rt_found := v_rt_found + 1;
                RAISE NOTICE '  ✅ % (realtime habilitado)', v_rt;
            ELSE
                v_passed_checks := v_passed_checks + 1; -- No crítico
                RAISE NOTICE '  ⚠️  % (realtime no habilitado) - OPCIONAL', v_rt;
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '  📊 Tablas con Realtime: %/%', v_rt_found, array_length(v_realtime_tables, 1);
    END;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- RESUMEN FINAL
    -- ═══════════════════════════════════════════════════════════════════════════
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                         📋 RESUMEN DE AUDITORÍA                              ║';
    RAISE NOTICE '╚══════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '  Total de verificaciones: %', v_total_checks;
    RAISE NOTICE '  ✅ Pasaron: %', v_passed_checks;
    RAISE NOTICE '  ❌ Fallaron: %', v_failed_checks;
    RAISE NOTICE '';
    RAISE NOTICE '  📊 Completitud: % %%', ROUND((v_passed_checks::NUMERIC / v_total_checks::NUMERIC) * 100, 1);
    RAISE NOTICE '';
    
    IF v_failed_checks = 0 THEN
        RAISE NOTICE '╔══════════════════════════════════════════════════════════════════════════════╗';
        RAISE NOTICE '║  ✅ ¡BASE DE DATOS LISTA PARA PRODUCCIÓN!                                    ║';
        RAISE NOTICE '║     Todos los componentes críticos están instalados correctamente.           ║';
        RAISE NOTICE '╚══════════════════════════════════════════════════════════════════════════════╝';
    ELSE
        RAISE NOTICE '╔══════════════════════════════════════════════════════════════════════════════╗';
        RAISE NOTICE '║  ⚠️  REQUIERE ATENCIÓN                                                        ║';
        RAISE NOTICE '║     Hay % componentes faltantes que deben instalarse.                        ║', v_failed_checks;
        RAISE NOTICE '╚══════════════════════════════════════════════════════════════════════════════╝';
        RAISE NOTICE '';
        RAISE NOTICE '  Componentes faltantes:';
        RAISE NOTICE '  %', v_missing;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '                    FIN DE AUDITORÍA - KENTRA BACKEND';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════════';

END $$;

-- ============================================================================
-- CONSULTAS ADICIONALES DE VERIFICACIÓN (ejecutar por separado si es necesario)
-- ============================================================================

-- Ver todas las tablas públicas
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Ver todas las funciones públicas
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' ORDER BY proname;

-- Ver todos los triggers
-- SELECT tgname, relname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE NOT tgisinternal ORDER BY relname, tgname;

-- Ver todas las políticas RLS
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Ver buckets de storage
-- SELECT * FROM storage.buckets;

-- Ver extensiones instaladas
-- SELECT extname, extversion FROM pg_extension ORDER BY extname;
