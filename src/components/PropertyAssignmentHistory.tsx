import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, ArrowRight, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMonitoring } from '@/lib/monitoring';

interface PropertyAssignmentHistoryProps {
  propertyId?: string;
  agencyId?: string;
  limit?: number;
}

export const PropertyAssignmentHistory = ({ 
  propertyId, 
  agencyId,
  limit 
}: PropertyAssignmentHistoryProps) => {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [propertyId, agencyId]);

  const fetchHistory = async () => {
    try {
      let query = supabase
        .from('property_assignment_history')
        .select(`
          *,
          properties (
            id,
            title,
            address,
            municipality,
            state
          ),
          previous_agent:previous_agent_id (
            id,
            name
          ),
          new_agent:new_agent_id (
            id,
            name
          ),
          assigner:assigned_by (
            id,
            name
          )
        `)
        .order('assigned_at', { ascending: false });

      // Filtrar por propiedad específica
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      // Filtrar por agencia (obtener todas las propiedades de la agencia)
      if (agencyId && !propertyId) {
        const { data: agencyProperties } = await supabase
          .from('properties')
          .select('id')
          .eq('agency_id', agencyId);

        if (agencyProperties && agencyProperties.length > 0) {
          const propertyIds = agencyProperties.map(p => p.id);
          query = query.in('property_id', propertyIds);
        }
      }

      // Limitar resultados
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching assignment history:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial de asignaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay historial de asignaciones
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Asignaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-primary" />
                {history.indexOf(entry) !== history.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                {/* Propiedad (si no es vista de una sola propiedad) */}
                {!propertyId && entry.properties && (
                  <div className="mb-2">
                    <p className="font-semibold text-sm">{entry.properties.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.properties.municipality}, {entry.properties.state}
                    </p>
                  </div>
                )}

                {/* Cambio de agente */}
                <div className="flex flex-wrap items-center gap-2">
                  {entry.previous_agent ? (
                    <>
                      <Badge variant="outline" className="gap-1">
                        <User className="h-3 w-3" />
                        {entry.previous_agent.name || 'Agente anterior'}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      Asignación inicial
                    </Badge>
                  )}
                  <Badge variant="default" className="gap-1">
                    <User className="h-3 w-3" />
                    {entry.new_agent?.name || 'Nuevo agente'}
                  </Badge>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(entry.assigned_at), "d 'de' MMMM, yyyy 'a las' HH:mm", {
                      locale: es,
                    })}
                  </span>
                  {entry.assigner && (
                    <>
                      <span>•</span>
                      <span>
                        Reasignado por: <strong>{entry.assigner.name}</strong>
                      </span>
                    </>
                  )}
                </div>

                {/* Notas */}
                {entry.notes && (
                  <p className="text-sm text-muted-foreground italic mt-2">
                    "{entry.notes}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
