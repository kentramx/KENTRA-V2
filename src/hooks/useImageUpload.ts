import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { monitoring } from '@/lib/monitoring';

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (file: File, propertyId: string, index: number): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${propertyId}/${Date.now()}_${index}.${fileExt}`;

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

      return publicUrl;
    } catch (error) {
      monitoring.error('Error uploading property image', {
        hook: 'useImageUpload',
        propertyId,
        error,
      });
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen',
        variant: 'destructive',
      });
      return null;
    }
  };

  const uploadImages = async (files: File[], propertyId: string): Promise<string[]> => {
    setUploading(true);
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImage(files[i], propertyId, i);
        if (url) urls.push(url);
      }
    } finally {
      setUploading(false);
    }

    return urls;
  };

  const deleteImage = async (url: string): Promise<boolean> => {
    try {
      const fileName = url.split('/property-images/')[1];
      if (!fileName) return false;

      const { error } = await supabase.storage
        .from('property-images')
        .remove([fileName]);

      if (error) throw error;
      return true;
    } catch (error) {
      monitoring.warn('Error deleting property image', {
        hook: 'useImageUpload',
        url,
        error,
      });
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la imagen',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getImageUrl = (fileName: string): string => {
    const { data: { publicUrl } } = supabase.storage
      .from('property-images')
      .getPublicUrl(fileName);
    return publicUrl;
  };

  return {
    uploading,
    uploadImage,
    uploadImages,
    deleteImage,
    getImageUrl,
  };
};
