import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Zap, Mail, Package } from 'lucide-react';

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
  onPurchase: (upsellId: string) => void;
  compact?: boolean;
  loading?: boolean;
}

export const UpsellCard = ({ upsell, onPurchase, compact = false, loading = false }: UpsellCardProps) => {
  const Icon = iconMap[upsell.icon_name as keyof typeof iconMap] || Plus;
  
  return (
    <Card className={`relative overflow-hidden hover:shadow-lg transition-shadow ${compact ? '' : 'h-full'}`}>
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
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                ${upsell.price.toLocaleString('es-MX')}
              </span>
              <span className="text-sm text-muted-foreground">MXN</span>
            </div>
            <Badge variant="outline" className="mt-1">
              {upsell.is_recurring ? 'Recurrente' : 'Pago único'}
            </Badge>
          </div>
          
          <Button 
            onClick={() => onPurchase(upsell.id)}
            disabled={loading}
            size={compact ? 'sm' : 'default'}
          >
            Comprar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
