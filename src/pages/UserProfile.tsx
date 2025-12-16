import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import { WhatsAppConfigSection } from "@/components/WhatsAppConfigSection";
import { TwoFactorAuth } from "@/components/TwoFactorAuth";
import { PhoneVerification } from "@/components/PhoneVerification";
import { IdentityVerification } from "@/components/IdentityVerification";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileCompleteness } from "@/components/ProfileCompleteness";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mexicoStates, mexicoMunicipalities } from "@/data/mexicoLocations";
import {
  Loader2,
  User,
  Search,
  Bell,
  Trash2,
  MapPin,
  Settings,
  Mail,
  Shield,
  BarChart3,
  DollarSign,
  FileText,
  ScrollText,
  Lock,
  TrendingUp,
  Plus,
  CheckCircle,
  AlertTriangle,
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
  bio: z.string().max(500, "La biografía no puede exceder 500 caracteres").optional(),
  state: z.string().optional(),
  city: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface SavedSearch {
  id: string;
  name: string;
  filters: any;
  created_at: string;
}

const UserProfile = () => {
  const { user, resendConfirmationEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin, adminRole, loading: adminLoading } = useAdminCheck();
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
  
  // Leer el parámetro tab de la URL
  const activeTab = searchParams.get('tab') || 'profile';

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      bio: "",
      state: "",
      city: "",
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
        bio: profileData.bio || "",
        state: profileData.state || "",
        city: profileData.city || "",
      });

      // Obtener el rol real desde user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .order("granted_at", { ascending: false })
        .limit(1)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }

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
          bio: data.bio || null,
          state: data.state || null,
          city: data.city || null,
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

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setResendingVerification(true);
    const { error } = await resendConfirmationEmail(user.email);
    
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el email de verificación",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email enviado",
        description: "Revisa tu bandeja de entrada para verificar tu email",
      });
    }
    setResendingVerification(false);
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

      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Mi Perfil', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Mi Perfil</h1>

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setSearchParams({ tab: value })}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-1">
            <TabsTrigger value="profile" className="flex items-center gap-1 px-2 py-2">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">Información Personal</span>
              <span className="md:hidden text-xs">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="verification" className="flex items-center gap-1 px-2 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden md:inline">Verificación</span>
              <span className="md:hidden text-xs">Verificar</span>
            </TabsTrigger>
            <TabsTrigger value="searches" className="flex items-center gap-1 px-2 py-2">
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Búsquedas Guardadas</span>
              <span className="md:hidden text-xs">Búsquedas</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1 px-2 py-2">
              <Bell className="h-4 w-4" />
              <span className="hidden md:inline">Notificaciones</span>
              <span className="md:hidden text-xs">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1 px-2 py-2">
              <Lock className="h-4 w-4" />
              <span className="hidden md:inline">Seguridad</span>
              <span className="md:hidden text-xs">Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1 px-2 py-2">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Avanzado</span>
              <span className="md:hidden text-xs">Más</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            {/* Profile Completeness Indicator */}
            <div className="mb-6">
              <ProfileCompleteness 
                profile={{
                  avatar_url: profile?.avatar_url,
                  bio: profile?.bio,
                  city: profile?.city,
                  state: profile?.state,
                  is_verified: profile?.is_verified,
                  phone_verified: profile?.phone_verified,
                  whatsapp_verified: profile?.whatsapp_verified,
                }}
                emailVerified={!!user?.email_confirmed_at}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>
                  Actualiza tu información de perfil que será visible públicamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex justify-center py-4">
                      <AvatarUpload
                        userId={user?.id || ""}
                        currentAvatarUrl={profile?.avatar_url}
                        userName={profile?.name || "Usuario"}
                        onUploadComplete={(url) => {
                          setProfile({ ...profile, avatar_url: url });
                        }}
                      />
                    </div>

                    <Separator />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu nombre completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Biografía (opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Cuéntanos sobre ti y tu experiencia en el sector inmobiliario..."
                              className="min-h-[100px] resize-none"
                              maxLength={500}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            {field.value?.length || 0}/500 caracteres
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado (opcional)</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue("city", "");
                              }}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mexicoStates.map((state) => (
                                  <SelectItem key={state} value={state}>
                                    {state}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ciudad/Municipio (opcional)</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                              disabled={!form.watch("state")}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una ciudad" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {form.watch("state") &&
                                  mexicoMunicipalities[form.watch("state") || ""]?.map((city) => (
                                    <SelectItem key={city} value={city}>
                                      {city}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono (opcional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+525512345678" 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground mt-1">
                            Incluye el código de país (ej: +52 para México). Haz clic en "Guardar Cambios" para poder verificarlo.
                          </p>
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

                    {/* Email Verification Status Card */}
                    <Separator />
                    {user?.email_confirmed_at || user?.confirmed_at ? (
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Email Verificado
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            Tu dirección de email está verificada correctamente.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-yellow-500 bg-yellow-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            Email No Verificado
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Debes verificar tu email para publicar propiedades.
                            Revisa tu bandeja de entrada y haz clic en el enlace de verificación.
                          </p>
                          <Button 
                            onClick={handleResendVerification} 
                            disabled={resendingVerification}
                            size="sm"
                          >
                            {resendingVerification ? "Enviando..." : "Reenviar Email de Verificación"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                    <Separator />

                    {/* Phone Verification Section */}
                    <PhoneVerification
                      phoneNumber={form.watch("phone") || profile?.phone || null}
                      phoneVerified={profile?.phone_verified || false}
                      onPhoneVerified={fetchUserData}
                    />
                    <Separator />

                    <div>
                      <Label>Rol</Label>
                      <div className="mt-2 flex items-center gap-3">
                        {userRole === 'super_admin' && (
                          <Badge className="bg-purple-600 hover:bg-purple-700">
                            <Shield className="w-3 h-3 mr-1" />
                            Super Admin
                          </Badge>
                        )}
                        {userRole === 'moderator' && (
                          <Badge className="bg-blue-600 hover:bg-blue-700">
                            <Shield className="w-3 h-3 mr-1" />
                            Moderador
                          </Badge>
                        )}
                        {userRole === 'admin' && (
                          <Badge className="bg-indigo-600 hover:bg-indigo-700">
                            <Shield className="w-3 h-3 mr-1" />
                            Administrador
                          </Badge>
                        )}
                        {userRole === 'agency' && (
                          <Badge variant="secondary">Inmobiliaria</Badge>
                        )}
                        {userRole === 'agent' && (
                          <Badge variant="secondary">Agente</Badge>
                        )}
                        {userRole === 'buyer' && (
                          <>
                            <Badge variant="outline">Comprador</Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/setup-demo")}
                            >
                              Convertirse en Agente
                            </Button>
                          </>
                        )}
                      </div>
                      
                      {/* Admin functionalities access */}
                      {(isSuperAdmin || isAdmin) && (
                        <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Funcionalidades Administrativas
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {/* Disponible para todos los admins */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/admin/dashboard")}
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Panel de Moderación
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/admin/notification-settings")}
                            >
                              <Bell className="w-4 h-4 mr-2" />
                              Notificaciones
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/admin/kyc")}
                            >
                              <User className="w-4 h-4 mr-2" />
                              Verificaciones KYC
                            </Button>
                            
                            {/* Exclusivo para super_admin */}
                            {isSuperAdmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/financiero")}
                                >
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Panel Financiero
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/kpis")}
                                >
                                  <BarChart3 className="w-4 h-4 mr-2" />
                                  KPIs de Negocio
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/roles")}
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Gestión de Roles
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/subscription-changes")}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Panel de Auditoría
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/role-audit")}
                                >
                                  <ScrollText className="w-4 h-4 mr-2" />
                                  Auditoría de Roles
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/marketing")}
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  Dashboard de Marketing
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/upsells")}
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Gestión de Upsells
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/admin/plans")}
                                >
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Gestión de Planes
                                </Button>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isSuperAdmin 
                              ? "Tienes acceso completo al sistema: moderación, finanzas, KPIs, gestión de usuarios, roles y auditoría."
                              : "Tienes acceso a funciones de moderación de contenido, soporte al cliente y notificaciones."}
                          </p>
                        </div>
                      )}
                      
                      {userRole === 'buyer' && (
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
                  whatsapp_business_hours: profile?.whatsapp_business_hours,
                  whatsapp_verified: profile?.whatsapp_verified,
                  whatsapp_verified_at: profile?.whatsapp_verified_at
                }}
                onDataRefresh={fetchUserData}
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

          <TabsContent value="verification" className="mt-6">
            <IdentityVerification />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <div className="space-y-6">
              <TwoFactorAuth 
                isAdminRole={isSuperAdmin || isAdmin}
                userRole={userRole}
              />
              
              {(isSuperAdmin || isAdmin) && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recomendación de seguridad:</strong> Como administrador de la plataforma,
                    se recomienda encarecidamente mantener 2FA habilitado para proteger datos sensibles
                    y funcionalidades administrativas críticas.
                  </AlertDescription>
                </Alert>
              )}
            </div>
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