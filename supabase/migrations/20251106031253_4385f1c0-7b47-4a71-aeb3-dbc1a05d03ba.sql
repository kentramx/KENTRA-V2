-- Crear tabla de conversaciones
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, buyer_id, agent_id)
);

-- Crear tabla de mensajes
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índice para queries rápidas de mensajes
CREATE INDEX idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);

-- Crear tabla de participantes de conversación
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(conversation_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies para conversations
CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = agent_id);

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = agent_id);

-- RLS Policies para messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.agent_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.buyer_id = auth.uid() OR conversations.agent_id = auth.uid())
  )
);

-- RLS Policies para conversation_participants
CREATE POLICY "Users can view own participant records"
ON public.conversation_participants
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own participant records"
ON public.conversation_participants
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert participant records"
ON public.conversation_participants
FOR INSERT
WITH CHECK (true);

-- Función para actualizar updated_at en conversations cuando hay nuevo mensaje
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Trigger para actualizar timestamp de conversación
CREATE TRIGGER on_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp();

-- Función para incrementar unread_count cuando llega un mensaje
CREATE OR REPLACE FUNCTION public.increment_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
  AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$$;

-- Trigger para incrementar contador de no leídos
CREATE TRIGGER on_message_increment_unread
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.increment_unread_count();

-- Función para crear participants cuando se crea una conversación
CREATE OR REPLACE FUNCTION public.create_conversation_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id, unread_count)
  VALUES 
    (NEW.id, NEW.buyer_id, 0),
    (NEW.id, NEW.agent_id, 0);
  RETURN NEW;
END;
$$;

-- Trigger para crear participants automáticamente
CREATE TRIGGER on_conversation_created
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.create_conversation_participants();

-- Habilitar Realtime para las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;