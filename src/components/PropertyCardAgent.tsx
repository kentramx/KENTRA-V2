import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Star, 
  Eye, 
  Edit, 
  Trash2, 
  RefreshCw, 
  MapPin,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RejectionRecord {
  date: string;
  reasons: string[];
  comments: string;
  reviewed_by: string;
  resubmission_number: number;
}

interface PropertyCardAgentProps {
  property: {
    id: string;
    title: string;
    price: number;
    type: string;
    status: string;
    municipality: string;
    state: string;
    colonia?: string;
    property_code?: string;
    expires_at: string | null;
    images?: { url: string }[];
    rejection_history?: RejectionRecord[];
    resubmission_count?: number;
  };
  isFeatured: boolean;
  subscriptionInfo?: {
    featured_used: number;
    featured_limit: number;
  } | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onRenew: () => void;
  onResubmit?: () => void;
  onReactivate?: () => void;
  isTogglingFeatured?: boolean;
}

export const PropertyCardAgent = ({
  property,
  isFeatured,
  subscriptionInfo,
  onView,
  onEdit,
  onDelete,
  onToggleFeatured,
  onRenew,
  onResubmit,
  onReactivate,
  isTogglingFeatured = false,
}: PropertyCardAgentProps) => {
  const [imageError, setImageError] = useState(false);
  
  const getDaysUntilExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const daysLeft = getDaysUntilExpiration(property.expires_at);
  const isExpiringSoon = daysLeft <= 7;
  const isRejected = property.status === 'pausada' && property.rejection_history?.length;
  const isPending = property.status === 'pendiente_aprobacion';
  const canFeature = subscriptionInfo 
    ? subscriptionInfo.featured_used < subscriptionInfo.featured_limit
    : false;

  // Circular progress for days remaining
  const maxDays = 30;
  const progress = Math.min(daysLeft / maxDays, 1) * 100;
  const getProgressColor = () => {
    if (daysLeft <= 3) return 'text-destructive';
    if (daysLeft <= 7) return 'text-amber-500';
    return 'text-primary';
  };

  const getStatusInfo = () => {
    if (isRejected) {
      return { label: 'Rechazada', variant: 'destructive' as const, icon: '❌' };
    }
    if (isPending) {
      return { label: 'En revisión', variant: 'outline' as const, icon: '⏳', className: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    if (property.status === 'activa') {
      return { label: 'Activa', variant: 'default' as const, icon: '✓' };
    }
    if (property.status === 'pausada') {
      return { label: 'Pausada', variant: 'secondary' as const, icon: '⏸' };
    }
    return { label: property.status, variant: 'outline' as const };
  };

  const statusInfo = getStatusInfo();
  const imageUrl = property.images?.[0]?.url;

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-200 hover:shadow-lg",
      isFeatured && "ring-2 ring-primary/50",
      isExpiringSoon && "ring-2 ring-destructive/30"
    )}>
      {/* Image container with overlays */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Sin imagen
          </div>
        )}

        {/* Status badge */}
        <Badge 
          variant={statusInfo.variant} 
          className={cn("absolute top-2 left-2", statusInfo.className)}
        >
          {statusInfo.icon} {statusInfo.label}
        </Badge>

        {/* Featured star toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-2 right-2 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm transition-all",
                isFeatured 
                  ? "text-amber-500 hover:text-amber-600" 
                  : "text-muted-foreground hover:text-amber-500",
                !canFeature && !isFeatured && "opacity-50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured();
              }}
              disabled={isTogglingFeatured || (!canFeature && !isFeatured) || isPending}
            >
              {isTogglingFeatured ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Star className={cn("h-5 w-5", isFeatured && "fill-current")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFeatured 
              ? "Quitar de destacadas" 
              : canFeature 
                ? "Destacar propiedad" 
                : `Sin slots (${subscriptionInfo?.featured_used}/${subscriptionInfo?.featured_limit})`
            }
          </TooltipContent>
        </Tooltip>

        {/* Days remaining indicator */}
        {property.status === 'activa' && (
          <div className="absolute bottom-2 right-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
                  getProgressColor()
                )}>
                  <div className="relative h-4 w-4">
                    <svg className="h-4 w-4 -rotate-90 transform">
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeOpacity="0.2"
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${progress * 0.377} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span>{daysLeft}d</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {daysLeft === 0 ? '¡Expira hoy!' : `Vence en ${daysLeft} días`}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Featured badge */}
        {isFeatured && (
          <Badge className="absolute bottom-2 left-2 gap-1 bg-primary">
            <Star className="h-3 w-3 fill-current" />
            Destacada
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Title and code */}
        <div className="mb-2">
          <h3 className="font-semibold text-foreground line-clamp-1">{property.title}</h3>
          <Badge variant="outline" className="font-mono text-xs mt-1">
            {property.property_code || property.id.slice(0, 8)}
          </Badge>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {property.colonia ? `${property.colonia}, ` : ''}
            {property.municipality}
          </span>
        </div>

        {/* Price and type */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-lg text-foreground">
            {formatPrice(property.price)}
          </span>
          <Badge variant="outline" className="text-xs">
            {property.type}
          </Badge>
        </div>

        {/* Rejection info */}
        {isRejected && property.rejection_history && (
          <div className="mb-3 rounded-md bg-destructive/10 p-2 text-xs">
            <p className="font-medium text-destructive">
              Motivo: {property.rejection_history[property.rejection_history.length - 1]?.reasons?.join(', ')}
            </p>
            <p className="text-muted-foreground mt-1">
              Intentos: {property.resubmission_count || 0}/3
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
            Ver
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1" 
            onClick={onEdit}
            disabled={isPending}
          >
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar</TooltipContent>
          </Tooltip>
        </div>

        {/* Renewal / Bump / Resubmit actions */}
        {property.status === 'activa' && isExpiringSoon && (
          <Button 
            variant={daysLeft <= 3 ? 'destructive' : 'secondary'} 
            size="sm" 
            className="w-full mt-2 gap-1"
            onClick={onRenew}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {daysLeft <= 3 ? '¡Renovar ahora!' : 'Renovar (+30 días)'}
          </Button>
        )}

        {isRejected && onResubmit && (property.resubmission_count || 0) < 3 && (
          <Button 
            variant="default" 
            size="sm" 
            className="w-full mt-2 gap-1"
            onClick={onResubmit}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reenviar ({3 - (property.resubmission_count || 0)} intentos)
          </Button>
        )}

        {property.status === 'pausada' && !isRejected && onReactivate && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={onReactivate}
          >
            Reactivar
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
