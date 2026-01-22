import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { VirtualizedPropertyGrid } from '@/components/VirtualizedPropertyGrid';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart } from 'lucide-react';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { useFavorites } from '@/hooks/useFavorites';
import { Button } from '@/components/ui/button';
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

// Response type from RPC
interface FavoriteRPCResult {
  favorite_id: string;
  created_at: string;
  property_id: string;
  property: {
    id: string;
    title: string;
    address: string;
    municipality: string;
    state: string;
    price: number;
    currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    listing_type: string;
    type: string;
    status: string;
    image_url: string | null;
  };
}

const PAGE_SIZE = 20;

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { favorites, toggleFavorite } = useFavorites();
  const [favoritesData, setFavoritesData] = useState<FavoriteWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFavorites(0, true);
    }
  }, [user]);

  const fetchFavorites = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (!user) return;

    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // SCALABILITY: Try RPC first for paginated favorites
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_favorites', {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: pageNum * PAGE_SIZE,
      });

      if (!rpcError && rpcData) {
        // RPC available - use paginated data
        const rpcResults = rpcData as FavoriteRPCResult[];

        // Convert RPC results to expected format
        const newFavorites: FavoriteWithProperty[] = rpcResults.map((fav) => ({
          id: fav.favorite_id,
          property_id: fav.property_id,
          properties: {
            id: fav.property.id,
            title: fav.property.title,
            price: fav.property.price,
            currency: fav.property.currency,
            type: fav.property.type,
            listing_type: fav.property.listing_type,
            for_sale: fav.property.listing_type === 'sale',
            for_rent: fav.property.listing_type === 'rent',
            sale_price: fav.property.listing_type === 'sale' ? fav.property.price : null,
            rent_price: fav.property.listing_type === 'rent' ? fav.property.price : null,
            address: fav.property.address,
            colonia: null,
            municipality: fav.property.municipality,
            state: fav.property.state,
            bedrooms: fav.property.bedrooms,
            bathrooms: fav.property.bathrooms,
            parking: null,
            sqft: fav.property.sqft,
            agent_id: '',
            created_at: fav.created_at,
            images: fav.property.image_url ? [{ url: fav.property.image_url, position: 0 }] : [],
          },
        }));

        if (reset) {
          setFavoritesData(newFavorites);
        } else {
          setFavoritesData(prev => [...prev, ...newFavorites]);
        }

        setHasMore(rpcResults.length === PAGE_SIZE);
        setPage(pageNum);

        // Get total count
        if (reset) {
          const { count } = await supabase
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
          setTotalCount(count || 0);
        }

        return;
      }

      // Fallback to legacy query with pagination
      console.warn('Falling back to legacy favorites query:', rpcError?.message);

      const { data, error, count } = await supabase
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (reset) {
        setFavoritesData(data || []);
        setTotalCount(count || 0);
      } else {
        setFavoritesData(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(pageNum);

    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los favoritos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, toast]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchFavorites(page + 1, false);
    }
  }, [loadingMore, hasMore, page, fetchFavorites]);

  // Manejar toggle de favorito y actualizar lista local
  const handleToggleFavorite = async (propertyId: string, title: string) => {
    await toggleFavorite(propertyId, title);
    // Remover de la lista local después de toggle (solo si estaba en favoritos)
    setFavoritesData(prev => prev.filter(fav => fav.property_id !== propertyId));
    setTotalCount(prev => Math.max(0, prev - 1));
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
        type: fav.properties.type,
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
        images: fav.properties.images?.sort((a, b) => a.position - b.position) || [],
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
            {totalCount > 0
              ? `${totalCount} propiedad${totalCount !== 1 ? 'es' : ''} guardada${totalCount !== 1 ? 's' : ''}`
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
          <>
            <VirtualizedPropertyGrid
              properties={properties}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  size="lg"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    `Cargar más (${properties.length} de ${totalCount})`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Favorites;
