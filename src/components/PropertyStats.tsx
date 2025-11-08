import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, ArrowUpDown } from 'lucide-react';

interface PropertyStatsProps {
  properties: Array<{ price: number }>;
  duration?: number;
}

export const PropertyStats = ({ properties, duration = 800 }: PropertyStatsProps) => {
  const [displayAvg, setDisplayAvg] = useState(0);
  const [displayMin, setDisplayMin] = useState(0);
  const [displayMax, setDisplayMax] = useState(0);

  const avgPrice = properties.length > 0
    ? properties.reduce((sum, p) => sum + p.price, 0) / properties.length
    : 0;

  const minPrice = properties.length > 0
    ? Math.min(...properties.map(p => p.price))
    : 0;

  const maxPrice = properties.length > 0
    ? Math.max(...properties.map(p => p.price))
    : 0;

  const animateValue = (
    start: number,
    end: number,
    setValue: (value: number) => void
  ) => {
    const startTime = Date.now();
    const difference = end - start;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = start + difference * easeOutQuart;

      setValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  useEffect(() => {
    animateValue(displayAvg, avgPrice, setDisplayAvg);
  }, [avgPrice]);

  useEffect(() => {
    animateValue(displayMin, minPrice, setDisplayMin);
  }, [minPrice]);

  useEffect(() => {
    animateValue(displayMax, maxPrice, setDisplayMax);
  }, [maxPrice]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (properties.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
      {/* Precio promedio */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:shadow-md transition-shadow">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Precio promedio
          </span>
          <span className="text-base font-bold text-primary tabular-nums">
            {formatCurrency(displayAvg)}
          </span>
        </div>
      </div>

      {/* Precio mínimo */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg hover:shadow-md transition-shadow">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 shrink-0">
          <DollarSign className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Desde
          </span>
          <span className="text-base font-bold text-emerald-600 tabular-nums">
            {formatCurrency(displayMin)}
          </span>
        </div>
      </div>

      {/* Precio máximo */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg hover:shadow-md transition-shadow">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 shrink-0">
          <ArrowUpDown className="h-4 w-4 text-orange-600" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Hasta
          </span>
          <span className="text-base font-bold text-orange-600 tabular-nums">
            {formatCurrency(displayMax)}
          </span>
        </div>
      </div>
    </div>
  );
};
