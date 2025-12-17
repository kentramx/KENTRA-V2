import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PropertyFormData } from '@/hooks/useFormWizard';

interface GenerateDescriptionResult {
  description: string;
  remaining: number;
  cached: boolean;
}

export const useGenerateDescription = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateDescription = useCallback(async (formData: PropertyFormData): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<GenerateDescriptionResult>(
        'generate-property-description',
        {
          body: {
            propertyData: {
              type: formData.type,
              state: formData.state,
              municipality: formData.municipality,
              colonia: formData.colonia,
              bedrooms: formData.bedrooms,
              bathrooms: formData.bathrooms,
              sqft: formData.sqft,
              lot_size: formData.lot_size,
              parking: formData.parking,
              amenities: formData.amenities,
              for_sale: formData.for_sale,
              for_rent: formData.for_rent,
              sale_price: formData.sale_price,
              rent_price: formData.rent_price,
              currency: formData.currency,
            }
          }
        }
      );

      if (fnError) {
        console.error('Function error:', fnError);
        throw new Error(fnError.message || 'Error al generar descripción');
      }

      if (!data) {
        throw new Error('No se recibió respuesta');
      }

      // Check if error in response body
      if ('error' in data) {
        throw new Error((data as any).error);
      }

      setRemaining(data.remaining);
      
      if (data.cached) {
        toast({
          title: 'Descripción generada',
          description: 'Se recuperó una descripción similar del caché',
        });
      } else {
        toast({
          title: 'Descripción generada',
          description: `Te quedan ${data.remaining} generaciones esta hora`,
        });
      }

      return data.description;

    } catch (err: any) {
      console.error('Generate description error:', err);
      const errorMessage = err.message || 'Error al generar descripción';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const reset = useCallback(() => {
    setError(null);
    setRemaining(null);
  }, []);

  return {
    generateDescription,
    isGenerating,
    remaining,
    error,
    reset,
  };
};
