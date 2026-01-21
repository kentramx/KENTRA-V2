import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, ArrowUpDown } from 'lucide-react';

interface PropertyStatsProps {
  properties: Array<{ price: number; listing_type?: string }>;
  listingType?: string;
  duration?: number;
}

export const PropertyStats = ({ properties, listingType, duration = 800 }: PropertyStatsProps) => {
  const [displayAvgVenta, setDisplayAvgVenta] = useState(0);
  const [displayAvgRenta, setDisplayAvgRenta] = useState(0);
  const [displayAvg, setDisplayAvg] = useState(0);
  const [displayMin, setDisplayMin] = useState(0);
  const [displayMax, setDisplayMax] = useState(0);

  // Cuando no hay filtro de tipo, calcular promedios separados
  const ventaProperties = properties.filter(p => p.listing_type === 'venta');
  const rentaProperties = properties.filter(p => p.listing_type === 'renta');

  const avgVentaPrice = ventaProperties.length > 0
    ? ventaProperties.reduce((sum, p) => sum + p.price, 0) / ventaProperties.length
    : 0;

  const avgRentaPrice = rentaProperties.length > 0
    ? rentaProperties.reduce((sum, p) => sum + p.price, 0) / rentaProperties.length
    : 0;

  // Cuando hay filtro, calcular stats del tipo filtrado
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
    if (!listingType) {
      animateValue(displayAvgVenta, avgVentaPrice, setDisplayAvgVenta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animateValue and displayAvgVenta are intentionally excluded
  }, [avgVentaPrice, listingType]);

  useEffect(() => {
    if (!listingType) {
      animateValue(displayAvgRenta, avgRentaPrice, setDisplayAvgRenta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animateValue and displayAvgRenta are intentionally excluded
  }, [avgRentaPrice, listingType]);

  useEffect(() => {
    if (listingType) {
      animateValue(displayAvg, avgPrice, setDisplayAvg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animateValue and displayAvg are intentionally excluded
  }, [avgPrice, listingType]);

  useEffect(() => {
    animateValue(displayMin, minPrice, setDisplayMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animateValue and displayMin are intentionally excluded
  }, [minPrice]);

  useEffect(() => {
    animateValue(displayMax, maxPrice, setDisplayMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animateValue and displayMax are intentionally excluded
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

  // Sin filtro: mostrar 4 tarjetas (venta, renta, min, max)
  if (!listingType) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
        {/* Promedio Venta */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:shadow-lg hover:shadow-primary/20 hover:scale-105 hover:from-primary/15 hover:to-primary/10 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0 group-hover:bg-primary/30 transition-colors">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium">
              Promedio venta
            </span>
            <span className="text-sm font-bold text-primary tabular-nums">
              {ventaProperties.length > 0 ? formatCurrency(displayAvgVenta) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Promedio Renta */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 rounded-lg hover:shadow-lg hover:shadow-violet-500/20 hover:scale-105 hover:from-violet-500/15 hover:to-violet-500/10 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 shrink-0 group-hover:bg-violet-500/30 transition-colors">
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium">
              Promedio renta
            </span>
            <span className="text-sm font-bold text-violet-600 tabular-nums">
              {rentaProperties.length > 0 ? formatCurrency(displayAvgRenta) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Precio mínimo */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 hover:from-emerald-500/15 hover:to-emerald-500/10 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 shrink-0 group-hover:bg-emerald-500/30 transition-colors">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium">
              Desde
            </span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">
              {formatCurrency(displayMin)}
            </span>
          </div>
        </div>

        {/* Precio máximo */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105 hover:from-orange-500/15 hover:to-orange-500/10 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 shrink-0 group-hover:bg-orange-500/30 transition-colors">
            <ArrowUpDown className="h-4 w-4 text-orange-600" />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium">
              Hasta
            </span>
            <span className="text-sm font-bold text-orange-600 tabular-nums">
              {formatCurrency(displayMax)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Con filtro: mostrar 3 tarjetas (promedio, min, max)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
      {/* Precio promedio */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:shadow-lg hover:shadow-primary/20 hover:scale-105 hover:from-primary/15 hover:to-primary/10 transition-all duration-300 cursor-pointer">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0 group-hover:bg-primary/30 transition-colors">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Precio promedio
          </span>
          <span className="text-sm font-bold text-primary tabular-nums">
            {formatCurrency(displayAvg)}
          </span>
        </div>
      </div>

      {/* Precio mínimo */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105 hover:from-emerald-500/15 hover:to-emerald-500/10 transition-all duration-300 cursor-pointer">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 shrink-0 group-hover:bg-emerald-500/30 transition-colors">
          <DollarSign className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Desde
          </span>
          <span className="text-sm font-bold text-emerald-600 tabular-nums">
            {formatCurrency(displayMin)}
          </span>
        </div>
      </div>

      {/* Precio máximo */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105 hover:from-orange-500/15 hover:to-orange-500/10 transition-all duration-300 cursor-pointer">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 shrink-0 group-hover:bg-orange-500/30 transition-colors">
          <ArrowUpDown className="h-4 w-4 text-orange-600" />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-xs text-muted-foreground font-medium">
            Hasta
          </span>
          <span className="text-sm font-bold text-orange-600 tabular-nums">
            {formatCurrency(displayMax)}
          </span>
        </div>
      </div>
    </div>
  );
};
