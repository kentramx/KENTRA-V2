-- Create badge_definitions table
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  requirements JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES badge_definitions(code) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, badge_code)
);

-- Enable RLS
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badge_definitions (public read)
CREATE POLICY "Badge definitions are viewable by everyone"
  ON public.badge_definitions
  FOR SELECT
  USING (true);

-- RLS Policies for user_badges (public read for agents/agencies, user can view own)
CREATE POLICY "User badges are viewable by everyone"
  ON public.user_badges
  FOR SELECT
  USING (true);

CREATE POLICY "Users can view own badges"
  ON public.user_badges
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert default badge definitions
INSERT INTO public.badge_definitions (code, name, description, icon, color, priority, requirements) VALUES
  -- Performance badges
  ('top_seller', 'Top Vendedor', 'Más de 10 propiedades vendidas', 'Trophy', 'from-yellow-500 to-orange-500', 100, '{"min_sold_properties": 10}'),
  ('fast_response', 'Respuesta Rápida', 'Responde en menos de 2 horas', 'Zap', 'from-blue-500 to-cyan-500', 90, '{"avg_response_time_hours": 2}'),
  ('five_stars', '5 Estrellas', 'Calificación promedio de 5.0', 'Star', 'from-amber-500 to-yellow-500', 95, '{"min_avg_rating": 5.0, "min_reviews": 5}'),
  ('verified_pro', 'Profesional Verificado', 'Perfil completamente verificado', 'CheckCircle2', 'from-green-500 to-emerald-500', 80, '{"is_verified": true}'),
  
  -- Plan-based badges
  ('plan_elite', 'Elite', 'Agente con plan Elite', 'Crown', 'from-purple-500 to-pink-500', 110, '{"plan_level": "elite"}'),
  ('plan_pro', 'Pro', 'Agente con plan Pro', 'Award', 'from-blue-500 to-indigo-500', 105, '{"plan_level": "pro"}'),
  ('agency_pro', 'Inmobiliaria Pro', 'Inmobiliaria con plan Pro', 'Building2', 'from-violet-500 to-purple-500', 108, '{"plan_level": "inmobiliaria_pro"}'),
  ('agency_grow', 'Inmobiliaria Grow', 'Inmobiliaria con plan Grow', 'TrendingUp', 'from-teal-500 to-cyan-500', 103, '{"plan_level": "inmobiliaria_grow"}'),
  
  -- Activity badges
  ('active_seller', 'Vendedor Activo', 'Más de 5 propiedades activas', 'Home', 'from-orange-500 to-red-500', 70, '{"min_active_properties": 5}'),
  ('consistent', 'Constante', 'Activo por más de 6 meses', 'Calendar', 'from-gray-500 to-slate-600', 60, '{"min_months_active": 6}'),
  
  -- Engagement badges
  ('popular', 'Popular', 'Más de 100 visualizaciones en propiedades', 'Eye', 'from-pink-500 to-rose-500', 65, '{"min_total_views": 100}'),
  ('trusted', 'Confiable', 'Más de 20 reseñas positivas', 'ThumbsUp', 'from-lime-500 to-green-500', 75, '{"min_reviews": 20, "min_avg_rating": 4.0}')
ON CONFLICT (code) DO NOTHING;

-- Create function to auto-assign badges
CREATE OR REPLACE FUNCTION public.auto_assign_badges(p_user_id UUID)
RETURNS void
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

    -- Check requirements
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
$$;