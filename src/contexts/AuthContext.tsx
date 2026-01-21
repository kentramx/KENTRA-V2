import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { monitoring, setUser as setSentryUser, clearUser as clearSentryUser } from '@/lib/monitoring';

interface AuthError {
  message: string;
  code?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name: string, role?: 'buyer' | 'agent' | 'agency' | 'developer') => Promise<{ error: AuthError | null; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<{ error: AuthError | null }>;
  resendConfirmationEmail: (email: string, userName?: string) => Promise<{ error: AuthError | null }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ error: AuthError | null }>;
  isEmailVerified: () => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Track if we've completed initial session check to prevent race conditions
    let initialSessionChecked = false;
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only update state if component is still mounted
        if (!mounted) return;

        // For INITIAL_SESSION event, let getSession handle it to avoid race condition
        if (event === 'INITIAL_SESSION' && !initialSessionChecked) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Update Sentry user context
        if (session?.user) {
          setSentryUser({
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata?.name,
          });
        } else {
          clearSentryUser();
        }
      }
    );

    // THEN check for existing session (single source of truth for initial load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      initialSessionChecked = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Set Sentry user on initial load
      if (session?.user) {
        setSentryUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.name,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    // SECURITY: Verify email is confirmed before allowing access
    const user = data.user;
    if (user && !user.email_confirmed_at && !user.confirmed_at) {
      // Sign out the user since email isn't confirmed
      await supabase.auth.signOut();
      return {
        error: {
          message: 'Por favor verifica tu correo electrónico antes de iniciar sesión.',
          code: 'email_not_confirmed'
        }
      };
    }

    navigate('/');
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    
    return { error };
  };

  const signUp = async (email: string, password: string, name: string, role: 'buyer' | 'agent' | 'agency' | 'developer' = 'buyer') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name,
          role: role
        }
      }
    });
    
    if (!error && data.user) {
      // Enviar email de verificación custom usando Resend
      try {
        const response = await supabase.functions.invoke('send-auth-verification-email', {
          body: {
            userId: data.user.id,
            email: email,
            userName: name
          }
        });
        
        if (response.error) {
          console.error('Error sending verification email:', response.error);
        }
      } catch (emailError) {
        console.error('Exception sending verification email:', emailError);
      }
      
      // Retornar que necesita verificación
      return { error: null, needsVerification: true };
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      // Intentar cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut();
      
      // Si hay error de sesión no encontrada, ignorarlo porque igual queremos limpiar el estado local
      if (error && !error.message.includes('session') && !error.message.includes('Session')) {
        monitoring.error('Error al cerrar sesión', { context: 'AuthContext', error });
      }
    } catch (error) {
      monitoring.captureException(error as Error, { context: 'AuthContext', function: 'signOut' });
    } finally {
      // Clear Sentry user context on logout
      clearSentryUser();
      // Siempre limpiar el estado local y redirigir, incluso si falla el signOut
      setSession(null);
      setUser(null);
      navigate('/auth');
    }
  };

  /**
   * Envía email de recuperación usando sistema custom con Resend
   */
  const resetPassword = async (email: string) => {
    try {
      const response = await supabase.functions.invoke('send-auth-recovery-email', {
        body: { email }
      });

      if (response.error) {
        return { error: { message: response.error.message || 'Error al enviar email de recuperación' } };
      }

      return { error: null };
    } catch (error: unknown) {
      return { error: { message: error instanceof Error ? error.message : 'Error inesperado' } };
    }
  };

  /**
   * Actualiza contraseña usando sesión activa (modo legacy)
   */
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    return { error };
  };

  /**
   * Actualiza contraseña usando token de recuperación custom
   */
  const resetPasswordWithToken = async (token: string, newPassword: string) => {
    try {
      const response = await supabase.functions.invoke('verify-auth-token', {
        body: {
          type: 'recovery',
          token,
          newPassword
        }
      });

      if (response.error) {
        return { error: { message: response.error.message || 'Error al actualizar contraseña' } };
      }

      const data = response.data as { success?: boolean; error?: string } | null;
      if (!data?.success) {
        return { error: { message: data?.error || 'Error desconocido' } };
      }

      return { error: null };
    } catch (error: unknown) {
      return { error: { message: error instanceof Error ? error.message : 'Error inesperado' } };
    }
  };

  /**
   * Reenvía email de verificación usando sistema custom con Resend
   */
  const resendConfirmationEmail = async (email: string, userName?: string) => {
    try {
      // Primero obtener el usuario ID del email
      // This call intentionally fails but triggers email lookup
      await supabase.auth.signInWithPassword({
        email,
        password: 'dummy_password_to_get_user_info_' + Date.now(), // Esto fallará pero nos da info
      });

      // Intentamos enviar de todas formas - la Edge Function buscará el usuario
      const response = await supabase.functions.invoke('send-auth-verification-email', {
        body: {
          userId: 'unknown', // La Edge Function manejará esto
          email,
          userName: userName || ''
        }
      });

      if (response.error) {
        // Si el error es de autenticación, ignorar y continuar
        // Error logged via monitoring if needed
      }

      return { error: null };
    } catch (error: unknown) {
      return { error: { message: error instanceof Error ? error.message : 'Error inesperado' } };
    }
  };

  /**
   * Verifica código de email usando sistema custom
   */
  const verifyEmailCode = async (email: string, code: string) => {
    try {
      const response = await supabase.functions.invoke('verify-auth-token', {
        body: {
          type: 'verification',
          code,
          email
        }
      });

      if (response.error) {
        return { error: { message: response.error.message || 'Error al verificar código' } };
      }

      const data = response.data as { success?: boolean; error?: string } | null;
      if (!data?.success) {
        return { error: { message: data?.error || 'Código inválido o expirado' } };
      }

      // Refrescar sesión para obtener el estado actualizado
      await supabase.auth.refreshSession();

      return { error: null };
    } catch (error: unknown) {
      return { error: { message: error instanceof Error ? error.message : 'Error inesperado' } };
    }
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null || user?.confirmed_at !== null;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      signIn, 
      signInWithGoogle, 
      signUp, 
      signOut, 
      resetPassword, 
      updatePassword, 
      resetPasswordWithToken,
      resendConfirmationEmail, 
      verifyEmailCode,
      isEmailVerified, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
