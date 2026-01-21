import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingDown, TrendingUp, Calendar } from "lucide-react";
import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";

interface PriceHistoryItem {
  price: number;
  date: string;
  change_type: 'reduction' | 'increase' | 'initial';
}

interface PropertyTimelineProps {
  createdAt: string;
  updatedAt: string;
  priceHistory?: PriceHistoryItem[];
  currentPrice: number;
}

export const PropertyTimeline = ({
  createdAt,
  updatedAt,
  priceHistory = [],
  currentPrice,
}: PropertyTimelineProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const daysOnMarket = Math.floor(
    (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Combine all events
  const events: Array<{
    type: string;
    date: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    price?: number;
  }> = [
    {
      type: 'published',
      date: createdAt,
      title: 'Propiedad publicada',
      icon: Calendar,
    },
    ...priceHistory.map((item) => ({
      type: item.change_type,
      date: item.date,
      title:
        item.change_type === 'reduction'
          ? 'Reducción de precio'
          : item.change_type === 'increase'
          ? 'Aumento de precio'
          : 'Precio inicial',
      price: item.price,
      icon: item.change_type === 'reduction' ? TrendingDown : TrendingUp,
    })),
    ...(updatedAt !== createdAt
      ? [
          {
            type: 'updated',
            date: updatedAt,
            title: 'Última actualización',
            icon: Clock,
          },
        ]
      : []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Historial de la Propiedad
          </CardTitle>
          <Badge variant="secondary">
            {daysOnMarket} {daysOnMarket === 1 ? 'día' : 'días'} en el mercado
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {events.map((event, index) => {
            const Icon = event.icon;
            const isLast = index === events.length - 1;

            return (
              <div key={index} className="relative flex gap-4 pb-4">
                {/* Icon */}
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                  event.type === 'reduction' ? 'bg-green-500/10' :
                  event.type === 'increase' ? 'bg-red-500/10' :
                  'bg-primary/10'
                }`}>
                  <Icon className={`h-4 w-4 ${
                    event.type === 'reduction' ? 'text-green-600' :
                    event.type === 'increase' ? 'text-red-600' :
                    'text-primary'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold">{event.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDistance(new Date(event.date), new Date(), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    {event.price && (
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(event.price)}</p>
                        {event.type === 'reduction' && index < events.length - 1 && (
                          <p className="text-sm text-green-600">
                            ↓ {formatPrice(Math.abs(event.price - currentPrice))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
