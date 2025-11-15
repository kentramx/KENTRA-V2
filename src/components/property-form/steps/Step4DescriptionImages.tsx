import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { Upload, X, Video, FileText } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';

interface Step4DescriptionImagesProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
  imageFiles: File[];
  setImageFiles: (files: File[]) => void;
  existingImages?: any[];
}

export const Step4DescriptionImages = ({
  formData,
  updateFormData,
  imageFiles,
  setImageFiles,
  existingImages = [],
}: Step4DescriptionImagesProps) => {
  const { uploadImages } = useImageUpload();
  const [dragActive, setDragActive] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setImageFiles([...imageFiles, ...files]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setImageFiles([...imageFiles, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const charCount = formData.description.length;
  const wordCount = formData.description.trim().split(/\s+/).filter(word => word.length > 0).length;
  const minWords = 50;
  const maxChars = 2000;
  const isValidLength = wordCount >= minWords && charCount <= maxChars;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Descripción e Imágenes</h2>
        <p className="text-muted-foreground">
          Describe tu propiedad y agrega fotos atractivas
        </p>
      </div>

      {/* Descripción */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descripción
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder="Describe tu propiedad: características principales, acabados, ubicación, ventajas..."
              rows={8}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-sm">
              <p className={wordCount < minWords ? 'text-destructive' : 'text-muted-foreground'}>
                Mínimo {minWords} palabras ({wordCount} actual)
              </p>
              <p className={charCount > maxChars ? 'text-destructive' : 'text-muted-foreground'}>
                {charCount} / {maxChars} caracteres
              </p>
            </div>
          </div>

          {!isValidLength && charCount > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              {wordCount < minWords && (
                <p className="text-destructive">Faltan {minWords - wordCount} palabras para alcanzar el mínimo</p>
              )}
              {charCount > maxChars && (
                <p className="text-destructive">Excedes por {charCount - maxChars} caracteres</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Imágenes */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Imágenes
              <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Mínimo 3 fotos. La primera será la foto principal.
            </p>
          </div>

          {/* Zona de drag & drop */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">
              Arrastra tus imágenes aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              PNG, JPG hasta 10MB cada una
            </p>
            <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
              Seleccionar Archivos
            </Button>
            <input
              id="image-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Preview de imágenes */}
          {(imageFiles.length > 0 || existingImages.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {existingImages.map((img, index) => (
                <div key={`existing-${index}`} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Principal
                    </div>
                  )}
                </div>
              ))}
              {imageFiles.map((file, index) => (
                <div key={`new-${index}`} className="relative aspect-square rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 w-6 h-6"
                    onClick={() => removeImage(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  {index === 0 && existingImages.length === 0 && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Principal
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {imageFiles.length + existingImages.length < 3 && (
            <p className="text-sm text-destructive">
              Necesitas al menos 3 imágenes para publicar (tienes {imageFiles.length + existingImages.length})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video Tour (opcional) */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Video Tour (opcional)
            </Label>
            <Input
              type="url"
              value={formData.video_url}
              onChange={(e) => updateFormData({ video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground">
              Enlace de YouTube o Vimeo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
