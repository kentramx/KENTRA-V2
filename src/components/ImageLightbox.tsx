import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxProps {
  images: { url: string }[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const ImageLightbox = ({ images, initialIndex, isOpen, onClose, title }: ImageLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Resetear zoom y swipe cuando cambia la imagen
  useEffect(() => {
    setZoom(1);
    setSwipeOffset(0);
  }, [currentIndex]);

  // Sincronizar el índice cuando cambia desde fuera
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Navegación con teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  // Manejo de gestos táctiles
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    
    // Calcular offset para feedback visual
    const distance = currentTouch - touchStart;
    // Limitar el offset para evitar swipe excesivo
    const maxOffset = 100;
    const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, distance / 3));
    setSwipeOffset(limitedOffset);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setSwipeOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && images.length > 1) {
      handleNext();
    } else if (isRightSwipe && images.length > 1) {
      handlePrevious();
    }

    // Resetear valores
    setTouchStart(null);
    setTouchEnd(null);
    setSwipeOffset(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-0">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Botón cerrar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-50 bg-background/10 hover:bg-background/20 text-white rounded-full backdrop-blur-sm"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Título e información */}
          <div className="absolute top-4 left-4 z-50 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-sm font-medium text-foreground">
              {title && <span className="mr-2">{title}</span>}
              <span className="text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            </p>
          </div>

          {/* Controles de zoom */}
          <div className="absolute bottom-4 right-4 z-50 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="bg-background/10 hover:bg-background/20 text-white rounded-full backdrop-blur-sm"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <div className="bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg text-sm font-medium">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="bg-background/10 hover:bg-background/20 text-white rounded-full backdrop-blur-sm"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>

          {/* Imagen principal con soporte de swipe */}
          <div 
            className="w-full h-full flex items-center justify-center overflow-hidden p-16"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={images[currentIndex].url}
              alt={`${title || 'Imagen'} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain animate-fade-in select-none"
              style={{ 
                transform: `scale(${zoom}) translateX(${swipeOffset}px)`,
                transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
              }}
            />
          </div>

          {/* Navegación */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/10 hover:bg-background/20 text-white rounded-full backdrop-blur-sm h-12 w-12"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/10 hover:bg-background/20 text-white rounded-full backdrop-blur-sm h-12 w-12"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Thumbnails en la parte inferior */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto pb-2 px-4">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                    index === currentIndex
                      ? 'ring-2 ring-primary scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
