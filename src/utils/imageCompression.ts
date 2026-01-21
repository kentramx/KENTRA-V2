/**
 * Compresión de imágenes del lado del cliente
 * Reduce tamaño de archivos antes de subir a Supabase Storage
 */

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  quality: 0.8,
  format: 'webp',
};

// Maximum compression iterations to prevent infinite loops
const MAX_COMPRESSION_ITERATIONS = 5;
// Minimum quality to prevent over-compression
const MIN_QUALITY = 0.4;

/**
 * Loads an image from a File
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts canvas to blob with given quality
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Error al comprimir imagen'));
          return;
        }
        resolve(blob);
      },
      `image/${format}`,
      quality
    );
  });
}

/**
 * Comprime una imagen usando Canvas API
 * Uses iterative approach to prevent stack overflow
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxSizeBytes = opts.maxSizeMB! * 1024 * 1024;

  // Load the image
  const img = await loadImage(file);

  // Calculate dimensions
  let { width, height } = img;
  const maxDim = opts.maxWidthOrHeight!;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = (height / width) * maxDim;
      width = maxDim;
    } else {
      width = (width / height) * maxDim;
      height = maxDim;
    }
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo crear contexto de canvas');
  }

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);

  // Iterative compression with quality reduction
  let currentQuality = opts.quality!;
  let blob: Blob | null = null;

  for (let i = 0; i < MAX_COMPRESSION_ITERATIONS; i++) {
    blob = await canvasToBlob(canvas, opts.format!, currentQuality);

    // Check if size is acceptable
    if (blob.size <= maxSizeBytes) {
      break;
    }

    // Reduce quality for next iteration
    currentQuality = Math.max(MIN_QUALITY, currentQuality * 0.8);

    // If we've hit minimum quality, stop
    if (currentQuality <= MIN_QUALITY) {
      break;
    }
  }

  if (!blob) {
    throw new Error('Error al comprimir imagen');
  }

  // Create new file
  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, `.${opts.format}`),
    {
      type: `image/${opts.format}`,
      lastModified: Date.now(),
    }
  );

  return compressedFile;
}

/**
 * Valida que el archivo sea una imagen soportada
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato no soportado. Use JPG, PNG o WebP',
    };
  }

  // Límite de 5MB para archivo original (reduced from 20MB for better performance)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'La imagen es demasiado grande (máximo 5MB)',
    };
  }

  return { valid: true };
}

/**
 * Comprime múltiples imágenes en paralelo
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<File[]> {
  const compressed: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const validation = validateImageFile(files[i]);
    if (!validation.valid) {
      throw new Error(`${files[i].name}: ${validation.error}`);
    }

    const compressedFile = await compressImage(files[i], options);
    compressed.push(compressedFile);
    
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return compressed;
}

/**
 * Genera URL de Supabase con transformaciones
 */
export function getOptimizedImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  if (!url) return url;

  // Si no es una URL de Supabase Storage, retornar sin modificar
  if (!url.includes('/storage/v1/object/public/')) {
    return url;
  }

  const params = new URLSearchParams();
  
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.quality) params.append('quality', options.quality.toString());
  if (options.format) params.append('format', options.format);

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
