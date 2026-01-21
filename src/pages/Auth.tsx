import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Home, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTracking } from '@/hooks/useTracking';
import kentraLogo from '@/assets/kentra-logo.png';

// Password validation: min 12 chars, at least 1 uppercase, 1 lowercase, 1 number
const passwordSchema = z.string()
  .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  .regex(/[A-Z]/, { message: 'La contraseña debe contener al menos una mayúscula' })
  .regex(/[a-z]/, { message: 'La contraseña debe contener al menos una minúscula' })
  .regex(/[0-9]/, { message: 'La contraseña debe contener al menos un número' });

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Correo electrónico inválido' }),
  password: z.string().min(1, { message: 'Ingresa tu contraseña' }), // Login allows any password
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'Correo electrónico inválido' }),
});

const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const signupSchema = z.object({
  name: z.string().trim().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).max(100),
  email: z.string().trim().email({ message: 'Correo electrónico inválido' }),
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.enum(['buyer', 'agent', 'agency', 'developer'], {
    required_error: 'Debes seleccionar un tipo de cuenta',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const Auth = () => {
  const { 
    signIn, 
    signInWithGoogle, 
    signUp, 
    resetPassword, 
    updatePassword, 
    resetPasswordWithToken,
    resendConfirmationEmail, 
    verifyEmailCode,
    user 
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'auth' | 'forgot' | 'reset' | 'verify'>('auth');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>('');
  const [unverifiedUserName, setUnverifiedUserName] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const { trackEvent } = useTracking();

  const redirect = searchParams.get('redirect');
  const pendingRole = searchParams.get('role');
  const mode = searchParams.get('mode');
  const recoveryToken = searchParams.get('token');

  // Detectar si venimos del email de reseteo
  useEffect(() => {
    if (mode === 'reset' && recoveryToken) {
      setView('reset');
    } else if (mode === 'reset') {
      setView('reset');
    }
  }, [mode, recoveryToken]);

  // Redirect after successful auth (pero NO si estamos en modo reset)
  useEffect(() => {
    // Si estamos en modo reset, NO redirigir - el usuario necesita cambiar su contraseña primero
    if (mode === 'reset') {
      return;
    }
    
    if (user && redirect) {
      navigate(redirect);
    } else if (user && view !== 'reset' && view !== 'verify') {
      navigate('/');
    }
  }, [user, redirect, navigate, mode, view]);

  if (user && view !== 'reset' && view !== 'verify') {
    return null;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = loginSchema.safeParse({ email, password });
      
      if (!result.success) {
        toast({
          title: 'Error de validación',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await signIn(email, password);

      if (error) {
        let errorMessage = 'Error al iniciar sesión';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Correo o contraseña incorrectos';
        } else if (error.message.includes('Email not confirmed')) {
          setUnverifiedEmail(email);
          setView('verify');
          return;
        }
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        const roleText = pendingRole === 'buyer' ? 'particular' : pendingRole === 'agent' ? 'agente' : 'agencia';
        toast({
          title: 'Bienvenido',
          description: pendingRole ? `Continuemos con tu publicación como ${roleText}` : 'Has iniciado sesión correctamente',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const role = formData.get('role') as string;

    try {
      const result = signupSchema.safeParse({ name, email, password, confirmPassword, role });
      
      if (!result.success) {
        toast({
          title: 'Error de validación',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error, needsVerification } = await signUp(email, password, name, role as 'buyer' | 'agent' | 'agency' | 'developer');

      if (error) {
        let errorMessage = 'Error al crear la cuenta';
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este correo ya está registrado';
        }
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else if (needsVerification) {
        // Track Facebook Pixel: CompleteRegistration
        trackEvent('CompleteRegistration', {
          content_name: role === 'agent' ? 'Agente' : role === 'agency' ? 'Agencia' : role === 'developer' ? 'Desarrolladora' : 'Comprador',
          content_category: 'signup',
        });

        // Mostrar pantalla de verificación de código
        setUnverifiedEmail(email);
        setUnverifiedUserName(name);
        setView('verify');
        
        toast({
          title: '¡Cuenta creada!',
          description: 'Te hemos enviado un código de verificación a tu correo',
        });
      } else {
        const roleText = role === 'agent' ? 'agente inmobiliario' : role === 'agency' ? 'agencia inmobiliaria' : role === 'developer' ? 'desarrolladora inmobiliaria' : 'comprador';
        toast({
          title: '¡Cuenta creada!',
          description: `${roleText} - Tu cuenta ha sido creada exitosamente`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      
      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudo iniciar sesión con Google',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
      const result = resetPasswordSchema.safeParse({ email });
      
      if (!result.success) {
        toast({
          title: 'Error de validación',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await resetPassword(email);

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudo enviar el correo de recuperación',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Correo enviado',
          description: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña',
        });
        setView('auth');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    try {
      const result = newPasswordSchema.safeParse({ password, confirmPassword });
      
      if (!result.success) {
        toast({
          title: 'Error de validación',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      let error;
      
      // Si tenemos token de recuperación, usar el sistema custom
      if (recoveryToken) {
        const result = await resetPasswordWithToken(recoveryToken, password);
        error = result.error;
      } else {
        // Usar el método legacy de Supabase si hay sesión activa
        const result = await updatePassword(password);
        error = result.error;
      }

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'No se pudo actualizar la contraseña',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Contraseña actualizada',
          description: 'Tu contraseña ha sido cambiada exitosamente',
        });
        navigate('/auth');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!verificationCode || verificationCode.length !== 6) {
        toast({
          title: 'Error',
          description: 'Ingresa el código de 6 dígitos',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await verifyEmailCode(unverifiedEmail, verificationCode);

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Código inválido o expirado',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Email verificado!',
          description: 'Tu cuenta ha sido verificada correctamente',
        });
        // Redirigir al inicio
        navigate('/');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unverifiedEmail) return;
    
    setLoading(true);
    try {
      const { error } = await resendConfirmationEmail(unverifiedEmail, unverifiedUserName);

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudo reenviar el código de verificación',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Código reenviado',
          description: 'Revisa tu bandeja de entrada para obtener el nuevo código',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-24 md:pb-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, hsl(82 42% 32% / 0.1) 0%, transparent 50%),
                          radial-gradient(circle at 75% 75%, hsl(32 38% 45% / 0.08) 0%, transparent 50%)`
      }} />
      
      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <Home className="mr-2 h-4 w-4" />
            Volver al inicio
          </Button>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-6">
              <img src={kentraLogo} alt="Kentra" className="h-12" />
            </div>
            <CardDescription className="text-center text-base">
              {view === 'forgot' && 'Recupera tu contraseña'}
              {view === 'reset' && 'Crea una nueva contraseña'}
              {view === 'verify' && 'Verifica tu correo electrónico'}
              {view === 'auth' && 'Tu plataforma de bienes raíces en México'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === 'forgot' && (
              <div>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>
                </form>
                <Button
                  variant="link"
                  className="w-full mt-4"
                  onClick={() => setView('auth')}
                  disabled={loading}
                >
                  Volver al inicio de sesión
                </Button>
              </div>
            )}

            {view === 'reset' && (
              <div>
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ingresa tu nueva contraseña
                  </p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
                    <Input
                      id="confirm-new-password"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Actualizando...' : 'Actualizar contraseña'}
                  </Button>
                </form>
              </div>
            )}

            {view === 'verify' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Verifica tu correo
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Enviamos un código de 6 dígitos a
                  </p>
                  <p className="font-medium text-foreground">
                    {unverifiedEmail}
                  </p>
                </div>
                
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification-code" className="sr-only">
                      Código de verificación
                    </Label>
                    <Input
                      id="verification-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      disabled={loading}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || verificationCode.length !== 6}
                  >
                    {loading ? 'Verificando...' : 'Verificar código'}
                  </Button>
                </form>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    ¿No recibiste el código?
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleResendConfirmation}
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Reenviar código'}
                  </Button>
                </div>

                <Button
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setView('auth');
                    setUnverifiedEmail('');
                    setVerificationCode('');
                  }}
                  disabled={loading}
                >
                  Volver al inicio de sesión
                </Button>
              </div>
            )}

            {view === 'auth' && (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">Registrarse</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      {loading ? 'Conectando...' : 'Continuar con Google'}
                    </Button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          O continúa con correo
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Correo electrónico</Label>
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        placeholder="tu@email.com"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-xs px-0"
                      onClick={() => setView('forgot')}
                      disabled={loading}
                    >
                      ¿Olvidaste tu contraseña?
                    </Button>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      {loading ? 'Conectando...' : 'Continuar con Google'}
                    </Button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          O regístrate con correo
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSignup} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nombre completo</Label>
                      <Input
                        id="signup-name"
                        name="name"
                        type="text"
                        placeholder="Juan Pérez"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Correo electrónico</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="tu@email.com"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Tipo de cuenta</Label>
                      <RadioGroup defaultValue="buyer" name="role" required disabled={loading}>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="buyer" id="role-buyer" />
                          <Label htmlFor="role-buyer" className="flex-1 cursor-pointer">
                            <div className="font-medium">Comprador</div>
                            <div className="text-sm text-muted-foreground">
                              Busco propiedades para comprar o rentar
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="agent" id="role-agent" />
                          <Label htmlFor="role-agent" className="flex-1 cursor-pointer">
                            <div className="font-medium">Agente Inmobiliario</div>
                            <div className="text-sm text-muted-foreground">
                              Quiero publicar y vender propiedades
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="agency" id="role-agency" />
                          <Label htmlFor="role-agency" className="flex-1 cursor-pointer">
                            <div className="font-medium">Agencia Inmobiliaria</div>
                            <div className="text-sm text-muted-foreground">
                              Gestiono una agencia con múltiples agentes
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="developer" id="role-developer" />
                          <Label htmlFor="role-developer" className="flex-1 cursor-pointer">
                            <div className="font-medium">Desarrolladora Inmobiliaria</div>
                            <div className="text-sm text-muted-foreground">
                              Desarrollo y comercializo proyectos inmobiliarios
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Contraseña</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">Confirmar contraseña</Label>
                      <Input
                        id="signup-confirm"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
