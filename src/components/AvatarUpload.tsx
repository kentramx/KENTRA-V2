import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, User } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName: string;
  onUploadComplete: (url: string) => void;
}

export const AvatarUpload = ({ userId, currentAvatarUrl, userName, onUploadComplete }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

      setUploading(true);

      // Crear nombre único para el archivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Subir imagen a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(filePath, file, {
          upsert: true,
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

      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido actualizada exitosamente",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la foto de perfil",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
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
          JPG, PNG o WEBP. Máximo 2MB.
        </p>
      </div>
    </div>
  );
};
