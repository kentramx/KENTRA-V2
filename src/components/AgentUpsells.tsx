import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UpsellCard } from './UpsellCard';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';

interface AgentUpsellsProps {
  onPurchase: (upsellId: string) => void;
}

export const AgentUpsells = ({ onPurchase }: AgentUpsellsProps) => {
  const { toast } = useToast();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { isImpersonating } = useRoleImpersonation();

  const { data: upsells = [], isLoading } = useQuery({
    queryKey: ['agent-upsells'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('upsells')
        .select('*')
        .in('user_type', ['agent', 'both'])
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handlePurchase = async (upsellId: string) => {
    if (isImpersonating) {
      toast({
        title: 'Acción no disponible',
        description: 'No puedes comprar upsells en modo simulación',
        variant: 'destructive',
      });
      return;
    }

    setPurchasingId(upsellId);
    try {
      await onPurchase(upsellId);
    } finally {
      setPurchasingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Categorizar upsells
  const propertySlots = upsells.filter(u => u.name.toLowerCase().includes('slot'));
  const visibilityUpsells = upsells.filter(u => !u.name.toLowerCase().includes('slot'));

  return (
    <div className="space-y-8">
      {/* Sección: Publica Más Propiedades */}
      {propertySlots.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Publica Más Propiedades</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propertySlots.map(upsell => (
              <UpsellCard
                key={upsell.id}
                upsell={upsell}
                onPurchase={handlePurchase}
                loading={purchasingId === upsell.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sección: Aumenta tu Visibilidad */}
      {visibilityUpsells.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Aumenta tu Visibilidad</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibilityUpsells.map(upsell => (
              <UpsellCard
                key={upsell.id}
                upsell={upsell}
                onPurchase={handlePurchase}
                loading={purchasingId === upsell.id}
              />
            ))}
          </div>
        </div>
      )}

      {upsells.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay servicios adicionales disponibles en este momento
        </div>
      )}
    </div>
  );
};
