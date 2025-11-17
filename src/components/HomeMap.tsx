import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BasicGoogleMap from "@/components/BasicGoogleMap";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTiledMap, ViewportBounds } from "@/hooks/useTiledMap";
import { useAdaptiveDebounce } from "@/hooks/useAdaptiveDebounce";
import type { MapProperty } from "@/types/property";
import { useMonitoring } from "@/lib/monitoring";

const HomeMap = ({ height = "450px" }: { height?: string }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);

  // ✅ FASE 4: Debounce adaptativo según FPS del dispositivo
  const debouncedBounds = useAdaptiveDebounce(viewportBounds, 300);

  // 🚀 TILE-BASED ARCHITECTURE: fetch con escalabilidad infinita
  const { data: viewportData, isLoading: loading } = useTiledMap(
    debouncedBounds,
    { status: ['activa'] }
  );

  const { properties = [], clusters = [] } = viewportData || {};

  // Creación de markers desde propiedades individuales
  const mapMarkers = properties
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map(p => ({ 
      id: p.id, 
      lat: p.lat as number, 
      lng: p.lng as number,
      title: p.title,
      price: p.price,
      currency: 'MXN' as 'MXN' | 'USD',
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      images: p.images,
      listing_type: p.listing_type as "venta" | "renta",
      address: p.address,
    }));

  // Creación de clusters
  const mapClusters = clusters.map(c => ({
    lat: c.lat,
    lng: c.lng,
    count: c.property_count,
    avgPrice: c.avg_price,
    propertyIds: c.property_ids,
  }));

  // Centro del mapa y zoom - centrado en México
  const mapCenter = hoveredProperty && hoveredProperty.lat && hoveredProperty.lng
    ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng }
    : { lat: 23.6345, lng: -102.5528 };

  const mapZoom = hoveredProperty ? 14 : 5;

  // Actualizar viewport cuando cambia el mapa
  const handleBoundsChange = (bounds: ViewportBounds) => {
    setViewportBounds(bounds);
  };

  const handleMarkerClick = (id: string) => {
    navigate(`/propiedad/${id}`);
  };

  const handleFavoriteClick = async (propertyId: string) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para agregar favoritos',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Verificar si ya está en favoritos
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        // Eliminar de favoritos
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        toast({
          title: 'Eliminado de favoritos',
          description: 'La propiedad se eliminó de tus favoritos',
        });
      } else {
        // Agregar a favoritos
        const { error } = await supabase
          .from('favorites')
          .insert([{ user_id: user.id, property_id: propertyId }]);

        if (error) throw error;

        toast({
          title: '⭐ Agregado a favoritos',
          description: 'La propiedad se agregó a tus favoritos',
        });
      }
    } catch (error: any) {
      logError('Error managing favorite', {
        component: 'HomeMap',
        propertyId,
        error,
      });
      captureException(error, {
        component: 'HomeMap',
        action: 'handleFavoriteClick',
        propertyId,
      });
      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">Cargando mapa…</p>
      </div>
    );
  }

  if (mapMarkers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/20" style={{ height }}>
        <p className="text-muted-foreground">No hay propiedades para mostrar en el mapa</p>
      </div>
    );
  }

  return (
    <BasicGoogleMap
      center={mapCenter}
      zoom={mapZoom}
      markers={mapMarkers}
      height={height}
      className="h-full w-full"
      onMarkerClick={handleMarkerClick}
      onFavoriteClick={handleFavoriteClick}
      disableAutoFit={true}
      hoveredMarkerId={hoveredProperty?.id || null}
      onMarkerHover={(markerId) => {
        if (markerId) {
          const property = properties.find(p => p.id === markerId) as MapProperty | undefined;
          setHoveredProperty(property || null);
        } else {
          setHoveredProperty(null);
        }
      }}
    />
  );
};

export default HomeMap;
