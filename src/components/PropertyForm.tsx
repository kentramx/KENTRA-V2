import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Plus, Trash2, Video, AlertTriangle, FileText } from 'lucide-react';
import { z } from 'zod';
import { LocationSearch } from '@/components/LocationSearch';
import { usePropertyTitleValidation } from '@/hooks/usePropertyTitleValidation';
import { compressImages, validateImageFile } from '@/utils/imageCompression';

const propertySchema = z.object({
  description: z.string().trim().min(20, 'La descripción debe tener al menos 20 caracteres').max(2000, 'La descripción no puede exceder 2000 caracteres'),
  price: z.number().positive('El precio debe ser mayor a 0'),
  type: z.enum(['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'edificio', 'rancho']),
  listing_type: z.enum(['venta', 'renta']),
  address: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres').max(300, 'La dirección no puede exceder 300 caracteres'),
  colonia: z.string().trim().max(100, 'La colonia no puede exceder 100 caracteres').optional(),
  municipality: z.string().trim().min(2, 'El municipio es requerido').max(100, 'El municipio no puede exceder 100 caracteres'),
  state: z.string().trim().min(2, 'El estado es requerido').max(100, 'El estado no puede exceder 100 caracteres'),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  parking: z.number().optional(),
  sqft: z.number().optional(),
  lot_size: z.number().optional(),
  video_url: z.string().trim().url('Debe ser una URL válida').optional().or(z.literal('')),
  amenities: z.array(z.object({
    category: z.string().trim().min(1).max(50),
    items: z.array(z.string().trim().min(1).max(100))
  })).optional(),
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
    description: '',
    price: '',
    type: 'casa',
    listing_type: 'venta',
    address: '',
    colonia: '',
    municipality: '',
    state: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    sqft: '',
    lot_size: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    video_url: '',
  });

  const [amenities, setAmenities] = useState<Array<{ category: string; items: string[] }>>([]);
  const [newAmenityCategory, setNewAmenityCategory] = useState('');
  const [newAmenityItem, setNewAmenityItem] = useState<{ [key: string]: string }>({});

  // Calcular título automático para validación en tiempo real
  const propertyTypeLabel = {
    casa: 'Casa',
    departamento: 'Departamento',
    terreno: 'Terreno',
    oficina: 'Oficina',
    local: 'Local Comercial',
    bodega: 'Bodega',
    edificio: 'Edificio',
    rancho: 'Rancho'
  }[formData.type] || 'Propiedad';

  const locationText = formData.colonia || formData.municipality;
  const autoTitle = formData.type && locationText ? `${propertyTypeLabel} en ${locationText}` : '';

  // Validar duplicados en tiempo real
  const titleValidation = usePropertyTitleValidation(
    autoTitle,
    formData.municipality,
    formData.state,
    property?.id
  );

  const PREDEFINED_CATEGORIES = [
    'Interior',
    'Exterior', 
    'Servicios',
    'Seguridad',
    'Recreación'
  ];

  const COMMON_AMENITIES: { [key: string]: string[] } = {
    Interior: ['Cocina equipada', 'Closets', 'Aire acondicionado', 'Calefacción', 'Chimenea', 'Pisos de madera'],
    Exterior: ['Jardín', 'Terraza', 'Balcón', 'Patio', 'Área de asador', 'Vista panorámica'],
    Servicios: ['Internet/WiFi', 'TV por cable', 'Gas natural', 'Agua caliente', 'Cisterna', 'Tinaco'],
    Seguridad: ['Seguridad 24/7', 'Cámaras de seguridad', 'Portón eléctrico', 'Cerca eléctrica', 'Caseta de vigilancia'],
    Recreación: ['Alberca', 'Gimnasio', 'Área de juegos', 'Cancha deportiva', 'Salón de eventos', 'Jardín común']
  };

  useEffect(() => {
    if (property) {
      setFormData({
        description: property.description || '',
        price: property.price?.toString() || '',
        type: property.type || 'casa',
        listing_type: property.listing_type || 'venta',
        address: property.address || '',
        colonia: property.colonia || '',
        municipality: property.municipality || '',
        state: property.state || '',
        bedrooms: property.bedrooms?.toString() || '',
        bathrooms: property.bathrooms?.toString() || '',
        parking: property.parking?.toString() || '',
        sqft: property.sqft?.toString() || '',
        lot_size: property.lot_size?.toString() || '',
        lat: property.lat,
        lng: property.lng,
        video_url: property.video_url || '',
      });
      setExistingImages(property.images || []);
      setAmenities(property.amenities || []);
    }
  }, [property]);

  const addAmenityCategory = () => {
    if (!newAmenityCategory.trim()) return;
    
    if (amenities.some(a => a.category === newAmenityCategory.trim())) {
      toast({
        title: 'Error',
        description: 'Esta categoría ya existe',
        variant: 'destructive',
      });
      return;
    }

    setAmenities([...amenities, { category: newAmenityCategory.trim(), items: [] }]);
    setNewAmenityCategory('');
  };

  const removeAmenityCategory = (category: string) => {
    setAmenities(amenities.filter(a => a.category !== category));
  };

  const toggleAmenityItem = (category: string, item: string) => {
    setAmenities(amenities.map(amenity => {
      if (amenity.category === category) {
        const itemExists = amenity.items.includes(item);
        return {
          ...amenity,
          items: itemExists 
            ? amenity.items.filter(i => i !== item)
            : [...amenity.items, item]
        };
      }
      return amenity;
    }));
  };

  const addCustomAmenityItem = (category: string) => {
    const item = newAmenityItem[category]?.trim();
    if (!item) return;

    setAmenities(amenities.map(amenity => {
      if (amenity.category === category) {
        if (amenity.items.includes(item)) {
          toast({
            title: 'Error',
            description: 'Esta amenidad ya existe en la categoría',
            variant: 'destructive',
          });
          return amenity;
        }
        return {
          ...amenity,
          items: [...amenity.items, item]
        };
      }
      return amenity;
    }));
    
    setNewAmenityItem({ ...newAmenityItem, [category]: '' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    
    // Validar que no supere el límite de 20 imágenes
    if (imageFiles.length + files.length + existingImages.length > 20) {
      toast({
        title: '⚠️ Límite de imágenes',
        description: 'Máximo 20 imágenes por propiedad',
        variant: 'destructive',
      });
      return;
    }

    // Validar archivos
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      toast({
        title: '⚠️ Archivos inválidos',
        description: validationErrors.join(', '),
        variant: 'destructive',
      });
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Comprimir imágenes
    toast({
      title: '🔄 Comprimiendo imágenes...',
      description: `Optimizando ${validFiles.length} imágenes`,
    });

    try {
      const compressedFiles = await compressImages(
        validFiles,
        { maxSizeMB: 2, maxWidthOrHeight: 1920, quality: 0.85, format: 'webp' },
        (completed, total) => {
          console.log(`Comprimiendo: ${completed}/${total}`);
        }
      );

      setImageFiles(prev => [...prev, ...compressedFiles]);
      
      toast({
        title: '✅ Imágenes optimizadas',
        description: `${compressedFiles.length} imágenes listas para subir`,
      });
    } catch (error: any) {
      console.error('Error comprimiendo imágenes:', error);
      toast({
        title: '❌ Error',
        description: error.message || 'Error al comprimir imágenes',
        variant: 'destructive',
      });
    }

    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imageId: string, url: string) => {
    try {
      // Delete from storage
      const fileName = url.split('/property-images/')[1];
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

    // ✅ VERIFICACIÓN DE EMAIL (solo para creación, no para edición)
    if (!property && !user?.email_confirmed_at && !user?.confirmed_at) {
      toast({
        title: '⚠️ Email no verificado',
        description: 'Debes verificar tu email antes de publicar propiedades. Revisa tu bandeja de entrada.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      // Auto-generate title for SEO/metadata
      const propertyTypeLabel = {
        casa: 'Casa',
        departamento: 'Departamento',
        terreno: 'Terreno',
        oficina: 'Oficina',
        local: 'Local Comercial',
        bodega: 'Bodega',
        edificio: 'Edificio',
        rancho: 'Rancho'
      }[formData.type] || 'Propiedad';
      
      // Usar colonia como elemento principal, fallback a municipio si no está disponible
      const locationText = formData.colonia || formData.municipality;
      const autoTitle = `${propertyTypeLabel} en ${locationText}`;

      // Validate form data
      const validatedData = propertySchema.parse({
        ...formData,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        parking: formData.parking ? parseInt(formData.parking) : undefined,
        sqft: formData.sqft ? parseFloat(formData.sqft) : undefined,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : undefined,
        video_url: formData.video_url || undefined,
        amenities: amenities.filter(a => a.items.length > 0),
      });

      let propertyId = property?.id;

      // Preparar información de duplicado si se detectó
      const duplicateWarningData = titleValidation.isDuplicate ? {
        detected_at: new Date().toISOString(),
        duplicate_count: titleValidation.duplicateCount,
        similar_properties: titleValidation.existingProperties.map(p => ({
          id: p.id,
          title: p.title,
          address: p.address,
          price: p.price,
          status: p.status,
          agent_id: p.agent_id
        }))
      } : null;

      // Create or update property
      if (property) {
        const { error } = await supabase
          .from('properties')
          .update({ ...validatedData, title: autoTitle } as any)
          .eq('id', property.id);

        if (error) throw error;
      } else {
        const propertyData: any = {
          ...validatedData,
          title: autoTitle,
          agent_id: user?.id,
          status: 'pausada', // Siempre enviar a moderación
          last_renewed_at: new Date().toISOString(),
          duplicate_warning: titleValidation.isDuplicate,
          duplicate_warning_data: duplicateWarningData,
          requires_manual_review: titleValidation.isDuplicate,
        };

        const { data, error } = await supabase
          .from('properties')
          .insert([propertyData])
          .select()
          .single();

        if (error) throw error;
        propertyId = data.id;
      }

      // Upload new images
      const uploadedImages: Array<{ id: string; url: string }> = [];
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${propertyId}/${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('property-images')
            .getPublicUrl(fileName);

          const { data: imageData, error: imageError } = await supabase
            .from('images')
            .insert({
              property_id: propertyId,
              url: publicUrl,
              position: existingImages.length + i,
            })
            .select()
            .single();

          if (imageError) throw imageError;
          
          if (imageData) {
            uploadedImages.push({ id: imageData.id, url: publicUrl });
          }
        }
      }

      if (!property) {
        if (titleValidation.isDuplicate) {
          toast({
            title: '⚠️ Propiedad en revisión manual',
            description: `Tu propiedad fue creada pero detectamos ${titleValidation.duplicateCount} propiedad${titleValidation.duplicateCount === 1 ? '' : 'es'} similar${titleValidation.duplicateCount === 1 ? '' : 'es'}. Un moderador la revisará pronto.`,
            duration: 6000,
          });
        } else {
          toast({
            title: '✅ Propiedad enviada',
            description: 'Tu propiedad ha sido enviada para revisión. Un administrador la aprobará pronto.',
          });
        }
      } else {
        toast({
          title: '✅ Guardado',
          description: 'Los cambios han sido guardados correctamente',
        });
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
      {property?.status === 'pausada' && property?.rejection_reason && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Propiedad Rechazada</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>Motivo:</strong> {property.rejection_reason.label}
            </p>
            {property.rejection_reason.details && (
              <p className="text-sm">{property.rejection_reason.details}</p>
            )}
            <p className="text-sm font-medium mt-2">
              Por favor corrige los problemas mencionados y reenvía la propiedad para una nueva revisión.
            </p>
            <p className="text-xs text-muted-foreground">
              Reenvíos: {property.resubmission_count || 0}/3
            </p>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="listing_type">Tipo de Listado*</Label>
          <Select value={formData.listing_type} onValueChange={(value) => setFormData({ ...formData, listing_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venta">Venta</SelectItem>
              <SelectItem value="renta">Renta</SelectItem>
            </SelectContent>
          </Select>
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
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="bodega">Bodega</SelectItem>
              <SelectItem value="edificio">Edificio</SelectItem>
              <SelectItem value="rancho">Rancho</SelectItem>
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
          <LocationSearch
            defaultValue={formData.address}
            onLocationSelect={(location) => {
              setFormData({
                ...formData,
                address: location.address,
                municipality: location.municipality,
                state: location.state,
                colonia: location.colonia || '',
                lat: location.lat,
                lng: location.lng,
              });
            }}
          />
        </div>

        {/* Warning de título duplicado */}
        {titleValidation.isDuplicate && !property && (
          <Alert variant="destructive" className="md:col-span-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ Posible propiedad duplicada detectada</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  Se encontr{titleValidation.duplicateCount === 1 ? 'ó' : 'aron'} <strong>{titleValidation.duplicateCount}</strong> propiedad{titleValidation.duplicateCount === 1 ? '' : 'es'} similar{titleValidation.duplicateCount === 1 ? '' : 'es'}:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm mb-3">
                  {titleValidation.existingProperties.map(prop => (
                    <li key={prop.id}>
                      {prop.address} - ${prop.price.toLocaleString()} 
                      <Badge variant="outline" className="ml-2">{prop.status}</Badge>
                    </li>
                  ))}
                </ul>
                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 mt-2">
                  <AlertDescription className="text-sm">
                    <strong>📝 Nota:</strong> Tu propiedad será enviada a <strong>revisión manual</strong> para verificar que no sea un duplicado. Los moderadores compararán ambas propiedades antes de aprobar.
                  </AlertDescription>
                </Alert>
              </AlertDescription>
            </Alert>
          )}

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

        {(['oficina', 'local', 'bodega', 'edificio'].includes(formData.type)) && (
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

        {/* Video URL */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="video_url" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Video Tour (YouTube o Vimeo)
          </Label>
          <Input
            id="video_url"
            type="url"
            value={formData.video_url}
            onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-xs text-muted-foreground">
            Opcional: Agrega un link de YouTube o Vimeo para mostrar un tour virtual
          </p>
        </div>

        {/* Amenidades */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">Amenidades</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nueva categoría..."
                value={newAmenityCategory}
                onChange={(e) => setNewAmenityCategory(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenityCategory())}
                className="w-40"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAmenityCategory}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick add predefined categories */}
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_CATEGORIES.filter(cat => !amenities.some(a => a.category === cat)).map(category => (
              <Button
                key={category}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAmenities([...amenities, { category, items: [] }]);
                }}
              >
                + {category}
              </Button>
            ))}
          </div>

          {/* Amenity categories */}
          <div className="space-y-4">
            {amenities.map((amenity) => (
              <Card key={amenity.category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{amenity.category}</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAmenityCategory(amenity.category)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Common amenities for this category */}
                  {COMMON_AMENITIES[amenity.category] && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {COMMON_AMENITIES[amenity.category].map(item => (
                        <div key={item} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${amenity.category}-${item}`}
                            checked={amenity.items.includes(item)}
                            onCheckedChange={() => toggleAmenityItem(amenity.category, item)}
                          />
                          <Label
                            htmlFor={`${amenity.category}-${item}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {item}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom amenities */}
                  {amenity.items.filter(item => !COMMON_AMENITIES[amenity.category]?.includes(item)).length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Amenidades personalizadas:</p>
                      <div className="flex flex-wrap gap-2">
                        {amenity.items
                          .filter(item => !COMMON_AMENITIES[amenity.category]?.includes(item))
                          .map(item => (
                            <div key={item} className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                              <span className="text-sm">{item}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => toggleAmenityItem(amenity.category, item)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Add custom amenity */}
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Agregar amenidad personalizada..."
                      value={newAmenityItem[amenity.category] || ''}
                      onChange={(e) => setNewAmenityItem({ ...newAmenityItem, [amenity.category]: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenityItem(amenity.category))}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCustomAmenityItem(amenity.category)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              onChange={handleImageUpload}
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
