import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import PropertyCard from "@/components/PropertyCard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Properties = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
    if (user) {
      fetchFavorites();
    }
  }, [searchParams, user]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('property_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setFavorites(new Set(data?.map(f => f.property_id) || []));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("properties")
        .select(`
          *,
          images (
            url
          )
        `)
        .eq("status", "activa")
        .order("created_at", { ascending: false });

      const tipo = searchParams.get("tipo");
      if (tipo) {
        query = query.eq("type", tipo as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convertir tipos antiguos para compatibilidad
      const propertiesData = data?.map(property => ({
        ...property,
        type: property.type === 'local_comercial' ? 'local' : property.type
      })) || [];

      setProperties(propertiesData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las propiedades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (propertyId: string) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para guardar favoritos',
        variant: 'destructive',
      });
      return;
    }

    const isFavorite = favorites.has(propertyId);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('property_id', propertyId)
          .eq('user_id', user.id);

        if (error) throw error;

        setFavorites(prev => {
          const newFavorites = new Set(prev);
          newFavorites.delete(propertyId);
          return newFavorites;
        });

        toast({
          title: 'Removido',
          description: 'Propiedad removida de favoritos',
        });
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            property_id: propertyId,
            user_id: user.id,
          });

        if (error) throw error;

        setFavorites(prev => new Set([...prev, propertyId]));

        toast({
          title: 'Agregado',
          description: 'Propiedad agregada a favoritos',
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Propiedades Disponibles</h1>
          <p className="mt-2 text-muted-foreground">
            {properties.length} propiedades encontradas
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : properties.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center">
            <p className="text-xl text-muted-foreground">
              No se encontraron propiedades
            </p>
            <p className="mt-2 text-muted-foreground">
              Intenta con otros filtros de búsqueda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
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
                imageUrl={property.images?.[0]?.url}
                isFavorite={favorites.has(property.id)}
                onToggleFavorite={() => handleToggleFavorite(property.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
