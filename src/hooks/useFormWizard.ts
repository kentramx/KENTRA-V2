import { useState, useEffect } from 'react';
import { monitoring } from '@/lib/monitoring';
import { useAuth } from '@/contexts/AuthContext';

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

const DRAFT_KEY_PREFIX = 'propertyFormDraft';

export const useFormWizard = (initialData?: Partial<PropertyFormData>) => {
  const { user } = useAuth();
  // SECURITY: Draft key includes user ID to prevent cross-user data leakage
  const draftKey = user?.id ? `${DRAFT_KEY_PREFIX}_${user.id}` : null;

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

  // Cargar borrador guardado al montar (solo si hay usuario autenticado)
  useEffect(() => {
    if (!draftKey) return; // No cargar sin user ID
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && !initialData) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
      } catch (error) {
        monitoring.warn('Error loading draft', { hook: 'useFormWizard', error });
      }
    }
  }, [draftKey]);

  // Auto-save cada 30 segundos (solo si hay usuario autenticado)
  useEffect(() => {
    if (!draftKey) return; // No guardar sin user ID
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    }, 30000);
    return () => clearTimeout(timer);
  }, [formData, draftKey]);

  const updateFormData = (updates: Partial<PropertyFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const saveDraft = () => {
    if (!draftKey) return; // No guardar sin user ID
    localStorage.setItem(draftKey, JSON.stringify(formData));
  };

  const clearDraft = () => {
    if (!draftKey) return; // No borrar sin user ID
    localStorage.removeItem(draftKey);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Información básica
        if (!formData.for_sale && !formData.for_rent) return false;
        if (formData.for_sale && (!formData.sale_price || formData.sale_price <= 0)) return false;
        if (formData.for_rent && (!formData.rent_price || formData.rent_price <= 0)) return false;
        if (!formData.type) return false;
        return true;
      
      case 2: // Ubicación - lat/lng ya NO son obligatorios, el geocoding automático los obtendrá
        return !!(
          formData.state && 
          formData.municipality && 
          formData.address &&
          formData.colonia && 
          formData.colonia.trim() !== ''
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
