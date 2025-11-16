import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Image } from 'lucide-react';
import { useMonitoring } from '@/lib/monitoring';

interface Conversation {
  id: string;
  property_id: string;
  buyer_id: string;
  agent_id: string;
  updated_at: string;
  property_title?: string;
  property_address?: string;
  other_user_name?: string;
  last_message?: string;
  last_message_time?: string;
  last_message_type?: string;
  unread_count: number;
}

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export const ConversationList = ({ selectedId, onSelect }: ConversationListProps) => {
  const { user } = useAuth();
  const { error: logError, captureException } = useMonitoring();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchConversations();

    // Suscribirse a cambios en mensajes para actualizar la lista
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Fetch conversaciones con datos relacionados
      const { data: convos, error: convosError } = await supabase
        .from('conversations')
        .select(`
          *,
          properties (
            title,
            address
          )
        `)
        .or(`buyer_id.eq.${user.id},agent_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (convosError) throw convosError;

      // Para cada conversación, obtener el último mensaje y el otro usuario
      const conversationsWithDetails = await Promise.all(
        (convos || []).map(async (convo) => {
          // Obtener último mensaje
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, message_type')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Obtener datos del otro usuario
          const otherUserId = convo.buyer_id === user.id ? convo.agent_id : convo.buyer_id;
          const { data: otherUser } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', otherUserId)
            .single();

          // Obtener unread count
          const { data: participant } = await supabase
            .from('conversation_participants')
            .select('unread_count')
            .eq('conversation_id', convo.id)
            .eq('user_id', user.id)
            .single();

          return {
            ...convo,
            property_title: convo.properties?.title,
            property_address: convo.properties?.address,
            other_user_name: otherUser?.name || 'Usuario',
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.created_at,
            last_message_type: lastMsg?.message_type,
            unread_count: participant?.unread_count || 0,
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      logError('Error fetching conversations', {
        component: 'ConversationList',
        userId: user?.id,
        error,
      });
      captureException(error as Error, {
        component: 'ConversationList',
        action: 'fetchConversations',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No tienes conversaciones</h3>
        <p className="text-sm text-muted-foreground">
          Inicia una conversación desde la página de una propiedad
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              selectedId === conversation.id
                ? 'bg-primary/10 border-primary text-foreground'
                : 'bg-card border-border hover:bg-accent/50 text-foreground'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{conversation.other_user_name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.property_title}
                </p>
              </div>
              {conversation.unread_count > 0 && (
                <Badge variant="default" className="ml-2 shrink-0">
                  {conversation.unread_count}
                </Badge>
              )}
            </div>
            {conversation.last_message && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {conversation.last_message_type === 'image' && (
                    <Image className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    {conversation.last_message_type === 'image' 
                      ? 'Imagen' 
                      : conversation.last_message}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(conversation.last_message_time!), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
