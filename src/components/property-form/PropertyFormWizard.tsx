import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormProgressBar } from './FormProgressBar';
import { FormNavigation } from './FormNavigation';
import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2Location } from './steps/Step2Location';
import { Step3Features } from './steps/Step3Features';
import { Step4DescriptionImages } from './steps/Step4DescriptionImages';
import { Step5Amenities } from './steps/Step5Amenities';
import { Step6Review } from './steps/Step6Review';
import { useFormWizard } from '@/hooks/useFormWizard';
import { useCreateProperty, useUpdateProperty } from '@/hooks/usePropertyMutations';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Save } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

interface PropertyFormWizardProps {
  property?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PropertyFormWizard = ({ property, onSuccess, onCancel }: PropertyFormWizardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(property?.images || []);
  
  const {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    validateStep,
    isStepComplete,
    clearDraft,
  } = useFormWizard(property ? {
    for_sale: property.listing_type === 'venta' || property.for_sale,
    for_rent: property.listing_type === 'renta' || property.for_rent,
    sale_price: property.sale_price || (property.listing_type === 'venta' ? property.price : null),
    rent_price: property.rent_price || (property.listing_type === 'renta' ? property.price : null),
    currency: property.currency || 'MXN',
    type: property.type,
    address: property.address,
    colonia: property.colonia,
    municipality: property.municipality,
    state: property.state,
    lat: property.lat,
    lng: property.lng,
    bedrooms: property.bedrooms?.toString() || '',
    bathrooms: property.bathrooms?.toString() || '',
    parking: property.parking?.toString() || '',
    sqft: property.sqft?.toString() || '',
    lot_size: property.lot_size?.toString() || '',
    description: property.description || '',
    video_url: property.video_url || '',
    amenities: property.amenities || [],
  } : undefined);

  const createPropertyMutation = useCreateProperty();
  const updatePropertyMutation = useUpdateProperty();
  const { uploadImages } = useImageUpload();

  const handleSaveDraft = () => {
    toast({
      title: 'Borrador guardado',
      description: 'Tus cambios se han guardado localmente',
    });
  };

  const handleSubmit = async () => {
    // ========== VALIDACIONES CRÍTICAS ==========
    
    // 1. Validar campos básicos
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      toast({
        title: 'Información incompleta',
        description: 'Por favor completa todos los campos requeridos en cada paso',
        variant: 'destructive',
      });
      return;
    }

    // 2. Validar colonia específicamente (crítico para título)
    if (!formData.colonia || formData.colonia.trim() === '') {
      toast({
        title: '⚠️ Falta la colonia',
        description: 'La colonia es obligatoria para crear un título descriptivo de tu propiedad. Por favor regresa al Paso 2 y completa este campo.',
        variant: 'destructive',
      });
      goToStep(2);
      return;
    }

    // 3. Geocodificar automáticamente si no hay coordenadas
    let finalLat = formData.lat;
    let finalLng = formData.lng;

    if (!finalLat || !finalLng) {
      console.log('[PROPERTY FORM] Geocoding property automatically...');
      
      try {
        const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke(
          'geocode-property',
          {
            body: {
              propertyId: 'temp', // Temporal, se actualizará después
              colonia: formData.colonia,
              municipality: formData.municipality,
              state: formData.state,
            },
          }
        );

        if (geocodeError || !geocodeData?.success) {
          console.warn('[PROPERTY FORM] Geocoding failed:', geocodeError);
          toast({
            title: '⚠️ No se pudo geocodificar la ubicación',
            description: 'La propiedad se guardará sin coordenadas. Puedes editarla después para agregar la ubicación en el mapa.',
            variant: 'default',
          });
        } else {
          finalLat = geocodeData.lat;
          finalLng = geocodeData.lng;
          console.log('[PROPERTY FORM] Geocoded successfully:', { finalLat, finalLng });
        }
      } catch (error) {
        console.error('[PROPERTY FORM] Geocoding error:', error);
        // Continuar sin coordenadas
      }
    }

    // 4. Validar imágenes
    if (imageFiles.length + existingImages.length < 3) {
      toast({
        title: '📸 Imágenes insuficientes',
        description: 'Necesitas al menos 3 imágenes de buena calidad para publicar tu propiedad.',
        variant: 'destructive',
      });
      goToStep(4);
      return;
    }

    // Generar título automático basado en tipo y ubicación
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

    // Calcular el precio principal basado en el tipo de listado
    const mainPrice = formData.for_sale && formData.sale_price 
      ? formData.sale_price 
      : formData.rent_price || 0;

    const propertyData: PropertyInsert = {
      title: generatedTitle,
      price: mainPrice,
      agent_id: user?.id!,
      for_sale: formData.for_sale,
      for_rent: formData.for_rent,
      sale_price: formData.sale_price,
      rent_price: formData.rent_price,
      currency: formData.currency as 'MXN' | 'USD',
      type: formData.type as Database['public']['Enums']['property_type'],
      listing_type: formData.for_sale ? 'venta' : 'renta',
      address: formData.address,
      colonia: formData.colonia,
      municipality: formData.municipality,
      state: formData.state,
      lat: finalLat,
      lng: finalLng,
      geom: finalLat && finalLng 
        ? `POINT(${finalLng} ${finalLat})` 
        : null,
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
      parking: formData.parking ? parseInt(formData.parking) : null,
      sqft: formData.sqft ? parseFloat(formData.sqft) : null,
      lot_size: formData.lot_size ? parseFloat(formData.lot_size) : null,
      description: formData.description,
      video_url: formData.video_url || null,
      amenities: formData.amenities,
      status: 'pendiente_aprobacion',
    };

    try {
      let createdProperty;
      
      if (property) {
        // Actualizar propiedad existente
        createdProperty = await updatePropertyMutation.mutateAsync({
          id: property.id,
          updates: propertyData,
        });
      } else {
        // Crear nueva propiedad
        createdProperty = await createPropertyMutation.mutateAsync(propertyData);
      }

      // Si hay nuevas imágenes, subirlas y guardarlas en la tabla images
      if (imageFiles.length > 0 && createdProperty) {
        console.log('Uploading images to storage...');
        const uploadedUrls = await uploadImages(imageFiles, createdProperty.id);
        
        console.log('Saving image records to database:', uploadedUrls.length);
        // Insertar registros en la tabla images
        const imageRecords = uploadedUrls.map((url, index) => ({
          property_id: createdProperty.id,
          url: url,
          position: index,
        }));

        const { error: imagesError } = await supabase
          .from('images')
          .insert(imageRecords);

        if (imagesError) {
          console.error('Error saving images:', imagesError);
          toast({
            title: '⚠️ Advertencia',
            description: 'La propiedad se creó pero hubo un error al guardar las imágenes',
            variant: 'destructive',
          });
        } else {
          console.log('Images saved successfully');
        }
      }

      clearDraft();
      onSuccess();
    } catch (error) {
      console.error('Error submitting property:', error);
    }
  };

  const isNextDisabled = !validateStep(currentStep);
  const isSubmitting = createPropertyMutation.isPending || updatePropertyMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card className="p-6 md:p-8">
        {/* Progress Bar */}
        <FormProgressBar
          currentStep={currentStep}
          totalSteps={6}
          isStepComplete={isStepComplete}
          onStepClick={goToStep}
        />

        {/* Step Content */}
        <div className="mt-8 min-h-[500px]">
          {currentStep === 1 && (
            <Step1BasicInfo formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 2 && (
            <Step2Location formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 3 && (
            <Step3Features formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 4 && (
            <Step4DescriptionImages
              formData={formData}
              updateFormData={updateFormData}
              imageFiles={imageFiles}
              setImageFiles={setImageFiles}
              existingImages={existingImages}
            />
          )}
          {currentStep === 5 && (
            <Step5Amenities formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 6 && (
            <Step6Review
              formData={formData}
              imageFiles={imageFiles}
              existingImages={existingImages}
            />
          )}
        </div>

        {/* Navigation */}
        {currentStep < 6 ? (
          <FormNavigation
            currentStep={currentStep}
            totalSteps={6}
            onPrev={prevStep}
            onNext={nextStep}
            onSaveDraft={handleSaveDraft}
            isNextDisabled={isNextDisabled}
            isLoading={isSubmitting}
          />
        ) : (
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={isSubmitting}
            >
              Volver a editar
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !validateStep(1) || !validateStep(2) || imageFiles.length + existingImages.length < 3}
              >
                {isSubmitting ? 'Publicando...' : property ? 'Guardar Cambios' : 'Publicar Propiedad'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
