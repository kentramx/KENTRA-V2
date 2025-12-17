import { useMemo } from 'react';
import { Plus, TrendingUp, Eye, Home, Sparkles } from 'lucide-react';
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
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-0',
      glow: 'shadow-amber-500/20',
      icon: Sparkles,
    },
    pro: {
      badge: 'bg-gradient-to-r from-primary to-accent text-primary-foreground border-0',
      glow: 'shadow-primary/20',
      icon: TrendingUp,
    },
    basic: {
      badge: 'bg-secondary text-secondary-foreground',
      glow: '',
      icon: Home,
    },
    trial: {
      badge: 'bg-muted text-muted-foreground border-dashed',
      glow: '',
      icon: Home,
    },
    free: {
      badge: 'bg-muted text-muted-foreground',
      glow: '',
      icon: Home,
    },
  };

  const currentTier = tierStyles[planTier] || tierStyles.basic;
  const TierIcon = currentTier.icon;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 p-6 md:p-8 mb-6">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Welcome & Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-foreground">
              {greeting}, {firstName}
            </h1>
            {planDisplayName && (
              <Badge 
                className={`${currentTier.badge} ${currentTier.glow} shadow-lg px-3 py-1 text-xs font-semibold`}
              >
                <TierIcon className="w-3 h-3 mr-1" />
                {planDisplayName}
              </Badge>
            )}
          </div>
          
          <p className="text-muted-foreground text-sm md:text-base mb-4">
            Gestiona tus propiedades y maximiza tu presencia en Kentra
          </p>

          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Home className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{activePropertiesCount}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </div>
            
            <div className="w-px h-10 bg-border" />
            
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Vistas totales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <Button 
            onClick={onNewProperty}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 text-primary-foreground font-semibold px-6"
          >
            <Plus className="mr-2 h-5 w-5" />
            Publicar Propiedad
          </Button>
        </div>
      </div>
    </div>
  );
};
