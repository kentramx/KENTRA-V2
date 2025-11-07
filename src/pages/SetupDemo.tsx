import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

const SetupDemo = () => {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const setupDemoData = async () => {
    try {
      setLoading(true);
      setProgress("Iniciando configuración...");

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión primero",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setProgress("Actualizando tu perfil a agente inmobiliario...");
      
      const { error } = await supabase.functions.invoke('setup-demo-properties');

      if (error) {
        throw error;
      }

      setProgress("¡Configuración completada!");
      setCompleted(true);
      
      toast({
        title: "¡Éxito!",
        description: "Se han creado 20 propiedades de ejemplo. Ahora eres un agente inmobiliario verificado.",
      });

      setTimeout(() => {
        navigate("/agent/dashboard");
      }, 2000);
    } catch (error) {
      console.error('Error setting up demo:', error);
      toast({
        title: "Error",
        description: error.message || "Hubo un error al configurar las propiedades de demostración",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Configuración de Demostración</CardTitle>
              <CardDescription>
                Regístrate como agente inmobiliario y crea 20 propiedades de ejemplo con imágenes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!completed ? (
                <>
                  <div className="space-y-4 text-muted-foreground">
                    <p>Esta herramienta te ayudará a:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Actualizar tu perfil a agente inmobiliario verificado</li>
                      <li>Crear 20 propiedades de ejemplo con datos realistas</li>
                      <li>Generar imágenes profesionales para cada propiedad</li>
                      <li>Configurar tu dashboard de agente con datos de demostración</li>
                    </ul>
                    <p className="text-sm italic mt-4">
                      Nota: Este proceso puede tardar varios minutos ya que genera imágenes únicas para cada propiedad.
                    </p>
                  </div>

                  {loading && (
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">{progress}</span>
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={setupDemoData} 
                    disabled={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      "Comenzar Configuración"
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-6 py-8">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-2xl font-semibold mb-2">¡Configuración Completada!</h3>
                    <p className="text-muted-foreground">
                      Se han creado 20 propiedades de ejemplo exitosamente.
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate("/agent/dashboard")}
                    size="lg"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Ir al Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Requisitos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Debes haber iniciado sesión en la plataforma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>El proceso generará imágenes usando IA (puede tardar varios minutos)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Las propiedades se crearán automáticamente en tu cuenta</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SetupDemo;
