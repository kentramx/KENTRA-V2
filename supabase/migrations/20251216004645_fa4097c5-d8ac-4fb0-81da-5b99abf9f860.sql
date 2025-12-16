-- Tabla para configuraciones globales de la aplicación
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índice para búsquedas rápidas por key
CREATE INDEX idx_app_settings_key ON public.app_settings(key);

-- RLS: Lectura pública, solo super_admins pueden modificar
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Only super_admins can insert app_settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Only super_admins can update app_settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Only super_admins can delete app_settings" ON public.app_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insertar tipo de cambio inicial
INSERT INTO public.app_settings (key, value, description) VALUES (
  'exchange_rate_usd_mxn',
  '{"rate": 20.15, "source": "manual"}'::jsonb,
  'Tipo de cambio USD a MXN para conversión de precios en búsquedas'
);