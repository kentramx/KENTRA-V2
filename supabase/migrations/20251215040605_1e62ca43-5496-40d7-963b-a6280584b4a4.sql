-- Función corregida para migrar features existentes al nuevo formato estructurado
CREATE OR REPLACE FUNCTION migrate_plan_features()
RETURNS void AS $$
DECLARE
  plan_record RECORD;
  old_features JSONB;
  new_features JSONB;
  feature_list JSONB;
  max_props INT;
  featured INT;
  max_agents INT;
  max_projects INT;
  has_priority_support BOOLEAN;
  has_analytics BOOLEAN;
  support_val TEXT;
  analytics_val TEXT;
BEGIN
  FOR plan_record IN SELECT id, name, features FROM subscription_plans LOOP
    old_features := plan_record.features;
    
    -- Extraer límites existentes
    max_props := COALESCE(
      (old_features->>'max_properties')::INT, 
      (old_features->>'properties_limit')::INT, 
      0
    );
    featured := COALESCE(
      (old_features->>'featured_listings')::INT, 
      (old_features->>'featured_per_month')::INT, 
      0
    );
    max_agents := (old_features->>'max_agents')::INT;
    max_projects := COALESCE(
      (old_features->>'max_projects')::INT, 
      (old_features->>'proyectos')::INT
    );
    
    -- Extraer valores de texto primero
    support_val := COALESCE(old_features->>'support', '');
    analytics_val := COALESCE(old_features->>'analytics', '');
    
    -- Detectar soporte (puede ser texto o booleano)
    has_priority_support := (
      support_val IN ('priority', 'priority_chat', 'dedicated') OR
      old_features->>'priority_support' = 'true'
    );
    
    -- Detectar analytics (puede ser texto o booleano)
    has_analytics := (
      analytics_val = 'advanced' OR
      old_features->>'analytics' = 'true'
    );
    
    -- Construir feature_list basado en el plan
    feature_list := '[]'::JSONB;
    
    -- Agregar feature de propiedades
    IF max_props = -1 THEN
      feature_list := feature_list || '[{"text": "Propiedades ilimitadas", "icon": "infinity", "highlight": true}]'::JSONB;
    ELSIF max_props > 0 THEN
      feature_list := feature_list || jsonb_build_array(jsonb_build_object(
        'text', 'Hasta ' || max_props || ' propiedades activas',
        'icon', 'building',
        'highlight', false
      ));
    END IF;
    
    -- Agregar feature de destacadas
    IF featured = -1 THEN
      feature_list := feature_list || '[{"text": "Destacadas ilimitadas", "icon": "star", "highlight": true}]'::JSONB;
    ELSIF featured > 0 THEN
      feature_list := feature_list || jsonb_build_array(jsonb_build_object(
        'text', featured || ' propiedades destacadas al mes',
        'icon', 'star',
        'highlight', false
      ));
    END IF;
    
    -- Agregar feature de agentes (solo inmobiliarias)
    IF max_agents IS NOT NULL AND max_agents > 0 THEN
      feature_list := feature_list || jsonb_build_array(jsonb_build_object(
        'text', 'Hasta ' || max_agents || ' agentes en tu equipo',
        'icon', 'users',
        'highlight', false
      ));
    END IF;
    
    -- Agregar feature de proyectos (solo desarrolladoras)
    IF max_projects IS NOT NULL AND max_projects > 0 THEN
      feature_list := feature_list || jsonb_build_array(jsonb_build_object(
        'text', max_projects || CASE WHEN max_projects = 1 THEN ' proyecto activo' ELSE ' proyectos activos' END,
        'icon', 'folder',
        'highlight', false
      ));
    END IF;
    
    -- Agregar soporte
    IF has_priority_support THEN
      feature_list := feature_list || '[{"text": "Soporte prioritario", "icon": "headphones", "highlight": false}]'::JSONB;
    ELSE
      feature_list := feature_list || '[{"text": "Soporte por email", "icon": "mail", "highlight": false}]'::JSONB;
    END IF;
    
    -- Agregar analytics
    IF has_analytics THEN
      feature_list := feature_list || '[{"text": "Analíticas avanzadas", "icon": "bar-chart", "highlight": false}]'::JSONB;
    END IF;
    
    -- Agregar features especiales si existen
    IF old_features->>'ai_copywriting' = 'true' OR old_features->>'ia_copys' = 'true' THEN
      feature_list := feature_list || '[{"text": "Copys con IA", "icon": "zap", "highlight": false}]'::JSONB;
    END IF;
    
    IF old_features->>'dedicated_advisor' = 'true' OR old_features->>'asesor_dedicado' = 'true' THEN
      feature_list := feature_list || '[{"text": "Asesor dedicado", "icon": "user-check", "highlight": true}]'::JSONB;
    END IF;
    
    IF old_features->>'autopublicacion' = 'true' THEN
      feature_list := feature_list || '[{"text": "Autopublicación a redes sociales", "icon": "share", "highlight": false}]'::JSONB;
    END IF;
    
    IF old_features->>'weekly_report' = 'true' OR old_features->>'reportes_avanzados' = 'true' THEN
      feature_list := feature_list || '[{"text": "Reportes semanales", "icon": "file-text", "highlight": false}]'::JSONB;
    END IF;
    
    -- Construir nuevo objeto features
    new_features := jsonb_build_object(
      'limits', jsonb_build_object(
        'max_properties', max_props,
        'featured_per_month', featured,
        'max_agents', max_agents,
        'max_projects', max_projects
      ),
      'capabilities', jsonb_build_object(
        'priority_support', has_priority_support,
        'analytics', has_analytics,
        'autopublicacion', old_features->>'autopublicacion' = 'true',
        'reportes_avanzados', old_features->>'weekly_report' = 'true' OR old_features->>'reportes_avanzados' = 'true',
        'branding', old_features->>'premium_branding' = 'true' OR old_features->>'branding' = 'true',
        'ia_copys', old_features->>'ai_copywriting' = 'true' OR old_features->>'ia_copys' = 'true',
        'asesor_dedicado', old_features->>'dedicated_advisor' = 'true' OR old_features->>'asesor_dedicado' = 'true'
      ),
      'display', jsonb_build_object(
        'badge', CASE 
          WHEN plan_record.name LIKE '%_pro' THEN 'popular'
          WHEN plan_record.name LIKE '%_elite' THEN 'best_value'
          ELSE NULL
        END,
        'highlight', plan_record.name LIKE '%_pro',
        'cta_text', CASE
          WHEN plan_record.name LIKE '%trial%' THEN 'Comenzar Gratis'
          WHEN plan_record.name LIKE '%start%' THEN 'Comenzar'
          WHEN plan_record.name LIKE '%grow%' THEN 'Elegir Grow'
          WHEN plan_record.name LIKE '%pro%' THEN 'Elegir Pro'
          WHEN plan_record.name LIKE '%elite%' THEN 'Ir a Elite'
          ELSE 'Elegir Plan'
        END,
        'short_description', ''
      ),
      'feature_list', feature_list
    );
    
    -- Actualizar el plan
    UPDATE subscription_plans 
    SET features = new_features, updated_at = now()
    WHERE id = plan_record.id;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la migración
SELECT migrate_plan_features();

-- Limpiar la función después de usarla
DROP FUNCTION migrate_plan_features();