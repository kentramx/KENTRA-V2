import { useState, useEffect } from 'react';
import { monitoring } from '@/lib/monitoring';

export interface PropertyFormData {
  // Opciones de listado
  for_sale: boolean;
  for_rent: boolean;
  sale_price: number | null;
  rent_price: number | null;
  currency: 'MXN' | 'USD';
  
  // Información básica
  type: string;
  
  // Ubicación
  address: string;
  colonia: string;
  municipality: string;
  state: string;
  lat?: number;
  lng?: number;
  
  // Características
  bedrooms: string;
  bathrooms: string;
  parking: string;
  sqft: string;
  lot_size: string;
  
  // Descripción
  description: string;
  video_url: string;
  
  // Amenidades
  amenities: Array<{ category: string; items: string[] }>;
}

const DRAFT_KEY = 'propertyFormDraft';

export const useFormWizard = (initialData?: Partial<PropertyFormData>) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PropertyFormData>({
    for_sale: true,
    for_rent: false,
    sale_price: null,
    rent_price: null,
    currency: 'MXN',
    type: 'casa',
    address: '',
    colonia: '',
    municipality: '',
    state: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    sqft: '',
    lot_size: '',
    description: '',
    video_url: '',
    amenities: [],
    ...initialData,
  });

  // Cargar borrador guardado al montar
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft && !initialData) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
      } catch (error) {
        monitoring.warn('Error loading draft', { hook: 'useFormWizard', error });
      }
    }
  }, []);

  // Auto-save cada 30 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }, 30000);
    return () => clearTimeout(timer);
  }, [formData]);

  const updateFormData = (updates: Partial<PropertyFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Información básica
        if (!formData.for_sale && !formData.for_rent) return false;
        if (formData.for_sale && (!formData.sale_price || formData.sale_price <= 0)) return false;
        if (formData.for_rent && (!formData.rent_price || formData.rent_price <= 0)) return false;
        if (!formData.type) return false;
        return true;
      
      case 2: // Ubicación
        return !!(
          formData.state && 
          formData.municipality && 
          formData.address &&
          formData.colonia && 
          formData.colonia.trim() !== '' &&
          formData.lat &&
          formData.lng
        );
      
      case 3: // Características
        // Validar según tipo de propiedad
        if (['casa', 'departamento'].includes(formData.type)) {
          return !!(formData.bedrooms && formData.bathrooms);
        }
        return true;
      
      case 4: // Descripción e imágenes
        const charCount = formData.description.length;
        const wordCount = formData.description.trim().split(/\s+/).filter(word => word.length > 0).length;
        const minWords = 30;
        const maxChars = 2000;
        return wordCount >= minWords && charCount <= maxChars;
      
      case 5: // Amenidades (opcional)
        return true;
      
      case 6: // Revisión final
        return true;
      
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 6) {
      setCurrentStep(step);
    }
  };

  const isStepComplete = (step: number): boolean => {
    return validateStep(step);
  };

  return {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    validateStep,
    isStepComplete,
    saveDraft,
    clearDraft,
  };
};
