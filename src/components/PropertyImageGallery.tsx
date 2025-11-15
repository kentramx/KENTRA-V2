import { useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import propertyPlaceholder from '@/assets/property-placeholder.jpg';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from './ImageLightbox';
import { Button } from '@/components/ui/button';
import { useTracking } from '@/hooks/useTracking';

interface PropertyImageGalleryProps {
  images: { url: string }[];
  title: string;
  type: string;
  propertyId?: string;
  price?: number;
}

export const PropertyImageGallery = ({ images, title, type, propertyId, price }: PropertyImageGalleryProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const displayImages = images.length > 0 ? images : [{ url: propertyPlaceholder }];
  const { trackGA4Event } = useTracking();

  const getImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/src/assets/')) return propertyPlaceholder;
    return url;
  };

  const openLightbox = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLightboxOpen(true);
    
    // Track visualización de galería en GA4
    if (propertyId) {
      trackGA4Event('view_item_list', {
        item_list_name: 'property_gallery',
        item_id: propertyId,
        item_name: title,
        item_category: type,
        value: price,
        currency: 'MXN',
      });
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const goToImage = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  return (
    <>
      <div className="relative aspect-video overflow-hidden rounded-lg group cursor-pointer">
        {/* Imagen actual */}
        <div onClick={openLightbox} className="h-full w-full">
          <img
            src={getImageUrl(displayImages[currentImageIndex].url)}
            alt={`${title} - Imagen ${currentImageIndex + 1}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        {/* Badge de tipo de propiedad */}
        <Badge className="absolute left-3 top-3 bg-primary/90 text-primary-foreground backdrop-blur-sm z-10">
          {type}
        </Badge>

        {/* Botón de expandir */}
        <Button
          size="icon"
          variant="ghost"
          onClick={openLightbox}
          className="absolute right-3 top-3 bg-background/80 backdrop-blur-sm hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Expand className="h-5 w-5" />
        </Button>

        {/* Contador de imágenes */}
        {displayImages.length > 1 && (
          <div className="absolute right-14 top-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium z-10">
            {currentImageIndex + 1} / {displayImages.length}
          </div>
        )}

        {/* Controles de navegación - solo si hay más de una imagen */}
        {displayImages.length > 1 && (
          <>
            {/* Botones de navegación */}
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              aria-label="Siguiente imagen"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Indicadores de puntos (thumbnails) */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {displayImages.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  onClick={goToImage(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentImageIndex
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-background/60 hover:bg-background/80'
                  }`}
                  aria-label={`Ir a imagen ${index + 1}`}
                />
              ))}
              {displayImages.length > 5 && (
                <span className="text-xs text-background/80 ml-1">+{displayImages.length - 5}</span>
              )}
            </div>
          </>
        )}

        {/* Overlay gradient en hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={displayImages}
        initialIndex={currentImageIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        title={title}
      />
    </>
  );
};
