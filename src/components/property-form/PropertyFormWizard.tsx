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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save } from 'lucide-react';

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

  const handleSaveDraft = () => {
    toast({
      title: 'Borrador guardado',
      description: 'Tus cambios se han guardado localmente',
    });
  };

  const handleSubmit = async () => {
    // Validación final
    if (!validateStep(1) || !validateStep(2) || !validateStep(4)) {
      toast({
        title: 'Información incompleta',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    if (imageFiles.length + existingImages.length < 3) {
      toast({
        title: 'Imágenes insuficientes',
        description: 'Necesitas al menos 3 imágenes para publicar',
        variant: 'destructive',
      });
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
    
    const generatedTitle = `${typeLabel} ${listingTypeLabel} en ${formData.municipality}`;

    // Calcular el precio principal basado en el tipo de listado
    const mainPrice = formData.for_sale && formData.sale_price 
      ? formData.sale_price 
      : formData.rent_price || 0;

    const propertyData = {
      title: generatedTitle,
      price: mainPrice,
      agent_id: user?.id,
      for_sale: formData.for_sale,
      for_rent: formData.for_rent,
      sale_price: formData.sale_price,
      rent_price: formData.rent_price,
      currency: formData.currency,
      type: formData.type,
      listing_type: formData.for_sale ? 'venta' : 'renta',
      address: formData.address,
      colonia: formData.colonia,
      municipality: formData.municipality,
      state: formData.state,
      lat: formData.lat,
      lng: formData.lng,
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
      if (property) {
        await updatePropertyMutation.mutateAsync({
          id: property.id,
          updates: propertyData,
        });
      } else {
        await createPropertyMutation.mutateAsync(propertyData);
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
