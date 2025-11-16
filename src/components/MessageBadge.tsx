import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MessageBadge = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('unread_count')
        .eq('user_id', user.id);

      if (error) throw error;

      const total = data?.reduce((sum, item) => sum + item.unread_count, 0) || 0;
      setUnreadCount(total);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  if (!user) return null;

  return (
    <Link to="/mensajes" className="relative">
      <MessageCircle className="w-5 h-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 min-w-[1.25rem] flex items-center justify-center p-0 text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Link>
  );
};
