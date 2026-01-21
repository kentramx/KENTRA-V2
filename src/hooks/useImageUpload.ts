import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { monitoring } from '@/lib/monitoring';

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (reduced for better performance)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_CONCURRENT_UPLOADS = 3;

interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ total: 0, completed: 0, failed: 0 });
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate file before upload
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `Tipo de archivo no permitido: ${file.type}` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `Archivo muy grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máximo 5MB)` };
    }
    return { valid: true };
  }, []);

  const uploadImage = async (file: File, propertyId: string, index: number): Promise<string | null> => {
    // Check if upload was cancelled
    if (abortControllerRef.current?.signal.aborted) {
      return null;
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      monitoring.warn('Invalid file rejected', {
        hook: 'useImageUpload',
        propertyId,
        error: validation.error,
      });
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
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
      return null;
    }
  };

  // Upload images concurrently with limit
  const uploadImages = async (files: File[], propertyId: string): Promise<string[]> => {
    // Create new abort controller for this batch
    abortControllerRef.current = new AbortController();

    setUploading(true);
    setProgress({ total: files.length, completed: 0, failed: 0 });

    const urls: string[] = [];
    let completed = 0;
    let failed = 0;

    try {
      // Process in batches for concurrent upload with limit
      for (let i = 0; i < files.length; i += MAX_CONCURRENT_UPLOADS) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const batch = files.slice(i, i + MAX_CONCURRENT_UPLOADS);
        const results = await Promise.allSettled(
          batch.map((file, batchIndex) => uploadImage(file, propertyId, i + batchIndex))
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            urls.push(result.value);
            completed++;
          } else {
            failed++;
          }
          setProgress({ total: files.length, completed, failed });
        });
      }

      // Show summary toast
      if (failed > 0) {
        toast({
          title: 'Subida parcial',
          description: `${completed} de ${files.length} imágenes subidas correctamente`,
          variant: 'destructive',
        });
      } else if (completed > 0) {
        toast({
          title: 'Imágenes subidas',
          description: `${completed} imágenes subidas correctamente`,
        });
      }
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }

    return urls;
  };

  // Cancel ongoing uploads
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({
        title: 'Cancelado',
        description: 'La subida de imágenes ha sido cancelada',
      });
    }
  }, [toast]);

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
    progress,
    uploadImage,
    uploadImages,
    deleteImage,
    getImageUrl,
    cancelUpload,
    validateFile,
  };
};
