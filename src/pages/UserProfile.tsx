import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { WhatsAppConfigSection } from "@/components/WhatsAppConfigSection";
import {
  Loader2,
  User,
  Search,
  Bell,
  Trash2,
  MapPin,
  Settings,
  Mail,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  phone: z.string().max(20).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface SavedSearch {
  id: string;
  name: string;
  filters: any;
  created_at: string;
}

const UserProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchUserData();
    checkNotificationPermission();
  }, [user]);

  const checkNotificationPermission = () => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  };

  const fetchUserData = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      form.reset({
        name: profileData.name || "",
        phone: profileData.phone || "",
      });

      const { data: searchesData, error: searchesError } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (searchesError) throw searchesError;
      setSavedSearches(searchesData || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: data.name,
          phone: data.phone || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Perfil actualizado",
        description: "Tu información ha sido actualizada exitosamente",
      });

      fetchUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar tu perfil",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", searchId);

      if (error) throw error;

      toast({
        title: "Búsqueda eliminada",
        description: "La búsqueda ha sido eliminada de tus guardados",
      });

      fetchUserData();
    } catch (error) {
      console.error("Error deleting search:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la búsqueda",
        variant: "destructive",
      });
    }
  };

  const handleApplySearch = (filters: any) => {
    const searchParams = new URLSearchParams();
    
    if (filters.listingType) searchParams.set("listingType", filters.listingType);
    if (filters.type) searchParams.set("type", filters.type);
    if (filters.state) searchParams.set("state", filters.state);
    if (filters.municipality) searchParams.set("municipality", filters.municipality);
    if (filters.minPrice) searchParams.set("minPrice", filters.minPrice);
    if (filters.maxPrice) searchParams.set("maxPrice", filters.maxPrice);
    if (filters.bedrooms) searchParams.set("bedrooms", filters.bedrooms);
    if (filters.bathrooms) searchParams.set("bathrooms", filters.bathrooms);

    navigate(`/buscar?${searchParams.toString()}`);
  };

  const handleRequestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      
      if (permission === "granted") {
        toast({
          title: "Notificaciones habilitadas",
          description: "Ahora recibirás notificaciones sobre nuevas propiedades",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Mi Perfil', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <h1 className="text-3xl font-bold mb-8">Mi Perfil</h1>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Información Personal
            </TabsTrigger>
            <TabsTrigger value="searches">
              <Search className="mr-2 h-4 w-4" />
              Búsquedas Guardadas
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Settings className="mr-2 h-4 w-4" />
              Avanzado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu nombre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono (opcional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+52 123 456 7890" 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div>
                      <Label>Correo Electrónico</Label>
                      <Input value={user?.email} disabled className="mt-2" />
                      <p className="text-sm text-muted-foreground mt-1">
                        El correo electrónico no se puede modificar
                      </p>
                    </div>

                    <div>
                      <Label>Rol</Label>
                      <div className="mt-2 flex items-center gap-3">
                        <Badge>{profile?.role === "agent" ? "Agente" : "Comprador"}</Badge>
                        {profile?.role !== "agent" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/setup-demo")}
                          >
                            Convertirse en Agente
                          </Button>
                        )}
                      </div>
                      {profile?.role !== "agent" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Conviértete en agente inmobiliario y crea 20 propiedades de demostración
                        </p>
                      )}
                    </div>

                    <Button type="submit">Guardar Cambios</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="mt-6">
              <WhatsAppConfigSection 
                userId={user?.id || ""} 
                initialData={{
                  whatsapp_number: profile?.whatsapp_number,
                  whatsapp_enabled: profile?.whatsapp_enabled,
                  whatsapp_business_hours: profile?.whatsapp_business_hours
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="searches" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Búsquedas Guardadas ({savedSearches.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {savedSearches.length > 0 ? (
                  <div className="space-y-4">
                    {savedSearches.map((search) => (
                      <Card key={search.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold mb-2">{search.name}</h3>
                              <div className="flex flex-wrap gap-2">
                                {search.filters.listingType && (
                                  <Badge variant="outline">
                                    {search.filters.listingType === "venta" ? "Venta" : "Renta"}
                                  </Badge>
                                )}
                                {search.filters.type && (
                                  <Badge variant="outline">{search.filters.type}</Badge>
                                )}
                                {search.filters.state && (
                                  <Badge variant="outline">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {search.filters.state}
                                  </Badge>
                                )}
                                {search.filters.minPrice && search.filters.maxPrice && (
                                  <Badge variant="outline">
                                    ${search.filters.minPrice.toLocaleString()} - 
                                    ${search.filters.maxPrice.toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApplySearch(search.filters)}
                              >
                                Aplicar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSearch(search.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No tienes búsquedas guardadas
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Notificaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe notificaciones sobre nuevas propiedades
                    </p>
                  </div>
                  {notificationsEnabled ? (
                    <Badge variant="secondary">Habilitadas</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestNotificationPermission}
                    >
                      Habilitar
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe emails sobre propiedades que coincidan con tus búsquedas
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Configuración Avanzada</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Personaliza qué tipo de notificaciones quieres recibir y cómo las recibes
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate("/notificaciones")}
                  >
                    Configuración Avanzada
                  </Button>
                </div>

                <Separator />

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Preferencias de Newsletter</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Gestiona tus preferencias de newsletter desde el formulario de suscripción
                    en la página principal.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                    Ir al Newsletter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración Avanzada</CardTitle>
                <CardDescription>
                  Opciones adicionales para personalizar tu experiencia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Notificaciones Personalizadas</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Configura en detalle qué notificaciones quieres recibir por email y push
                      </p>
                      <Button onClick={() => navigate("/notificaciones")}>
                        Configurar Notificaciones
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Newsletter</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Suscríbete al newsletter para recibir las mejores ofertas y novedades
                      </p>
                      <Button variant="outline" onClick={() => navigate("/")}>
                        Gestionar Suscripción
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Búsquedas Guardadas</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Gestiona tus búsquedas guardadas y recibe alertas cuando haya nuevas propiedades
                      </p>
                      <Button variant="outline" onClick={() => navigate("/perfil?tab=searches")}>
                        Ver Búsquedas
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserProfile;