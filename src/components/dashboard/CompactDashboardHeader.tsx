import { useMemo } from 'react';
import { Plus, AlertTriangle, Building2, Users, HardHat, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getPlanTier, PLAN_TIER_CONFIG, METRIC_ICONS } from '@/config/planTierConfig';

interface SubscriptionInfo {
  status: string;
  planName?: string;
  currentPeriodEnd?: string;
  maxProperties?: number;
  featuredPerMonth?: number;
  maxAgents?: number;
  maxProjects?: number;
}

export type DashboardType = 'agent' | 'agency' | 'developer';

interface CompactDashboardHeaderProps {
  profileName: string;
  planName?: string;
  planDisplayName?: string;
  totalViews: number;
  pendingReminders: number;
  onNewProperty: () => void;
  subscriptionInfo?: SubscriptionInfo;
  
  // Type of dashboard
  dashboardType?: DashboardType;
  
  // Agent-specific
  activePropertiesCount?: number;
  featuredCount?: number;
  
  // Agency-specific
  inventoryCount?: number;
  teamAgentsCount?: number;
  
  // Developer-specific
  projectsCount?: number;
  teamMembersCount?: number;
  
  // Custom labels
  newButtonLabel?: string;
}

export const CompactDashboardHeader = ({
  profileName,
  planName,
  planDisplayName,
  totalViews,
  pendingReminders,
  onNewProperty,
  subscriptionInfo,
  dashboardType = 'agent',
  activePropertiesCount = 0,
  featuredCount = 0,
  inventoryCount = 0,
  teamAgentsCount = 0,
  projectsCount = 0,
  teamMembersCount = 0,
  newButtonLabel,
}: CompactDashboardHeaderProps) => {
  // Saludo según hora del día
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const firstName = profileName?.split(' ')[0] || 'Usuario';

  // Usar config centralizado
  const planTier = useMemo(() => getPlanTier(planName), [planName]);
  const currentTier = PLAN_TIER_CONFIG[planTier];
  const TierIcon = currentTier.icon;

  // Metric icons from centralized config
  const HomeIcon = METRIC_ICONS.properties;
  const FeaturedIcon = METRIC_ICONS.featured;
  const ViewsIcon = METRIC_ICONS.views;
  const AlertsIcon = METRIC_ICONS.alerts;
  const RenewalIcon = METRIC_ICONS.renewal;

  // Calculate subscription metrics based on dashboard type
  const maxProperties = subscriptionInfo?.maxProperties || 5;
  const maxFeatured = subscriptionInfo?.featuredPerMonth || 1;
  const maxAgents = subscriptionInfo?.maxAgents || 5;
  const maxProjects = subscriptionInfo?.maxProjects || 3;
  
  const propertyUsage = Math.min((activePropertiesCount / maxProperties) * 100, 100);
  const featuredUsage = Math.min((featuredCount / maxFeatured) * 100, 100);
  const inventoryUsage = Math.min((inventoryCount / maxProperties) * 100, 100);
  const agentsUsage = Math.min((teamAgentsCount / maxAgents) * 100, 100);
  const projectsUsage = Math.min((projectsCount / maxProjects) * 100, 100);
  const teamUsage = Math.min((teamMembersCount / maxAgents) * 100, 100);
  
  // Days until renewal
  const daysUntilRenewal = useMemo(() => {
    if (!subscriptionInfo?.currentPeriodEnd) return null;
    const endDate = new Date(subscriptionInfo.currentPeriodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [subscriptionInfo?.currentPeriodEnd]);

  // Alerts
  const isNearPropertyLimit = dashboardType === 'agent' 
    ? propertyUsage >= 80 
    : dashboardType === 'agency' 
    ? inventoryUsage >= 80 
    : projectsUsage >= 80;
  const isTrialEnding = planTier === 'trial' && daysUntilRenewal !== null && daysUntilRenewal <= 3;
  const isPendingPayment = subscriptionInfo?.status === 'incomplete';

  // Dynamic button label
  const buttonLabel = newButtonLabel || (
    dashboardType === 'developer' ? 'Nuevo Proyecto' : 'Nueva Propiedad'
  );

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${currentTier.gradient} border border-border shadow-xl mb-4 md:mb-6`}>
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
      
      <div className="relative z-10 p-4 md:p-5">
        {/* Row 1: Greeting + Badge + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
              {greeting}, <span className={currentTier.accent}>{firstName}</span>
            </h1>
            {planDisplayName && (
              <Badge className={`${currentTier.badge} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide`}>
                <TierIcon className="w-3 h-3 mr-1" />
                {planDisplayName}
              </Badge>
            )}
          </div>
          
          <Button 
            onClick={onNewProperty}
            size="default"
            className="h-11 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-xl shadow-primary/30 text-primary-foreground font-semibold px-5 rounded-xl whitespace-nowrap transition-all hover:-translate-y-0.5"
          >
            <Plus className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </div>
        
        {/* Row 2: Stats - Dynamic based on dashboard type */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
          
          {/* AGENT: Properties + Featured */}
          {dashboardType === 'agent' && (
            <>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <HomeIcon className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Propiedades</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{activePropertiesCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxProperties}</span>
                </div>
                <Progress value={propertyUsage} className="h-1 mt-1.5" />
                {isNearPropertyLimit && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Cerca del límite
                  </p>
                )}
              </div>

              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <FeaturedIcon className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Destacadas</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{featuredCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxFeatured}</span>
                </div>
                <Progress value={featuredUsage} className="h-1 mt-1.5" />
              </div>
            </>
          )}

          {/* AGENCY: Inventory + Team Agents */}
          {dashboardType === 'agency' && (
            <>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <Building2 className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Inventario</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{inventoryCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxProperties}</span>
                </div>
                <Progress value={inventoryUsage} className="h-1 mt-1.5" />
                {isNearPropertyLimit && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Cerca del límite
                  </p>
                )}
              </div>

              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Agentes</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{teamAgentsCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxAgents}</span>
                </div>
                <Progress value={agentsUsage} className="h-1 mt-1.5" />
              </div>
            </>
          )}

          {/* DEVELOPER: Projects + Team Members */}
          {dashboardType === 'developer' && (
            <>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <FolderKanban className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Proyectos</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{projectsCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxProjects}</span>
                </div>
                <Progress value={projectsUsage} className="h-1 mt-1.5" />
                {isNearPropertyLimit && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Cerca del límite
                  </p>
                )}
              </div>

              <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <HardHat className={`w-4 h-4 ${currentTier.accent}`} />
                  <span className="text-xs text-muted-foreground">Equipo</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{teamMembersCount}</span>
                  <span className="text-xs text-muted-foreground">/ {maxAgents}</span>
                </div>
                <Progress value={teamUsage} className="h-1 mt-1.5" />
              </div>
            </>
          )}

          {/* Common: Views */}
          <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <ViewsIcon className={`w-4 h-4 ${currentTier.accent}`} />
              <span className="text-xs text-muted-foreground">Vistas</span>
            </div>
            <span className="text-lg font-bold text-foreground">{totalViews.toLocaleString()}</span>
          </div>

          {/* Common: Reminders/Alerts */}
          <div className="bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertsIcon className={`w-4 h-4 ${pendingReminders > 0 ? 'text-amber-500' : currentTier.accent}`} />
              <span className="text-xs text-muted-foreground">Alertas</span>
            </div>
            <span className={`text-lg font-bold ${pendingReminders > 0 ? 'text-amber-600' : 'text-foreground'}`}>
              {pendingReminders}
            </span>
          </div>

          {/* Common: Renewal / Trial */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-card/60 backdrop-blur-sm rounded-xl border border-border/50 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <RenewalIcon className={`w-4 h-4 ${isTrialEnding ? 'text-amber-500' : currentTier.accent}`} />
              <span className="text-xs text-muted-foreground">
                {planTier === 'trial' ? 'Trial' : 'Renovación'}
              </span>
            </div>
            {daysUntilRenewal !== null ? (
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${isTrialEnding ? 'text-amber-600' : 'text-foreground'}`}>
                  {daysUntilRenewal}
                </span>
                <span className="text-xs text-muted-foreground">días</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
            {isTrialEnding && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Trial por vencer
              </p>
            )}
            {isPendingPayment && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Pago pendiente
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
