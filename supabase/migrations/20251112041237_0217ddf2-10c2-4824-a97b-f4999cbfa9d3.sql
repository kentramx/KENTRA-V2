-- Crear tabla para solicitudes de verificación de identidad (KYC)
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Documentos
  ine_front_url TEXT,
  ine_back_url TEXT,
  rfc_url TEXT,
  -- Datos extraídos del INE
  full_name TEXT,
  curp TEXT,
  date_of_birth DATE,
  address TEXT,
  -- Estado de verificación
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  admin_notes TEXT,
  -- Auditoría
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Solo una solicitud activa por usuario
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios pueden ver su propia verificación"
  ON public.identity_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden crear su verificación"
  ON public.identity_verifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Usuarios pueden actualizar su verificación pendiente"
  ON public.identity_verifications
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins pueden ver todas las verificaciones"
  ON public.identity_verifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'moderator')
    )
  );

CREATE POLICY "Admins pueden actualizar verificaciones"
  ON public.identity_verifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'moderator')
    )
  );

-- Trigger para actualizar updated_at
CREATE TRIGGER update_identity_verifications_updated_at
  BEFORE UPDATE ON public.identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para actualizar profiles.is_verified cuando se aprueba KYC
CREATE OR REPLACE FUNCTION public.update_profile_verified_on_kyc_approval()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_kyc_status_change
  AFTER UPDATE ON public.identity_verifications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_profile_verified_on_kyc_approval();

-- Crear storage bucket para documentos KYC (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage bucket de KYC
CREATE POLICY "Usuarios pueden subir sus propios documentos KYC"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Usuarios pueden ver sus propios documentos KYC"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins pueden ver todos los documentos KYC"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'moderator')
    )
  );

-- Índices para optimización
CREATE INDEX idx_identity_verifications_user_id ON public.identity_verifications(user_id);
CREATE INDEX idx_identity_verifications_status ON public.identity_verifications(status);
CREATE INDEX idx_identity_verifications_created_at ON public.identity_verifications(created_at DESC);