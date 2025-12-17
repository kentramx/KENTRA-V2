import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, RefreshCw, MessageCircle, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const PaymentCanceled = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [planType, setPlanType] = useState<string>('agente');

  useEffect(() => {
    // Detectar tipo de plan del parámetro o del usuario
    const type = searchParams.get('type');
    if (type) {
      setPlanType(type);
    }
  }, [searchParams]);

  const getPricingRoute = () => {
    switch (planType) {
      case 'inmobiliaria':
        return '/pricing-inmobiliaria';
      case 'desarrolladora':
        return '/pricing-desarrolladora';
      default:
        return '/pricing-agente';
    }
  };

  const handleRetry = () => {
    navigate(getPricingRoute());
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleContact = () => {
    // Abrir WhatsApp de soporte
    window.open('https://wa.me/5215512345678?text=Hola,%20tuve%20un%20problema%20con%20mi%20pago', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto">
          {/* Cancel Animation */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-100 mb-6 animate-in zoom-in duration-300">
              <XCircle className="h-14 w-14 text-orange-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pago no completado
            </h1>
            <p className="text-lg text-muted-foreground">
              Tu proceso de pago fue cancelado o no se pudo completar
            </p>
          </div>

          {/* Info Card */}
          <Card className="mb-8 border-2 border-orange-200 shadow-lg animate-in fade-in slide-in-from-bottom duration-500 delay-200">
            <CardHeader>
              <CardTitle className="text-xl">No te preocupes</CardTitle>
              <CardDescription>
                No se realizó ningún cargo a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Puedes intentar nuevamente cuando lo desees. Si experimentaste algún problema durante el proceso de pago, 
                no dudes en contactarnos para ayudarte.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Posibles razones:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Cancelaste el proceso de pago</li>
                  <li>• Tu banco rechazó la transacción</li>
                  <li>• Fondos insuficientes</li>
                  <li>• Problema de conexión</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom duration-500 delay-300">
            <Button 
              size="lg" 
              className="w-full h-12"
              onClick={handleRetry}
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Intentar de nuevo
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                size="lg"
                className="h-12"
                onClick={handleGoHome}
              >
                <Home className="h-5 w-5 mr-2" />
                Ir al inicio
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="h-12"
                onClick={handleContact}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Contactar soporte
              </Button>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-8">
            Si necesitas ayuda, escríbenos a soporte@kentra.mx
          </p>
        </div>
      </main>
    </div>
  );
};

export default PaymentCanceled;
