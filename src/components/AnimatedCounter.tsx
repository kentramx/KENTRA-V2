import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  label?: string;
}

export const AnimatedCounter = ({ value, duration = 800, label = "propiedades" }: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;

    if (difference === 0) return;

    const animateCount = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function para suavizar la animación
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + difference * easeOutQuart);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };

    requestAnimationFrame(animateCount);
  }, [value, duration]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg animate-scale-in">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
        <Home className="h-5 w-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary tabular-nums">
            {displayValue}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            {label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {displayValue === 0 ? 'No se encontraron resultados' : 'encontradas'}
        </span>
      </div>
    </div>
  );
};
