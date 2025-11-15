import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { CheckCircle2, Home, MapPin, Maximize, Bed, Bath, Car, FileText, Sparkles, XCircle, AlertCircle } from 'lucide-react';

interface Step6ReviewProps {
  formData: PropertyFormData;
  imageFiles: File[];
  existingImages?: any[];
}

export const Step6Review = ({ formData, imageFiles, existingImages = [] }: Step6ReviewProps) => {
  const { formatPrice } = useCurrencyConversion();
  
  const totalImages = imageFiles.length + existingImages.length;
  const totalAmenities = formData.amenities.reduce((sum, cat) => sum + cat.items.length, 0);

  // Generar título automático igual que en PropertyFormWizard
  const propertyTypeLabels: Record<string, string> = {
    casa: 'Casa',
    departamento: 'Departamento',
    terreno: 'Terreno',
    local_comercial: 'Local Comercial',
    oficina: 'Oficina',
    bodega: 'Bodega',
    edificio: 'Edificio',
    rancho: 'Rancho',
    penthouse: 'Penthouse',
    villa: 'Villa',
    estudio: 'Estudio',
    townhouse: 'Townhouse',
    cabaña: 'Cabaña',
    hacienda: 'Hacienda',
    loft: 'Loft',
  };
  
  const typeLabel = propertyTypeLabels[formData.type] || formData.type;
  const listingTypeLabel = formData.for_sale && formData.for_rent 
    ? 'en Venta/Renta' 
    : formData.for_sale 
      ? 'en Venta' 
      : 'en Renta';
  
  // Usar colonia si está disponible, sino municipio como fallback
  const generatedTitle = formData.colonia && formData.colonia.trim()
    ? `${typeLabel} ${listingTypeLabel} en ${formData.colonia}`
    : `${typeLabel} ${listingTypeLabel} en ${formData.municipality}`;

  const checklistItems = [
    { label: 'Tipo de listado', completed: formData.for_sale || formData.for_rent },
    { label: 'Precio(s)', completed: (formData.for_sale && formData.sale_price) || (formData.for_rent && formData.rent_price) },
    { label: 'Ubicación', completed: !!(formData.state && formData.municipality && formData.address) },
    { label: 'Descripción', completed: formData.description.length >= 20 },
    { label: 'Imágenes (mín. 3)', completed: totalImages >= 3 },
  ];

  const completedItems = checklistItems.filter((item) => item.completed).length;
  const isReadyToPublish = completedItems === checklistItems.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Revisión Final</h2>
        <p className="text-muted-foreground">
          Verifica que toda la información sea correcta antes de publicar
        </p>
      </div>

      {/* Checklist */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Checklist de Completitud</h3>
          <div className="space-y-3">
            {checklistItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  item.completed ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {item.completed && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Progreso</span>
              <span className="text-sm text-muted-foreground">
                {completedItems} / {checklistItems.length} completados
              </span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(completedItems / checklistItems.length) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validaciones críticas */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Información Crítica
          </h4>
          
          <div className="space-y-2 text-sm">
            {/* Colonia */}
            <div className="flex items-center gap-2">
              {formData.colonia && formData.colonia.trim() ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Colonia: <strong>{formData.colonia}</strong></span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">
                    <strong>Falta la colonia</strong> - Requerida para el título
                  </span>
                </>
              )}
            </div>
            
            {/* Coordenadas */}
            <div className="flex items-center gap-2">
              {formData.lat && formData.lng ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Ubicación en mapa confirmada</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-yellow-600">
                    Ubicación no confirmada en mapa
                  </span>
                </>
              )}
            </div>
            
            {/* Imágenes */}
            <div className="flex items-center gap-2">
              {(imageFiles.length + existingImages.length) >= 3 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>{imageFiles.length + existingImages.length} imágenes</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">
                    <strong>Faltan imágenes</strong> - Mínimo 3 requeridas
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview de la propiedad */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2 mb-4">
            <h3 className="text-xl font-bold">{generatedTitle}</h3>
            <p className="text-sm text-muted-foreground">
              Vista previa de cómo se mostrará tu propiedad
            </p>
          </div>

          {/* Badges de listado */}
          <div className="flex gap-2">
            {formData.for_sale && (
              <Badge variant="default" className="text-base px-3 py-1">
                En Venta: {formData.sale_price && formatPrice(formData.sale_price, formData.currency)}
              </Badge>
            )}
            {formData.for_rent && (
              <Badge variant="secondary" className="text-base px-3 py-1">
                En Renta: {formData.rent_price && formatPrice(formData.rent_price, formData.currency)}/mes
              </Badge>
            )}
          </div>

          {/* Tipo de propiedad */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Home className="w-4 h-4" />
            <span>{propertyTypeLabels[formData.type]}</span>
          </div>

          {/* Ubicación */}
          {formData.state && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                {formData.colonia && <p className="font-medium">{formData.colonia}</p>}
                <p className="text-muted-foreground">
                  {formData.municipality}, {formData.state}
                </p>
              </div>
            </div>
          )}

          {/* Características */}
          <div className="flex flex-wrap gap-4 pt-2">
            {formData.bedrooms && (
              <div className="flex items-center gap-2 text-sm">
                <Bed className="w-4 h-4 text-muted-foreground" />
                <span>{formData.bedrooms} recámaras</span>
              </div>
            )}
            {formData.bathrooms && (
              <div className="flex items-center gap-2 text-sm">
                <Bath className="w-4 h-4 text-muted-foreground" />
                <span>{formData.bathrooms} baños</span>
              </div>
            )}
            {formData.parking && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span>{formData.parking} estacionamientos</span>
              </div>
            )}
            {formData.sqft && (
              <div className="flex items-center gap-2 text-sm">
                <Maximize className="w-4 h-4 text-muted-foreground" />
                <span>{formData.sqft} m²</span>
              </div>
            )}
          </div>

          {/* Descripción */}
          {formData.description && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Descripción</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {formData.description}
              </p>
            </div>
          )}

          {/* Amenidades */}
          {totalAmenities > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  Amenidades ({totalAmenities})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.amenities.slice(0, 2).map((category) =>
                  category.items.slice(0, 5).map((item) => (
                    <Badge key={item} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))
                )}
                {totalAmenities > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{totalAmenities - 10} más
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Imágenes */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">
              {totalImages} {totalImages === 1 ? 'imagen' : 'imágenes'}
            </p>
            {totalImages >= 3 ? (
              <p className="text-sm text-green-600">✓ Mínimo de imágenes cumplido</p>
            ) : (
              <p className="text-sm text-destructive">✗ Necesitas {3 - totalImages} imágenes más</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estado de publicación */}
      {!isReadyToPublish && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <h4 className="font-semibold text-destructive mb-2">
              Completa los siguientes campos antes de publicar:
            </h4>
            <ul className="text-sm space-y-1">
              {checklistItems
                .filter((item) => !item.completed)
                .map((item, index) => (
                  <li key={index} className="text-muted-foreground">
                    • {item.label}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
