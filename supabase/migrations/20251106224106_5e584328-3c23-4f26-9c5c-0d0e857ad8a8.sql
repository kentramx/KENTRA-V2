-- Create property views tracking table
CREATE TABLE public.property_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable Row Level Security
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

-- Policies for property views
CREATE POLICY "Anyone can insert views" 
ON public.property_views 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Agents can view their property views" 
ON public.property_views 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = property_views.property_id 
    AND properties.agent_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_property_views_property_id ON public.property_views(property_id);
CREATE INDEX idx_property_views_viewed_at ON public.property_views(viewed_at);
CREATE INDEX idx_property_views_viewer_id ON public.property_views(viewer_id);

-- Function to get agent statistics
CREATE OR REPLACE FUNCTION public.get_agent_stats(agent_uuid UUID)
RETURNS TABLE (
  total_properties BIGINT,
  active_properties BIGINT,
  total_views BIGINT,
  total_favorites BIGINT,
  total_conversations BIGINT,
  conversion_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH property_stats AS (
    SELECT 
      COUNT(*) as props_count,
      COUNT(*) FILTER (WHERE status = 'activa') as active_count
    FROM properties
    WHERE agent_id = agent_uuid
  ),
  view_stats AS (
    SELECT COUNT(*) as views_count
    FROM property_views pv
    JOIN properties p ON p.id = pv.property_id
    WHERE p.agent_id = agent_uuid
  ),
  favorite_stats AS (
    SELECT COUNT(*) as favs_count
    FROM favorites f
    JOIN properties p ON p.id = f.property_id
    WHERE p.agent_id = agent_uuid
  ),
  conversation_stats AS (
    SELECT COUNT(*) as convos_count
    FROM conversations
    WHERE agent_id = agent_uuid
  )
  SELECT 
    ps.props_count,
    ps.active_count,
    vs.views_count,
    fs.favs_count,
    cs.convos_count,
    CASE 
      WHEN vs.views_count > 0 THEN ROUND((cs.convos_count::NUMERIC / vs.views_count::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM property_stats ps, view_stats vs, favorite_stats fs, conversation_stats cs;
END;
$$;