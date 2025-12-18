import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Zap, Mail, Package, Minus } from 'lucide-react';
import { useState } from 'react';

const iconMap = {
  Plus,
  Star,
  Zap,
  Mail,
  Package,
};

interface UpsellCardProps {
  upsell: {
    id: string;
    name: string;
    description: string;
    price: number;
    stripe_price_id: string;
    is_recurring: boolean;
    icon_name: string;
    badge?: string | null;
  };
  onPurchase: (upsellId: string, quantity: number) => void;
  compact?: boolean;
  loading?: boolean;
  maxQuantity?: number;
  disabled?: boolean;
  disabledReason?: string;
}

export const UpsellCard = ({ 
  upsell, 
  onPurchase, 
  compact = false, 
  loading = false,
  maxQuantity = 10,
  disabled = false,
  disabledReason
}: UpsellCardProps) => {
  const Icon = iconMap[upsell.icon_name as keyof typeof iconMap] || Plus;
  
  // Mostrar selector de cantidad para TODOS los upsells
  const showQuantitySelector = true;
  
  const [quantity, setQuantity] = useState(1);

  const handleIncrement = () => {
    if (quantity < maxQuantity) {
      setQuantity(q => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const totalPrice = upsell.price * quantity;
  
  return (
    <Card className={`relative overflow-hidden transition-shadow ${compact ? '' : 'h-full'} ${disabled ? 'opacity-60' : 'hover:shadow-lg'}`}>
      {upsell.badge && (
        <Badge className="absolute top-4 right-4 z-10" variant="secondary">
          {upsell.badge}
        </Badge>
      )}
      
      <CardHeader className={compact ? 'pb-3' : ''}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className={compact ? 'text-base' : 'text-lg'}>{upsell.name}</CardTitle>
            <CardDescription className={compact ? 'text-xs mt-1' : 'mt-2'}>
              {upsell.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={compact ? 'pt-0' : ''}>
        <div className="space-y-4">
          {/* Selector de cantidad */}
          {showQuantitySelector && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cantidad:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleDecrement}
                  disabled={quantity <= 1 || loading}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleIncrement}
                  disabled={quantity >= maxQuantity || loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  ${totalPrice.toLocaleString('es-MX')}
                </span>
                <span className="text-sm text-muted-foreground">MXN</span>
              </div>
              {quantity > 1 && (
                <span className="text-xs text-muted-foreground">
                  ${upsell.price.toLocaleString('es-MX')} c/u
                </span>
              )}
              <Badge variant="outline" className="mt-1 block w-fit">
                {upsell.is_recurring ? 'Recurrente' : 'Pago único'}
              </Badge>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <Button 
                onClick={() => onPurchase(upsell.id, quantity)}
                disabled={loading || disabled}
                size={compact ? 'sm' : 'default'}
                title={disabled ? disabledReason : undefined}
              >
                {loading ? 'Procesando...' : 'Comprar'}
              </Button>
              {disabled && disabledReason && (
                <span className="text-xs text-muted-foreground max-w-[120px] text-right">
                  {disabledReason}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
