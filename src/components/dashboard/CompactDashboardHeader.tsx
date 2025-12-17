import { useMemo } from 'react';
import { Plus, Home, Eye, Bell, Crown, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CompactDashboardHeaderProps {
  profileName: string;
  planName?: string;
  planDisplayName?: string;
  activePropertiesCount: number;
  totalViews: number;
  pendingReminders: number;
  onNewProperty: () => void;
}

export const CompactDashboardHeader = ({
  profileName,
  planName,
  planDisplayName,
  activePropertiesCount,
  totalViews,
  pendingReminders,
  onNewProperty,
}: CompactDashboardHeaderProps) => {
  // Saludo según hora del día
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const firstName = profileName?.split(' ')[0] || 'Agente';

  // Determinar tier del plan para estilos del badge
  const planTier = useMemo(() => {
    if (!planName) return 'free';
    const lowerName = planName.toLowerCase();
    if (lowerName.includes('elite') || lowerName.includes('premium')) return 'elite';
    if (lowerName.includes('pro') || lowerName.includes('profesional')) return 'pro';
    if (lowerName.includes('basico') || lowerName.includes('basic')) return 'basic';
    if (lowerName.includes('trial')) return 'trial';
    return 'basic';
  }, [planName]);

  const tierConfig = {
    elite: {
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0',
      icon: Crown,
    },
    pro: {
      badge: 'bg-gradient-to-r from-primary to-secondary text-white border-0',
      icon: Sparkles,
    },
    basic: {
      badge: 'bg-secondary text-secondary-foreground border border-border',
      icon: Home,
    },
    trial: {
      badge: 'bg-blue-500 text-white border-0',
      icon: TrendingUp,
    },
    free: {
      badge: 'bg-muted text-muted-foreground border border-border',
      icon: Home,
    },
  };

  const currentTier = tierConfig[planTier] || tierConfig.basic;
  const TierIcon = currentTier.icon;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
      {/* Left: Greeting + Plan Badge + Stats */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Greeting + Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground truncate">
            {greeting}, <span className="text-primary">{firstName}</span>
          </h1>
          {planDisplayName && (
            <Badge className={`${currentTier.badge} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide`}>
              <TierIcon className="w-3 h-3 mr-1" />
              {planDisplayName}
            </Badge>
          )}
        </div>
        
        {/* Row 2: Inline Stats */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Home className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">{activePropertiesCount}</span>
            <span className="hidden xs:inline">activas</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-accent" />
            <span className="font-medium text-foreground">{totalViews.toLocaleString()}</span>
            <span className="hidden xs:inline">vistas</span>
          </div>
          {pendingReminders > 0 && (
            <>
              <span className="text-border">•</span>
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-amber-600">{pendingReminders}</span>
                <span className="hidden xs:inline">alertas</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: CTA Button */}
      <Button 
        onClick={onNewProperty}
        size="default"
        className="h-11 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/20 text-primary-foreground font-semibold px-5 rounded-xl whitespace-nowrap"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nueva Propiedad
      </Button>
    </div>
  );
};
