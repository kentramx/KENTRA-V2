import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import { z } from 'zod';

const propertySchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(200),
  description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres').max(2000),
  price: z.number().positive('El precio debe ser mayor a 0'),
  type: z.enum(['casa', 'departamento', 'terreno', 'oficina', 'local_comercial']),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres').max(300),
  municipality: z.string().min(2, 'El municipio es requerido').max(100),
  state: z.string().min(2, 'El estado es requerido').max(100),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  parking: z.number().optional(),
  sqft: z.number().optional(),
  lot_size: z.number().optional(),
});

interface PropertyFormProps {
  property?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const PropertyForm = ({ property, onSuccess, onCancel }: PropertyFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    type: 'casa',
    address: '',
    municipality: '',
    state: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    sqft: '',
    lot_size: '',
  });

  useEffect(() => {
    if (property) {
      setFormData({
        title: property.title || '',
        description: property.description || '',
        price: property.price?.toString() || '',
        type: property.type || 'casa',
        address: property.address || '',
        municipality: property.municipality || '',
        state: property.state || '',
        bedrooms: property.bedrooms?.toString() || '',
        bathrooms: property.bathrooms?.toString() || '',
        parking: property.parking?.toString() || '',
        sqft: property.sqft?.toString() || '',
        lot_size: property.lot_size?.toString() || '',
      });
      setExistingImages(property.images || []);
    }
  }, [property]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imageId: string, url: string) => {
    try {
      // Delete from storage
      const fileName = url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('property-images').remove([fileName]);
      }

      // Delete from database
      await supabase.from('images').delete().eq('id', imageId);

      setExistingImages(prev => prev.filter(img => img.id !== imageId));
      
      toast({
        title: 'Imagen eliminada',
        description: 'La imagen ha sido eliminada correctamente',
      });
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la imagen',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validatedData = propertySchema.parse({
        ...formData,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        parking: formData.parking ? parseInt(formData.parking) : undefined,
        sqft: formData.sqft ? parseFloat(formData.sqft) : undefined,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : undefined,
      });

      let propertyId = property?.id;

      // Create or update property
      if (property) {
        const { error } = await supabase
          .from('properties')
          .update(validatedData as any)
          .eq('id', property.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert([{ ...validatedData, agent_id: user?.id } as any])
          .select()
          .single();

        if (error) throw error;
        propertyId = data.id;
      }

      // Upload new images
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${propertyId}/${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('property-images')
            .getPublicUrl(fileName);

          const { error: imageError } = await supabase
            .from('images')
            .insert({
              property_id: propertyId,
              url: publicUrl,
              position: existingImages.length + i,
            });

          if (imageError) throw imageError;
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving property:', error);
      
      if (error instanceof z.ZodError) {
        toast({
          title: 'Error de validación',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo guardar la propiedad',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Dynamic fields based on property type
  const showResidentialFields = ['casa', 'departamento'].includes(formData.type);
  const showLandFields = formData.type === 'terreno';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título*</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ej: Casa moderna en zona residencial"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Propiedad*</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="departamento">Departamento</SelectItem>
              <SelectItem value="terreno">Terreno</SelectItem>
              <SelectItem value="oficina">Oficina</SelectItem>
              <SelectItem value="local_comercial">Local Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Precio (MXN)*</Label>
          <Input
            id="price"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">Estado*</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="Ej: Jalisco"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="municipality">Municipio*</Label>
          <Input
            id="municipality"
            value={formData.municipality}
            onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
            placeholder="Ej: Guadalajara"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Dirección*</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Calle, número, colonia"
            required
          />
        </div>

        {showResidentialFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Recámaras</Label>
              <Input
                id="bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Baños</Label>
              <Input
                id="bathrooms"
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parking">Estacionamientos</Label>
              <Input
                id="parking"
                type="number"
                value={formData.parking}
                onChange={(e) => setFormData({ ...formData, parking: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sqft">Metros cuadrados</Label>
              <Input
                id="sqft"
                type="number"
                value={formData.sqft}
                onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                placeholder="0"
              />
            </div>
          </>
        )}

        {showLandFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="lot_size">Tamaño del terreno (m²)</Label>
              <Input
                id="lot_size"
                type="number"
                value={formData.lot_size}
                onChange={(e) => setFormData({ ...formData, lot_size: e.target.value })}
                placeholder="0"
              />
            </div>
          </>
        )}

        {(formData.type === 'oficina' || formData.type === 'local_comercial') && (
          <div className="space-y-2">
            <Label htmlFor="sqft">Superficie (m²)</Label>
            <Input
              id="sqft"
              type="number"
              value={formData.sqft}
              onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
              placeholder="0"
            />
          </div>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descripción*</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe la propiedad, sus características, ubicación, etc."
            rows={5}
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Imágenes</Label>
          
          {existingImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {existingImages.map((img) => (
                <div key={img.id} className="relative aspect-square">
                  <img
                    src={img.url}
                    alt="Property"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => removeExistingImage(img.id, img.url)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {imageFiles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {imageFiles.map((file, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
              id="image-upload"
            />
            <Label htmlFor="image-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Haz clic para subir imágenes o arrástralas aquí
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPG, WEBP hasta 10MB
              </p>
            </Label>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : property ? (
            'Actualizar Propiedad'
          ) : (
            'Crear Propiedad'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default PropertyForm;
