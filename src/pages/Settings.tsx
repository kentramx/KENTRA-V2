import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Bell,
  Shield,
  Settings as SettingsIcon,
  ArrowLeft,
  Mail,
  Lock,
  Trash2,
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
  FormDescription,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import RoleChangeDialog from "@/components/RoleChangeDialog";

const accountSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  phone: z.string().max(20).optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type AccountFormData = z.infer<typeof accountSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const Settings = () => {
  const { user, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { userRole } = useUserRole();

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
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
      accountForm.reset({
        name: profileData.name || "",
        phone: profileData.phone || "",
      });

      setEmailNotifications(profileData.email_notifications ?? true);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("No se pudo cargar la información del perfil");
    } finally {
      setLoading(false);
    }
  };

  const onAccountSubmit = async (data: AccountFormData) => {
    setSavingAccount(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: data.name,
          phone: data.phone || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Perfil actualizado correctamente");
      fetchUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("No se pudo actualizar tu perfil");
    } finally {
      setSavingAccount(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setSavingPassword(true);
    try {
      const { error } = await updatePassword(data.newPassword);

      if (error) throw error;

      toast.success("Contraseña actualizada correctamente");
      passwordForm.reset();
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("No se pudo actualizar la contraseña");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");

      if (permission === "granted") {
        toast.success("Notificaciones habilitadas correctamente");
      } else {
        toast.error("Se denegó el permiso de notificaciones");
      }
    }
  };

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    setEmailNotifications(enabled);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ email_notifications: enabled })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success(enabled ? "Notificaciones por email activadas" : "Notificaciones por email desactivadas");
    } catch (error) {
      console.error("Error updating email notifications:", error);
      toast.error("No se pudo actualizar las preferencias");
      setEmailNotifications(!enabled);
    }
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    
    setDeletingAccount(true);
    const loadingToast = toast.loading("Eliminando cuenta...");

    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');

      if (error) throw error;

      toast.dismiss(loadingToast);
      toast.success("Tu cuenta ha sido eliminada exitosamente");
      
      // Sign out and redirect to home
      await signOut();
      navigate('/');
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.dismiss(loadingToast);
      toast.error("Error al eliminar la cuenta. Por favor intenta de nuevo.");
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <SettingsIcon className="h-8 w-8 text-primary" />
              Configuración
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestiona tu cuenta y preferencias de la aplicación
            </p>
          </div>

          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="account" className="flex items-center gap-1 px-2 py-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Cuenta</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-1 px-2 py-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notificaciones</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1 px-2 py-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Seguridad</span>
              </TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>
                    Actualiza tu información de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...accountForm}>
                    <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                      <FormField
                        control={accountForm.control}
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
                        control={accountForm.control}
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
                        <div className="flex items-center gap-2 mt-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Input value={user?.email} disabled />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          El correo electrónico no se puede modificar
                        </p>
                      </div>

                      {/* Role Change Section */}
                      {userRole && ['agent', 'agency', 'buyer'].includes(userRole) && (
                        <>
                          <Separator />
                          <div>
                            <Label>Tipo de Cuenta</Label>
                            <div className="flex items-center justify-between mt-2 gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {userRole === 'agent' && 'Agente Independiente'}
                                  {userRole === 'agency' && 'Inmobiliaria'}
                                  {userRole === 'buyer' && 'Particular'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {userRole === 'agent' && 'Opera como agente individual'}
                                  {userRole === 'agency' && 'Gestiona equipo de agentes'}
                                  {userRole === 'buyer' && '¿Tu negocio ha crecido? Cambia tu tipo de cuenta'}
                                </p>
                              </div>
                              <RoleChangeDialog 
                                currentRole={userRole as 'buyer' | 'agent' | 'agency'} 
                                onRoleChanged={fetchUserData}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <Button type="submit" disabled={savingAccount}>
                        {savingAccount ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar Cambios"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferencias de Notificaciones</CardTitle>
                  <CardDescription>
                    Controla cómo y cuándo recibes notificaciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe notificaciones instantáneas en tu dispositivo
                      </p>
                    </div>
                    {notificationsEnabled ? (
                      <Button variant="outline" disabled>
                        Habilitadas
                      </Button>
                    ) : (
                      <Button
                        variant="default"
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
                        Recibe actualizaciones por correo electrónico
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={handleToggleEmailNotifications}
                    />
                  </div>

                  <Separator />

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Configuración Avanzada</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Personaliza en detalle qué tipo de notificaciones quieres recibir
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/notificaciones")}
                    >
                      Configuración Avanzada
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cambiar Contraseña</CardTitle>
                  <CardDescription>
                    Actualiza tu contraseña para mantener tu cuenta segura
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nueva Contraseña</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormDescription>
                              Mínimo 8 caracteres
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar Contraseña</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={savingPassword}>
                        {savingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Actualizando...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Actualizar Contraseña
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                  <CardDescription>
                    Acciones irreversibles que afectan tu cuenta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Cuenta
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Esto eliminará permanentemente tu
                          cuenta y removerá todos tus datos de nuestros servidores, incluyendo
                          todas tus propiedades, favoritos y configuraciones.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={handleDeleteAccount}
                        >
                          Sí, eliminar mi cuenta
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Settings;
