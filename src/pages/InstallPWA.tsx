import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Download, 
  Wifi, 
  Zap, 
  Bell,
  Home,
  Check,
  ArrowLeft
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capturar el evento de instalación
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Mostrar el prompt de instalación
    await deferredPrompt.prompt();

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuario aceptó instalar la PWA');
    }

    // Limpiar el prompt usado
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: Smartphone,
      title: 'Acceso Rápido',
      description: 'Ícono en tu pantalla de inicio como una app nativa',
    },
    {
      icon: Wifi,
      title: 'Funciona Offline',
      description: 'Accede a tus conversaciones incluso sin conexión',
    },
    {
      icon: Zap,
      title: 'Carga Instantánea',
      description: 'Abre la app al instante, más rápido que un sitio web',
    },
    {
      icon: Bell,
      title: 'Notificaciones Push',
      description: 'Recibe alertas de mensajes nuevos en tiempo real',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Button>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
              <Home className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Instala Kentra en tu dispositivo
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Convierte Kentra en una aplicación nativa en tu teléfono o tablet. 
              Disfruta de todas las ventajas de una app instalada.
            </p>
          </div>

          {/* Status Card */}
          {isInstalled ? (
            <Card className="mb-8 border-green-500/50 bg-green-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Check className="w-6 h-6 text-green-500" />
                  <CardTitle>¡Kentra ya está instalada!</CardTitle>
                </div>
                <CardDescription>
                  La aplicación está instalada en tu dispositivo. Puedes acceder desde tu pantalla de inicio.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Instalar Aplicación</CardTitle>
                <CardDescription>
                  {deferredPrompt 
                    ? 'Tu navegador soporta instalación automática. Haz clic en el botón para instalar.'
                    : 'Sigue las instrucciones según tu dispositivo para instalar Kentra.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstallClick}
                    size="lg"
                    className="w-full"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Kentra
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge>iOS / Safari</Badge>
                      </h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Toca el ícono de "Compartir" en la barra inferior</li>
                        <li>Desplázate y selecciona "Añadir a pantalla de inicio"</li>
                        <li>Toca "Agregar" en la esquina superior derecha</li>
                      </ol>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge>Android / Chrome</Badge>
                      </h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Toca el menú (tres puntos) en la esquina superior derecha</li>
                        <li>Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio"</li>
                        <li>Confirma tocando "Instalar"</li>
                      </ol>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Features Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Beneficios de instalar la app
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="mb-2">{feature.title}</CardTitle>
                          <CardDescription>{feature.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate('/')}
              variant="outline"
            >
              Continuar usando en el navegador
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;
