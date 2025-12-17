import { useMemo } from 'react';
import { Plus, TrendingUp, Eye, Home, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardHeroProps {
  profileName: string;
  planName?: string;
  planDisplayName?: string;
  status?: string;
  activePropertiesCount: number;
  totalViews?: number;
  onNewProperty: () => void;
}

export const DashboardHero = ({
  profileName,
  planName,
  planDisplayName,
  status,
  activePropertiesCount,
  totalViews = 0,
  onNewProperty,
}: DashboardHeroProps) => {
  // Saludo según hora del día
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // Primer nombre
  const firstName = profileName?.split(' ')[0] || 'Agente';

  // Determinar tier del plan para estilos
  const planTier = useMemo(() => {
    if (!planName) return 'free';
    const lowerName = planName.toLowerCase();
    if (lowerName.includes('elite') || lowerName.includes('premium')) return 'elite';
    if (lowerName.includes('pro') || lowerName.includes('profesional')) return 'pro';
    if (lowerName.includes('basico') || lowerName.includes('basic')) return 'basic';
    if (lowerName.includes('trial')) return 'trial';
    return 'basic';
  }, [planName]);

  // Estilos según tier
  const tierStyles = {
    elite: {
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-lg shadow-amber-500/30',
      gradient: 'from-amber-50 via-card to-yellow-50/50',
      icon: Crown,
      iconColor: 'text-amber-500',
    },
    pro: {
      badge: 'bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-lg shadow-primary/30',
      gradient: 'from-primary/5 via-card to-accent/5',
      icon: Sparkles,
      iconColor: 'text-primary',
    },
    basic: {
      badge: 'bg-secondary text-secondary-foreground border border-border',
      gradient: 'from-muted/30 via-card to-muted/20',
      icon: Home,
      iconColor: 'text-secondary',
    },
    trial: {
      badge: 'bg-blue-500 text-white border-0',
      gradient: 'from-blue-50/50 via-card to-indigo-50/30',
      icon: TrendingUp,
      iconColor: 'text-blue-500',
    },
    free: {
      badge: 'bg-muted text-muted-foreground border border-border',
      gradient: 'from-muted/20 via-card to-muted/10',
      icon: Home,
      iconColor: 'text-muted-foreground',
    },
  };

  const currentTier = tierStyles[planTier] || tierStyles.basic;
  const TierIcon = currentTier.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${currentTier.gradient} border border-border shadow-xl p-6 md:p-8 mb-6`}>
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-accent/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Welcome & Info */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-foreground leading-tight">
              {greeting}, <span className="text-primary">{firstName}</span>
            </h1>
            {planDisplayName && (
              <Badge 
                className={`${currentTier.badge} px-3 py-1.5 text-xs font-bold uppercase tracking-wide`}
              >
                <TierIcon className="w-3.5 h-3.5 mr-1.5" />
                {planDisplayName}
              </Badge>
            )}
          </div>
          
          <p className="text-muted-foreground text-base md:text-lg mb-6 max-w-lg">
            Gestiona tus propiedades y maximiza tu presencia en Kentra
          </p>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm rounded-xl p-3 pr-5 border border-border/50 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Home className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{activePropertiesCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Propiedades Activas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm rounded-xl p-3 pr-5 border border-border/50 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{totalViews.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Vistas Totales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <Button 
            onClick={onNewProperty}
            size="lg"
            className="h-14 bg-gradient-to-r from-primary via-primary to-secondary hover:from-primary/90 hover:via-primary/90 hover:to-secondary/90 shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 text-primary-foreground font-bold text-base px-8 rounded-xl"
          >
            <Plus className="mr-2 h-5 w-5" />
            Publicar Propiedad
          </Button>
        </div>
      </div>
    </div>
  );
};
