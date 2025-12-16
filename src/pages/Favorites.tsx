import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { VirtualizedPropertyGrid } from '@/components/VirtualizedPropertyGrid';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart } from 'lucide-react';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { useFavorites } from '@/hooks/useFavorites';
import type { PropertySummary } from '@/types/property';

// Tipo para los datos que vienen de la DB con relación de properties
interface DBProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  type: string;
  listing_type: string;
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  address: string;
  colonia: string | null;
  municipality: string;
  state: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sqft: number | null;
  agent_id: string;
  created_at: string;
  images: Array<{ url: string; position: number }>;
}

interface FavoriteWithProperty {
  id: string;
  property_id: string;
  properties: DBProperty;
}

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { favorites, toggleFavorite } = useFavorites();
  const [favoritesData, setFavoritesData] = useState<FavoriteWithProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          property_id,
          properties (
            id,
            title,
            price,
            currency,
            type,
            listing_type,
            for_sale,
            for_rent,
            sale_price,
            rent_price,
            address,
            colonia,
            municipality,
            state,
            bedrooms,
            bathrooms,
            parking,
            sqft,
            agent_id,
            created_at,
            images (url, position)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFavoritesData(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los favoritos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Manejar toggle de favorito y actualizar lista local
  const handleToggleFavorite = async (propertyId: string, title: string) => {
    await toggleFavorite(propertyId, title);
    // Remover de la lista local después de toggle (solo si estaba en favoritos)
    setFavoritesData(prev => prev.filter(fav => fav.property_id !== propertyId));
  };

  // Convertir datos a PropertySummary
  const properties = useMemo(() => {
    return favoritesData
      .filter(fav => fav.properties) // Filtrar favoritos sin propiedad (propiedad eliminada)
      .map(fav => ({
        id: fav.properties.id,
        title: fav.properties.title,
        price: fav.properties.price,
        currency: fav.properties.currency,
        type: fav.properties.type as any,
        listing_type: fav.properties.listing_type,
        for_sale: fav.properties.for_sale,
        for_rent: fav.properties.for_rent,
        sale_price: fav.properties.sale_price,
        rent_price: fav.properties.rent_price,
        address: fav.properties.address,
        colonia: fav.properties.colonia,
        municipality: fav.properties.municipality,
        state: fav.properties.state,
        bedrooms: fav.properties.bedrooms,
        bathrooms: fav.properties.bathrooms,
        parking: fav.properties.parking,
        sqft: fav.properties.sqft,
        images: fav.properties.images.sort((a, b) => a.position - b.position),
        agent_id: fav.properties.agent_id,
        is_featured: false,
        created_at: fav.properties.created_at,
      } as PropertySummary));
  }, [favoritesData]);

  // Set de IDs favoritos (todos en esta página son favoritos)
  const favoriteIds = useMemo(() => {
    return new Set(properties.map(p => p.id));
  }, [properties]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Favoritos', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Mis Favoritos
          </h1>
          <p className="text-muted-foreground">
            {properties.length > 0 
              ? `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} guardada${properties.length !== 1 ? 's' : ''}`
              : 'Propiedades que has guardado para ver más tarde'
            }
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No tienes favoritos guardados
            </h2>
            <p className="text-muted-foreground mb-6">
              Explora propiedades y guarda las que más te gusten
            </p>
            <button
              onClick={() => navigate('/buscar')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
            >
              Ver Propiedades
            </button>
          </div>
        ) : (
          <VirtualizedPropertyGrid 
            properties={properties}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>
    </div>
  );
};

export default Favorites;
