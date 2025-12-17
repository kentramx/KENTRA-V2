import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UpsellCard } from './UpsellCard';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowRight, Loader2, Sparkles, Star, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import { Badge } from './ui/badge';

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
      <Card className="border-border shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando servicios...</p>
          </div>
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
    <Card className="border-border shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Potencia tu Alcance</CardTitle>
              <p className="text-sm text-muted-foreground">Servicios para destacar tus propiedades</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="text-primary hover:text-primary/80 hover:bg-primary/10 font-semibold"
          >
            Ver todos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedUpsells.map((upsell, index) => (
            <div 
              key={upsell.id}
              className={`relative rounded-xl border p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                upsell.recommended 
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-md' 
                  : 'bg-card border-border hover:border-primary/30'
              }`}
            >
              {/* Badge */}
              {(upsell.recommended || index === 0) && (
                <Badge 
                  className={`absolute -top-2 -right-2 ${
                    upsell.recommended 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' 
                      : 'bg-primary text-primary-foreground'
                  } shadow-lg`}
                >
                  {upsell.recommended ? (
                    <>
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Recomendado
                    </>
                  ) : (
                    <>
                      <Star className="w-3 h-3 mr-1" />
                      Popular
                    </>
                  )}
                </Badge>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center ${
                upsell.recommended ? 'bg-amber-100' : 'bg-primary/10'
              }`}>
                <Star className={`w-6 h-6 ${upsell.recommended ? 'text-amber-600' : 'text-primary'}`} />
              </div>

              {/* Content */}
              <h4 className="font-bold text-foreground mb-1">{upsell.name}</h4>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {upsell.description || 'Mejora la visibilidad de tus propiedades'}
              </p>

              {/* Price & Button */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                <div>
                  <span className="text-xl font-bold text-foreground">
                    ${upsell.price?.toLocaleString('es-MX') || '0'}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">MXN</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePurchase(upsell.id)}
                  disabled={purchasingId === upsell.id}
                  className={`font-semibold ${
                    upsell.recommended 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' 
                      : ''
                  }`}
                >
                  {purchasingId === upsell.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Comprar'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
