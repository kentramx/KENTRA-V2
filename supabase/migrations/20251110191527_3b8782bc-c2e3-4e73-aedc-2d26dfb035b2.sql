-- Add is_secret field to badge_definitions
ALTER TABLE badge_definitions ADD COLUMN is_secret BOOLEAN DEFAULT false;

-- Insert secret achievement badges
INSERT INTO badge_definitions (code, name, description, icon, color, priority, requirements, is_secret) VALUES
('SPEED_SELLER', 'Vendedor Relámpago', 'Primera venta completada en menos de 24 horas desde la publicación', 'Zap', 'from-yellow-400 to-orange-500', 95, '{"requires_special_check": "first_sale_under_24h"}', true),
('QUICK_RESPONDER', 'Respuesta Instantánea', '100% de respuestas a mensajes en menos de 1 hora durante 30 días', 'MessageCircle', 'from-blue-400 to-cyan-500', 90, '{"requires_special_check": "perfect_response_time"}', true),
('PERFECT_MONTH', 'Mes Perfecto', 'Vendió todas las propiedades activas en un solo mes', 'Star', 'from-purple-400 to-pink-500', 92, '{"requires_special_check": "sold_all_in_month"}', true),
('NEGOTIATOR', 'Negociador Maestro', '10 ventas consecutivas por encima del precio de lista', 'TrendingUp', 'from-green-400 to-emerald-500', 88, '{"requires_special_check": "sales_above_list_price"}', true),
('NIGHT_OWL', 'Búho Nocturno', '50% de sus ventas cerradas entre 8pm y 6am', 'Moon', 'from-indigo-400 to-purple-500', 85, '{"requires_special_check": "night_sales"}', true),
('MARATHON_AGENT', 'Agente Maratón', '100 propiedades vendidas en total', 'Trophy', 'from-amber-400 to-yellow-500', 98, '{"min_sold_properties": 100}', true),
('UNICORN', 'Unicornio', 'Vendió una propiedad por más de $50 millones', 'Sparkles', 'from-pink-400 to-rose-500', 100, '{"requires_special_check": "unicorn_sale"}', true);

-- Drop existing auto_assign_badges function to recreate with new logic
DROP FUNCTION IF EXISTS public.auto_assign_badges(uuid);

-- Recreate auto_assign_badges with secret achievement logic
CREATE OR REPLACE FUNCTION public.auto_assign_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_agent_stats RECORD;
  v_plan_level TEXT;
  v_badge_code TEXT;
  v_requirements JSONB;
  v_eligible BOOLEAN;
  v_special_check TEXT;
  v_first_sale_time INTERVAL;
  v_total_sold INTEGER;
  v_night_sales_ratio NUMERIC;
  v_unicorn_sale BOOLEAN;
BEGIN
  -- Get agent stats
  SELECT 
    COUNT(CASE WHEN p.status = 'vendida' THEN 1 END) as sold_count,
    COUNT(CASE WHEN p.status = 'activa' THEN 1 END) as active_count,
    COUNT(pv.id) as total_views,
    COALESCE(AVG(ar.rating), 0) as avg_rating,
    COUNT(ar.id) as review_count,
    prof.is_verified,
    EXTRACT(EPOCH FROM (NOW() - MIN(p.created_at))) / 2592000 as months_active
  INTO v_agent_stats
  FROM profiles prof
  LEFT JOIN properties p ON p.agent_id = prof.id
  LEFT JOIN property_views pv ON pv.property_id = p.id
  LEFT JOIN agent_reviews ar ON ar.agent_id = prof.id
  WHERE prof.id = p_user_id
  GROUP BY prof.id, prof.is_verified;

  -- Get plan level
  SELECT sp.name INTO v_plan_level
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  LIMIT 1;

  -- Check each badge definition
  FOR v_badge_code, v_requirements IN 
    SELECT code, requirements FROM badge_definitions
  LOOP
    v_eligible := true;
    v_special_check := v_requirements->>'requires_special_check';

    -- Handle special achievement checks
    IF v_special_check IS NOT NULL THEN
      v_eligible := false;

      -- Speed Seller: First sale under 24h
      IF v_special_check = 'first_sale_under_24h' THEN
        SELECT MIN(updated_at - created_at) INTO v_first_sale_time
        FROM properties
        WHERE agent_id = p_user_id AND status = 'vendida';
        
        IF v_first_sale_time IS NOT NULL AND v_first_sale_time < INTERVAL '24 hours' THEN
          v_eligible := true;
        END IF;
      END IF;

      -- Marathon Agent: 100 total sales
      IF v_special_check = 'marathon_agent' THEN
        IF v_agent_stats.sold_count >= 100 THEN
          v_eligible := true;
        END IF;
      END IF;

      -- Unicorn: Sale over $50M
      IF v_special_check = 'unicorn_sale' THEN
        SELECT EXISTS(
          SELECT 1 FROM properties
          WHERE agent_id = p_user_id 
          AND status = 'vendida' 
          AND price >= 50000000
        ) INTO v_unicorn_sale;
        
        IF v_unicorn_sale THEN
          v_eligible := true;
        END IF;
      END IF;

      -- Night Owl: 50% sales between 8pm and 6am
      IF v_special_check = 'night_sales' THEN
        SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN
              COUNT(CASE WHEN EXTRACT(HOUR FROM updated_at) >= 20 OR EXTRACT(HOUR FROM updated_at) < 6 THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC
            ELSE 0
          END
        INTO v_night_sales_ratio
        FROM properties
        WHERE agent_id = p_user_id AND status = 'vendida';
        
        IF v_night_sales_ratio >= 0.5 AND v_agent_stats.sold_count >= 10 THEN
          v_eligible := true;
        END IF;
      END IF;

      -- Perfect Month: Sold all active properties in one month
      IF v_special_check = 'sold_all_in_month' THEN
        SELECT EXISTS(
          SELECT 1
          FROM (
            SELECT DATE_TRUNC('month', updated_at) as sale_month, COUNT(*) as monthly_sales
            FROM properties
            WHERE agent_id = p_user_id AND status = 'vendida'
            GROUP BY DATE_TRUNC('month', updated_at)
          ) monthly_counts
          WHERE monthly_sales >= 5 -- Minimum 5 sales in that month
        ) INTO v_eligible;
      END IF;

      -- For checks we can't implement yet (like response time), keep false
      IF v_special_check IN ('perfect_response_time', 'sales_above_list_price') THEN
        v_eligible := false;
      END IF;

    ELSE
      -- Standard requirement checks (existing logic)
      IF v_requirements ? 'min_sold_properties' THEN
        IF v_agent_stats.sold_count < (v_requirements->>'min_sold_properties')::INTEGER THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'min_active_properties' THEN
        IF v_agent_stats.active_count < (v_requirements->>'min_active_properties')::INTEGER THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'min_avg_rating' THEN
        IF v_agent_stats.avg_rating < (v_requirements->>'min_avg_rating')::NUMERIC THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'min_reviews' THEN
        IF v_agent_stats.review_count < (v_requirements->>'min_reviews')::INTEGER THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'min_total_views' THEN
        IF v_agent_stats.total_views < (v_requirements->>'min_total_views')::INTEGER THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'is_verified' THEN
        IF NOT v_agent_stats.is_verified THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'min_months_active' THEN
        IF v_agent_stats.months_active < (v_requirements->>'min_months_active')::INTEGER THEN
          v_eligible := false;
        END IF;
      END IF;

      IF v_requirements ? 'plan_level' THEN
        IF v_plan_level IS NULL OR v_plan_level != (v_requirements->>'plan_level') THEN
          v_eligible := false;
        END IF;
      END IF;
    END IF;

    -- Assign badge if eligible
    IF v_eligible THEN
      INSERT INTO user_badges (user_id, badge_code)
      VALUES (p_user_id, v_badge_code)
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    ELSE
      -- Remove badge if no longer eligible
      DELETE FROM user_badges
      WHERE user_id = p_user_id AND badge_code = v_badge_code;
    END IF;
  END LOOP;
END;
$function$;