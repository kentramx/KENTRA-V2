import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyStatus } from '@/types/property';
import { monitoring } from '@/lib/monitoring';

interface ExistingPropertyInfo {
  id: string;
  title: string;
  address: string;
  price: number;
  status: PropertyStatus;
  agent_id: string;
}

interface TitleValidationResult {
  isDuplicate: boolean;
  duplicateCount: number;
  existingProperties: ExistingPropertyInfo[];
  loading: boolean;
}

export const usePropertyTitleValidation = (
  title: string,
  municipality: string,
  state: string,
  currentPropertyId?: string
) => {
  const [result, setResult] = useState<TitleValidationResult>({
    isDuplicate: false,
    duplicateCount: 0,
    existingProperties: [],
    loading: false,
  });

  useEffect(() => {
    const checkDuplicate = async () => {
      if (!title || !municipality || !state) {
        setResult({
          isDuplicate: false,
          duplicateCount: 0,
          existingProperties: [],
          loading: false,
        });
        return;
      }

      setResult(prev => ({ ...prev, loading: true }));

      try {
        let query = supabase
          .from('properties')
          .select('id, title, address, price, status, agent_id')
          .eq('title', title)
          .eq('municipality', municipality)
          .eq('state', state)
          .in('status', ['activa', 'pausada']);

        // Excluir la propiedad actual si estamos editando
        if (currentPropertyId) {
          query = query.neq('id', currentPropertyId);
        }

        const { data, error } = await query.limit(5);

        if (error) throw error;

        setResult({
          isDuplicate: (data?.length || 0) > 0,
          duplicateCount: data?.length || 0,
          existingProperties: data || [],
          loading: false,
        });
      } catch (error) {
        monitoring.error('Error checking duplicate title', { hook: 'usePropertyTitleValidation', error });
        setResult({
          isDuplicate: false,
          duplicateCount: 0,
          existingProperties: [],
          loading: false,
        });
      }
    };

    // Debounce de 500ms
    const timeoutId = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timeoutId);
  }, [title, municipality, state, currentPropertyId]);

  return result;
};
