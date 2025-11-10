import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AutoApprovalStatsData {
  total_auto_approved: number;
  auto_approved_by_ai: number;
  auto_approved_legacy: number;
  avg_ai_score_auto_approved: number;
}

const AutoApprovalStats = () => {
  const [stats, setStats] = useState<AutoApprovalStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_auto_approval_stats');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching auto-approval stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const aiPercentage = stats.total_auto_approved > 0 
    ? Math.round((stats.auto_approved_by_ai / stats.total_auto_approved) * 100)
    : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle>Auto-Aprobación Inteligente</CardTitle>
        </div>
        <CardDescription>
          Estadísticas de aprobaciones automáticas en los últimos 30 días
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Total Auto-Aprobadas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>Total Auto-Aprobadas</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {stats.total_auto_approved}
            </div>
          </div>

          {/* Por IA + Agente Confiable */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>IA + Agente Confiable</span>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.auto_approved_by_ai}
            </div>
            <Badge variant="secondary" className="text-xs">
              {aiPercentage}% del total
            </Badge>
          </div>

          {/* Solo Agente Confiable (Legacy) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>Solo Agente Confiable</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.auto_approved_legacy}
            </div>
            <Badge variant="outline" className="text-xs">
              Sin análisis IA
            </Badge>
          </div>

          {/* Score Promedio IA */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Score Promedio IA</span>
            </div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.avg_ai_score_auto_approved 
                ? Math.round(stats.avg_ai_score_auto_approved) 
                : 'N/A'}
            </div>
            {stats.avg_ai_score_auto_approved && (
              <Badge variant="secondary" className="text-xs">
                de 100
              </Badge>
            )}
          </div>

        </div>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Brain className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Sistema de Auto-Aprobación Inteligente</p>
              <p className="text-muted-foreground">
                Las propiedades se auto-aprueban cuando el agente es confiable (20+ aprobaciones consecutivas) 
                <strong className="text-foreground"> Y </strong>
                el score de IA es ≥95/100.
              </p>
              <p className="text-muted-foreground">
                Esto reduce la carga de moderación manual mientras mantiene altos estándares de calidad.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoApprovalStats;
