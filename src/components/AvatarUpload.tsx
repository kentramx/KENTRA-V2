import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, User } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useMonitoring } from "@/lib/monitoring";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName: string;
  onUploadComplete: (url: string) => void;
}

export const AvatarUpload = ({ userId, currentAvatarUrl, userName, onUploadComplete }: AvatarUploadProps) => {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No se pudo obtener el contexto del canvas");
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("No se pudo crear el blob de la imagen"));
        }
      }, "image/jpeg", 0.95);
    });
  };

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validar tipo de archivo
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Por favor selecciona una imagen válida",
          variant: "destructive",
        });
        return;
      }

      // Validar tamaño (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen no puede ser mayor a 2MB",
          variant: "destructive",
        });
        return;
      }

      // Validar dimensiones mínimas (200x200px)
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      if (img.width < 200 || img.height < 200) {
        URL.revokeObjectURL(imageUrl);
        toast({
          title: "Error",
          description: "La imagen debe tener al menos 200x200 píxeles",
          variant: "destructive",
        });
        return;
      }

      // Abrir dialog de crop
      setImageToCrop(imageUrl);
      setCropDialogOpen(true);
    } catch (error) {
      logError("Error al cargar imagen", {
        component: "AvatarUpload",
        userId,
        error,
      });
      captureException(error as Error, {
        component: "AvatarUpload",
        action: "handleFileSelect",
        userId,
      });
      toast({
        title: "Error",
        description: "No se pudo cargar la imagen",
        variant: "destructive",
      });
    }
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      setUploading(true);
      setCropDialogOpen(false);

      // Crear imagen recortada
      const croppedBlob = await createCroppedImage(imageToCrop, croppedAreaPixels);

      // Crear nombre único para el archivo
      const fileName = `${userId}-${Math.random().toString(36).substring(2)}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Subir imagen a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(filePath, croppedBlob, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("property-images")
        .getPublicUrl(filePath);

      // Actualizar perfil con nueva URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onUploadComplete(publicUrl);

      // Limpiar
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
      setCroppedAreaPixels(null);

      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido actualizada exitosamente",
      });
    } catch (error) {
      logError("Error uploading avatar", {
        component: "AvatarUpload",
        userId,
        error,
      });
      captureException(error as Error, {
        component: "AvatarUpload",
        action: "uploadAvatar",
        userId,
      });
      toast({
        title: "Error",
        description: "No se pudo subir la foto de perfil",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
    setCropDialogOpen(false);
    setCroppedAreaPixels(null);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <Label className="text-sm font-medium">Foto de Perfil</Label>
        <Avatar className="h-32 w-32">
          <AvatarImage src={previewUrl || undefined} alt={userName} />
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex flex-col items-center gap-2">
          <input
            type="file"
            id="avatar-upload"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Cambiar Foto
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            JPG, PNG o WEBP. Mínimo 200x200px, máximo 2MB.
          </p>
        </div>
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[400px] bg-muted">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="zoom" className="text-sm">
              Zoom
            </Label>
            <input
              id="zoom"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCropCancel}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCropConfirm}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
