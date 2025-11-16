import { useEffect, useRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollContainerProps {
  children: ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
  className?: string;
}

export const InfiniteScrollContainer = ({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 0.8,
  className = '',
}: InfiniteScrollContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div ref={containerRef} className={className}>
      {children}
      
      {/* Sentinel element para detectar scroll */}
      {hasMore && (
        <div 
          ref={sentinelRef} 
          className="flex justify-center py-8"
        >
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando más propiedades...</span>
            </div>
          )}
        </div>
      )}
      
      {!hasMore && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          No hay más propiedades para mostrar
        </div>
      )}
    </div>
  );
};
