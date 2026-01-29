import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertySummary } from '@/types/property';

interface UseHomePropertiesResult {
  featuredProperties: PropertySummary[];
  recentProperties: PropertySummary[];
  isLoading: boolean;
  error: Error | null;
}

export function useHomeProperties(): UseHomePropertiesResult {
  const { data: featuredData, isLoading: isLoadingFeatured, error: featuredError } = useQuery({
    queryKey: ['home-featured-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          slug,
          price,
          currency,
          listing_type,
          type,
          bedrooms,
          bathrooms,
          sqft,
          lot_size,
          address,
          colonia,
          municipality,
          state,
          images,
          is_featured,
          created_at
        `)
        .eq('status', 'activa')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as PropertySummary[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: recentData, isLoading: isLoadingRecent, error: recentError } = useQuery({
    queryKey: ['home-recent-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          slug,
          price,
          currency,
          listing_type,
          type,
          bedrooms,
          bathrooms,
          sqft,
          lot_size,
          address,
          colonia,
          municipality,
          state,
          images,
          is_featured,
          created_at
        `)
        .eq('status', 'activa')
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as PropertySummary[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    featuredProperties: featuredData || [],
    recentProperties: recentData || [],
    isLoading: isLoadingFeatured || isLoadingRecent,
    error: featuredError || recentError,
  };
}
