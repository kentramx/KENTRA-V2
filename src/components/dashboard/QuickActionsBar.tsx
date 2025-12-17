import { Plus, Star, BarChart3, MessageCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const actions = [
    {
      id: 'new',
      label: 'Nueva Propiedad',
      icon: Plus,
      onClick: onNewProperty,
      primary: true,
    },
    {
      id: 'featured',
      label: 'Destacar',
      icon: Star,
      onClick: onViewServices,
      badge: null,
    },
    {
      id: 'analytics',
      label: 'Analíticas',
      icon: BarChart3,
      onClick: onViewAnalytics,
      badge: null,
    },
    {
      id: 'messages',
      label: 'Mensajes',
      icon: MessageCircle,
      onClick: () => window.location.href = '/mensajes',
      badge: unreadMessages > 0 ? unreadMessages : null,
    },
    {
      id: 'subscription',
      label: 'Suscripción',
      icon: Settings,
      onClick: onViewSubscription,
      badge: pendingReminders > 0 ? '!' : null,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 p-3 md:p-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl shadow-lg mb-6">
      <TooltipProvider delayDuration={300}>
        {actions.map((action) => {
          const Icon = action.icon;
          
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={action.primary ? 'default' : 'ghost'}
                  size="sm"
                  onClick={action.onClick}
                  className={`relative ${
                    action.primary 
                      ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20 text-primary-foreground' 
                      : 'hover:bg-muted'
                  } transition-all duration-200 hover:scale-105`}
                >
                  <Icon className={`h-4 w-4 ${action.primary ? '' : 'mr-0 md:mr-2'}`} />
                  <span className={`hidden md:inline ${action.primary ? 'ml-2' : ''}`}>
                    {action.label}
                  </span>
                  
                  {action.badge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold animate-pulse"
                    >
                      {action.badge}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="md:hidden">
                <p>{action.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
};
