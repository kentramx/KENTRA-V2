import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Star, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Filters {
  estado: string;
  municipio: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: 'price_desc' | 'price_asc' | 'newest' | 'oldest' | 'bedrooms_desc' | 'sqft_desc';
}

interface SavedSearch {
  id: string;
  name: string;
  filters: Filters;
  created_at: string;
}

interface SavedSearchesProps {
  userId: string | undefined;
  currentFilters: Filters;
  onLoadSearch: (filters: Filters) => void;
}

export const SavedSearches = ({ userId, currentFilters, onLoadSearch }: SavedSearchesProps) => {
  const { toast } = useToast();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

  // Cargar búsquedas guardadas
  useEffect(() => {
    if (userId) {
      loadSavedSearches();
    }
  }, [userId]);

  const loadSavedSearches = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSearches((data || []).map(item => ({
        ...item,
        filters: item.filters as unknown as Filters
      })));
    } catch (error) {
      console.error('Error loading saved searches:', error);
    }
  };

  const handleSaveSearch = async () => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'Debes iniciar sesión para guardar búsquedas',
        variant: 'destructive',
      });
      return;
    }

    if (!searchName.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un nombre para la búsqueda',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: userId,
          name: searchName,
          filters: currentFilters as any,
        }]);

      if (error) throw error;

      toast({
        title: '¡Búsqueda guardada!',
        description: 'Puedes cargarla en cualquier momento',
      });

      setSearchName('');
      setIsSaveDialogOpen(false);
      loadSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la búsqueda',
        variant: 'destructive',
      });
    }
  };

  const handleLoadSearch = (search: SavedSearch) => {
    onLoadSearch(search.filters as Filters);
    setIsLoadDialogOpen(false);
    
    toast({
      title: 'Búsqueda cargada',
      description: `Se cargaron los filtros de "${search.name}"`,
    });
  };

  const handleDeleteSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId);

      if (error) throw error;

      toast({
        title: 'Búsqueda eliminada',
        description: 'La búsqueda ha sido eliminada correctamente',
      });

      loadSavedSearches();
    } catch (error) {
      console.error('Error deleting search:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la búsqueda',
        variant: 'destructive',
      });
    }
  };

  if (!userId) return null;

  return (
    <div className="flex gap-2">
      {/* Botón Guardar Búsqueda */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" />
            Guardar búsqueda
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar búsqueda</DialogTitle>
            <DialogDescription>
              Dale un nombre a esta búsqueda para poder cargarla más tarde
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Nombre de la búsqueda</Label>
              <Input
                id="search-name"
                placeholder="Ej: Casas en CDMX bajo 5M"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSearch}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón Cargar Búsqueda */}
      {savedSearches.length > 0 && (
        <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Star className="mr-2 h-4 w-4" />
              Mis búsquedas ({savedSearches.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Búsquedas guardadas</DialogTitle>
              <DialogDescription>
                Selecciona una búsqueda para cargar sus filtros
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-2">
                {savedSearches.map((search) => (
                  <Card key={search.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1" onClick={() => handleLoadSearch(search)}>
                          <h4 className="font-medium">{search.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(search.created_at).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSearch(search.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
