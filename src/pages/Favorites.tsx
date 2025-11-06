import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import PropertyCard from '@/components/PropertyCard';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  price: number;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
}

interface FavoriteWithProperty {
  id: string;
  property_id: string;
  properties: Property;
}

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteWithProperty[]>([]);
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
            type,
            listing_type,
            address,
            municipality,
            state,
            bedrooms,
            bathrooms,
            parking,
            sqft
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFavorites(data || []);
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

  const handleRemoveFavorite = async (propertyId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('property_id', propertyId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setFavorites(favorites.filter(fav => fav.property_id !== propertyId));
      
      toast({
        title: 'Eliminado',
        description: 'Propiedad removida de favoritos',
      });
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo remover de favoritos',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Mis Favoritos
          </h1>
          <p className="text-muted-foreground">
            Propiedades que has guardado para ver más tarde
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 text-6xl">💔</div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No tienes favoritos guardados
            </h2>
            <p className="text-muted-foreground mb-6">
              Explora propiedades y guarda las que más te gusten
            </p>
            <button
              onClick={() => navigate('/propiedades')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6"
            >
              Ver Propiedades
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const property = favorite.properties as Property;
              return (
                <PropertyCard
                  key={favorite.id}
                  id={property.id}
                  title={property.title}
                  price={property.price}
                  type={property.type}
                  listingType={property.listing_type}
                  address={property.address}
                  municipality={property.municipality}
                  state={property.state}
                  bedrooms={property.bedrooms}
                  bathrooms={property.bathrooms}
                  parking={property.parking}
                  sqft={property.sqft}
                  isFavorite={true}
                  onToggleFavorite={() => handleRemoveFavorite(property.id)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Favorites;
