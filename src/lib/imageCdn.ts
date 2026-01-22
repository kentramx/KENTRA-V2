/**
 * Image CDN Optimization Utility
 *
 * Supabase Storage supports image transformations via URL parameters.
 * This utility generates optimized image URLs for different use cases.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Generate optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageTransformOptions = {}
): string {
  if (!originalUrl) return '';

  // Check if it's a Supabase storage URL
  const isSupabaseUrl = originalUrl.includes('supabase.co/storage');

  if (!isSupabaseUrl) {
    // For external URLs, return as-is (could add Cloudinary/imgix here)
    return originalUrl;
  }

  // Build transformation parameters
  const params = new URLSearchParams();

  if (options.width) params.set('width', options.width.toString());
  if (options.height) params.set('height', options.height.toString());
  if (options.quality) params.set('quality', options.quality.toString());
  if (options.format) params.set('format', options.format);
  if (options.resize) params.set('resize', options.resize);

  // If no transformations, return original
  if (params.toString() === '') return originalUrl;

  // Add /render/image to the URL path for transformations
  // Original: /storage/v1/object/public/bucket/path
  // Transformed: /storage/v1/render/image/public/bucket/path?width=x
  const transformedUrl = originalUrl.replace(
    '/storage/v1/object/',
    '/storage/v1/render/image/'
  );

  const separator = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${separator}${params.toString()}`;
}

/**
 * Preset configurations for common use cases
 */
export const imagePresets = {
  // Property card thumbnail (grid view)
  thumbnail: {
    width: 400,
    height: 300,
    quality: 75,
    format: 'webp' as const,
    resize: 'cover' as const,
  },

  // Property card medium (list view)
  card: {
    width: 600,
    height: 400,
    quality: 80,
    format: 'webp' as const,
    resize: 'cover' as const,
  },

  // Property detail hero image
  hero: {
    width: 1200,
    height: 800,
    quality: 85,
    format: 'webp' as const,
    resize: 'cover' as const,
  },

  // Full-size for lightbox/gallery
  full: {
    width: 1920,
    quality: 90,
    format: 'webp' as const,
  },

  // Agent avatar
  avatar: {
    width: 100,
    height: 100,
    quality: 80,
    format: 'webp' as const,
    resize: 'cover' as const,
  },

  // Map marker popup
  mapPopup: {
    width: 200,
    height: 150,
    quality: 70,
    format: 'webp' as const,
    resize: 'cover' as const,
  },

  // OG Image / social sharing
  og: {
    width: 1200,
    height: 630,
    quality: 85,
    format: 'jpeg' as const,
    resize: 'cover' as const,
  },
};

/**
 * Get optimized URL using a preset
 */
export function getPresetImageUrl(
  originalUrl: string,
  preset: keyof typeof imagePresets
): string {
  return getOptimizedImageUrl(originalUrl, imagePresets[preset]);
}

/**
 * Generate srcset for responsive images
 */
export function getResponsiveSrcSet(
  originalUrl: string,
  widths: number[] = [400, 600, 800, 1200],
  options: Omit<ImageTransformOptions, 'width'> = { quality: 80, format: 'webp' }
): string {
  return widths
    .map((width) => {
      const url = getOptimizedImageUrl(originalUrl, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Get placeholder/blur hash URL (tiny version for loading)
 */
export function getPlaceholderUrl(originalUrl: string): string {
  return getOptimizedImageUrl(originalUrl, {
    width: 20,
    quality: 30,
    format: 'webp',
  });
}
