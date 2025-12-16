-- ============================================
-- SISTEMA DESARROLLADORAS INMOBILIARIAS
-- ============================================

-- 1. Tabla principal: developers (similar a agencies)
CREATE TABLE public.developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  logo_url text,
  website text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_id)
);

-- 2. Tabla de proyectos inmobiliarios
CREATE TABLE public.developer_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  address text,
  city text,
  state text,
  lat numeric,
  lng numeric,
  total_units integer DEFAULT 0,
  available_units integer DEFAULT 0,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'construction', 'presale', 'sale', 'completed')),
  cover_image_url text,
  gallery jsonb DEFAULT '[]',
  amenities jsonb DEFAULT '[]',
  delivery_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Tabla de equipo de desarrolladora (similar a agency_agents)
CREATE TABLE public.developer_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'sales' CHECK (role IN ('sales', 'manager', 'admin')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(developer_id, user_id)
);

-- 4. Tabla de invitaciones (similar a agency_invitations)
CREATE TABLE public.developer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'sales' CHECK (role IN ('sales', 'manager', 'admin')),
  token uuid DEFAULT gen_random_uuid(),
  status invitation_status DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. Agregar project_id a properties para vincular propiedades a proyectos
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.developer_projects(id) ON DELETE SET NULL;

-- 6. Índices para performance
CREATE INDEX idx_developers_owner ON public.developers(owner_id);
CREATE INDEX idx_developer_projects_developer ON public.developer_projects(developer_id);
CREATE INDEX idx_developer_projects_status ON public.developer_projects(status);
CREATE INDEX idx_developer_team_developer ON public.developer_team(developer_id);
CREATE INDEX idx_developer_team_user ON public.developer_team(user_id);
CREATE INDEX idx_developer_invitations_token ON public.developer_invitations(token);
CREATE INDEX idx_developer_invitations_email ON public.developer_invitations(email);
CREATE INDEX idx_properties_project ON public.properties(project_id) WHERE project_id IS NOT NULL;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Habilitar RLS
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_invitations ENABLE ROW LEVEL SECURITY;

-- DEVELOPERS: Todos pueden ver desarrolladoras verificadas
CREATE POLICY "Developers are viewable by everyone" ON public.developers
  FOR SELECT USING (true);

CREATE POLICY "Developer owners can insert their own developer" ON public.developers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Developer owners can update their own developer" ON public.developers
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Developer owners can delete their own developer" ON public.developers
  FOR DELETE USING (auth.uid() = owner_id);

-- DEVELOPER_PROJECTS: Proyectos visibles públicamente, gestionados por owner/team
CREATE POLICY "Projects are viewable by everyone" ON public.developer_projects
  FOR SELECT USING (true);

CREATE POLICY "Developer owners can manage projects" ON public.developer_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.developers d
      WHERE d.id = developer_projects.developer_id
      AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Developer team managers can manage projects" ON public.developer_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.developer_team dt
      WHERE dt.developer_id = developer_projects.developer_id
      AND dt.user_id = auth.uid()
      AND dt.role IN ('manager', 'admin')
      AND dt.status = 'active'
    )
  );

-- DEVELOPER_TEAM: Visible para owner y miembros
CREATE POLICY "Developer team viewable by involved parties" ON public.developer_team
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT owner_id FROM public.developers WHERE id = developer_team.developer_id
    )
  );

CREATE POLICY "Developer owners can manage team" ON public.developer_team
  FOR ALL USING (
    auth.uid() IN (
      SELECT owner_id FROM public.developers WHERE id = developer_team.developer_id
    )
  );

-- DEVELOPER_INVITATIONS: Gestionadas por owner
CREATE POLICY "Developer owners can manage invitations" ON public.developer_invitations
  FOR ALL USING (
    auth.uid() IN (
      SELECT owner_id FROM public.developers WHERE id = developer_invitations.developer_id
    )
  );

CREATE POLICY "Invitees can view their invitations" ON public.developer_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================
-- ACTUALIZAR TRIGGER handle_new_user
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  valid_role app_role;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario')
  );
  
  -- Obtener rol solicitado del metadata
  requested_role := NEW.raw_user_meta_data->>'role';
  
  -- Validar y asignar rol (permitir buyer, agent, agency, developer; rechazar admin/moderator por seguridad)
  CASE requested_role
    WHEN 'agent' THEN valid_role := 'agent'::app_role;
    WHEN 'agency' THEN valid_role := 'agency'::app_role;
    WHEN 'developer' THEN valid_role := 'developer'::app_role;
    ELSE valid_role := 'buyer'::app_role; -- Default seguro
  END CASE;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, valid_role);
  
  RETURN NEW;
END;
$$;

-- ============================================
-- AGREGAR max_agents A PLANES DE DESARROLLADORA
-- ============================================

UPDATE public.subscription_plans 
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{limits,max_agents}',
  '2'::jsonb
)
WHERE name = 'desarrolladora_start';

UPDATE public.subscription_plans 
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{limits,max_agents}',
  '5'::jsonb
)
WHERE name = 'desarrolladora_grow';

UPDATE public.subscription_plans 
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{limits,max_agents}',
  '-1'::jsonb
)
WHERE name = 'desarrolladora_pro';