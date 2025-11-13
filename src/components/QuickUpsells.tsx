import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UpsellCard } from './UpsellCard';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';

interface QuickUpsellsProps {
  subscriptionInfo: any;
  activePropertiesCount: number;
  onPurchase: (upsellId: string) => void;
  onViewAll: () => void;
}

export const QuickUpsells = ({ 
  subscriptionInfo, 
  activePropertiesCount,
  onPurchase,
  onViewAll
}: QuickUpsellsProps) => {
  const { toast } = useToast();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { isImpersonating } = useRoleImpersonation();

  const { data: allUpsells = [], isLoading } = useQuery({
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Determinar cuáles mostrar según contexto
  const propertiesLimit = subscriptionInfo?.properties_limit || 0;
  const usagePercent = propertiesLimit > 0 ? (activePropertiesCount / propertiesLimit) : 0;
  
  // Priorizar slot adicional si está cerca del límite
  const slotUpsell = allUpsells.find(u => u.name.toLowerCase().includes('slot'));
  const featuredUpsells = allUpsells.filter(u => u.name.toLowerCase().includes('destacar'));
  const premiumUpsells = allUpsells.filter(u => 
    u.name.toLowerCase().includes('portada') || u.name.toLowerCase().includes('newsletter')
  );

  const recommendedUpsells = [];
  
  // Si está al 80%+ del límite, mostrar slot adicional primero
  if (usagePercent >= 0.8 && slotUpsell) {
    recommendedUpsells.push({ ...slotUpsell, recommended: true });
  }
  
  // Agregar 1 upsell de destacar
  if (featuredUpsells.length > 0) {
    recommendedUpsells.push(featuredUpsells[0]);
  }
  
  // Agregar 1 premium
  if (premiumUpsells.length > 0 && recommendedUpsells.length < 3) {
    recommendedUpsells.push(premiumUpsells[0]);
  }

  // Si no alcanzamos 3, llenar con lo que haya
  while (recommendedUpsells.length < 3 && recommendedUpsells.length < allUpsells.length) {
    const remaining = allUpsells.filter(u => 
      !recommendedUpsells.find(r => r.id === u.id)
    );
    if (remaining.length > 0) {
      recommendedUpsells.push(remaining[0]);
    } else {
      break;
    }
  }

  if (recommendedUpsells.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Servicios Adicionales</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            Ver todos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedUpsells.map(upsell => (
            <UpsellCard
              key={upsell.id}
              upsell={{
                ...upsell,
                badge: upsell.recommended ? 'Recomendado' : upsell.badge,
              }}
              onPurchase={handlePurchase}
              compact
              loading={purchasingId === upsell.id}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
