import { useNavigate } from 'react-router-dom';
import { Plus, Star, BarChart3, MessageCircle, CreditCard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QuickActionsBarProps {
  onNewProperty: () => void;
  onViewAnalytics: () => void;
  onViewServices: () => void;
  onViewSubscription: () => void;
  unreadMessages?: number;
  pendingReminders?: number;
}

export const QuickActionsBar = ({
  onNewProperty,
  onViewAnalytics,
  onViewServices,
  onViewSubscription,
  unreadMessages = 0,
  pendingReminders = 0,
}: QuickActionsBarProps) => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'new',
      label: 'Nueva Propiedad',
      shortLabel: 'Nueva',
      icon: Plus,
      onClick: onNewProperty,
      primary: true,
      className: 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg shadow-primary/25',
    },
    {
      id: 'featured',
      label: 'Destacar Propiedad',
      shortLabel: 'Destacar',
      icon: Star,
      onClick: onViewServices,
      badge: null,
      className: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/30',
    },
    {
      id: 'analytics',
      label: 'Ver Analíticas',
      shortLabel: 'Analíticas',
      icon: BarChart3,
      onClick: onViewAnalytics,
      badge: null,
      className: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border border-blue-500/30',
    },
    {
      id: 'messages',
      label: 'Mensajes',
      shortLabel: 'Mensajes',
      icon: MessageCircle,
      onClick: () => navigate('/mensajes'),
      badge: unreadMessages > 0 ? unreadMessages : null,
      className: 'bg-green-500/10 text-green-700 hover:bg-green-500/20 border border-green-500/30',
    },
    {
      id: 'subscription',
      label: 'Mi Suscripción',
      shortLabel: 'Plan',
      icon: CreditCard,
      onClick: onViewSubscription,
      badge: pendingReminders > 0 ? '!' : null,
      className: 'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border border-purple-500/30',
    },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Acciones Rápidas</span>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          
          return (
            <Button
              key={action.id}
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className={`relative h-11 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] ${action.className}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{action.label}</span>
              <span className="sm:hidden">{action.shortLabel}</span>
              
              {action.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold"
                >
                  {action.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
