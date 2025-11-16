import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { monitoring } from '@/lib/monitoring';

interface PropertyDiffProps {
  property: any;
}

const PropertyDiff = ({ property }: PropertyDiffProps) => {
  const [previousData, setPreviousData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreviousVersion();
  }, [property.id]);

  const fetchPreviousVersion = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('property_moderation_history')
        .select('previous_data, rejection_reason')
        .eq('property_id', property.id)
        .eq('action', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPreviousData(data);
    } catch (error) {
      monitoring.error('Error fetching previous version', {
        component: 'PropertyDiff',
        propertyId: property.id,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!previousData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cambios Realizados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta es la primera vez que se envía esta propiedad.
          </p>
        </CardContent>
      </Card>
    );
  }

  const previousRejection = previousData.rejection_reason;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Historial de Revisión</span>
          <Badge variant="outline">Reenvío #{property.resubmission_count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {previousRejection && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200">
            <p className="text-sm font-semibold text-red-900">
              Rechazo anterior:
            </p>
            <p className="text-sm text-red-800 mt-1">
              {previousRejection.label}
            </p>
            {previousRejection.details && (
              <p className="text-xs text-red-700 mt-1">
                {previousRejection.details}
              </p>
            )}
          </div>
        )}

        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <p className="text-sm font-semibold text-blue-900">
            El agente ha corregido y reenviado esta propiedad
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Revisa cuidadosamente que los problemas anteriores hayan sido resueltos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold mb-1">Imágenes:</p>
            <p className="text-muted-foreground">{property.images?.length || 0} imágenes</p>
          </div>
          <div>
            <p className="font-semibold mb-1">Descripción:</p>
            <p className="text-muted-foreground">
              {property.description?.split(' ').filter(Boolean).length || 0} palabras
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Amenidades:</p>
            <p className="text-muted-foreground">
              {property.amenities?.reduce((acc: number, cat: any) => acc + cat.items.length, 0) || 0} amenidades
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Ubicación:</p>
            <p className="text-muted-foreground">
              {property.lat && property.lng ? 'Verificada' : 'Sin verificar'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyDiff;