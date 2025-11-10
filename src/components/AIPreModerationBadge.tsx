import { Badge } from '@/components/ui/badge';
import { Brain, CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIPreModerationBadgeProps {
  score?: number;
  status?: 'pass' | 'review' | 'reject' | 'pending';
  notes?: string;
  moderatedAt?: string;
  compact?: boolean;
}

const AIPreModerationBadge = ({ 
  score, 
  status, 
  notes,
  moderatedAt,
  compact = false 
}: AIPreModerationBadgeProps) => {
  if (!status || status === 'pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {!compact && <span>Sin análisis IA</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Esta propiedad no ha sido pre-moderada por IA</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'pass':
        return {
          variant: 'default' as const,
          icon: CheckCircle2,
          label: 'IA: Aprobar',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
        };
      case 'review':
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          label: 'IA: Revisar',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
        };
      case 'reject':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          label: 'IA: Rechazar',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
        };
      default:
        return {
          variant: 'outline' as const,
          icon: Brain,
          label: 'IA: Pendiente',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const tooltipContent = (
    <div className="space-y-2 max-w-sm">
      <div className="flex items-center gap-2 font-semibold">
        <Brain className="h-4 w-4" />
        <span>Análisis de IA</span>
      </div>
      {score !== undefined && (
        <div>
          <span className="font-medium">Score: </span>
          <span className={config.color}>{score}/100</span>
        </div>
      )}
      {notes && (
        <div>
          <span className="font-medium">Notas:</span>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
            {notes}
          </p>
        </div>
      )}
      {moderatedAt && (
        <div className="text-xs text-muted-foreground">
          Analizado: {new Date(moderatedAt).toLocaleString('es-MX')}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge 
            variant={config.variant}
            className={`gap-1 ${config.bgColor}`}
          >
            <Icon className={`h-3 w-3 ${config.color}`} />
            {!compact && (
              <>
                <span>{config.label}</span>
                {score !== undefined && (
                  <span className="font-semibold">({score})</span>
                )}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-md">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AIPreModerationBadge;
