import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  blurDataURL?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

// Generar URLs responsivas usando Supabase Transform
const generateResponsiveSrcSet = (src: string): string => {
  // Solo aplicar transformaciones a URLs de Supabase Storage
  if (!src.includes('supabase.co/storage/v1/object/public/')) {
    return '';
  }

  const sizes = [400, 800, 1200, 1920];
  
  return sizes
    .map(width => {
      // Agregar parámetro de transformación width a la URL
      const transformedUrl = `${src}?width=${width}&quality=80`;
      return `${transformedUrl} ${width}w`;
    })
    .join(', ');
};

// Generar sizes attribute optimizado para diferentes viewports
const getOptimizedSizes = (): string => {
  return '(max-width: 640px) 400px, (max-width: 1024px) 800px, (max-width: 1920px) 1200px, 1920px';
};

export const LazyImage = ({ 
  src, 
  alt, 
  className, 
  blurDataURL,
  width,
  height,
  priority = false,
  onLoad: onLoadCallback,
  onError: onErrorCallback
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer para detectar cuando entra en viewport
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: '100px', // Comienza a cargar 100px antes de entrar al viewport
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);
    
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoadCallback?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onErrorCallback?.();
  };

  return (
    <div 
      ref={imgRef} 
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ width, height }}
    >
      {/* Placeholder blur - solo se muestra mientras carga */}
      {!isLoaded && blurDataURL && !hasError && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 animate-pulse"
          aria-hidden="true"
        />
      )}
      
      {/* Imagen real - solo se carga cuando entra en viewport */}
      {isInView && (
        <img
          src={src}
          srcSet={generateResponsiveSrcSet(src)}
          sizes={getOptimizedSizes()}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          decoding="async"
        />
      )}
    </div>
  );
};
