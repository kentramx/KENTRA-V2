import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { monitoring, setUser as setSentryUser, clearUser as clearSentryUser } from '@/lib/monitoring';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, role?: 'buyer' | 'agent' | 'agency' | 'developer') => Promise<{ error: any; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<{ error: any }>;
  resendConfirmationEmail: (email: string, userName?: string) => Promise<{ error: any }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ error: any }>;
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
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

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      navigate('/');
    }
    
    return { error };
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
    console.log('🔑 [resetPassword] Iniciando recuperación para:', email);
    console.log('🔑 [resetPassword] Timestamp:', new Date().toISOString());
    
    try {
      console.log('📤 [resetPassword] Invocando Edge Function: send-auth-recovery-email...');
      
      const response = await supabase.functions.invoke('send-auth-recovery-email', {
        body: { email }
      });
      
      console.log('📥 [resetPassword] Respuesta completa:', JSON.stringify(response, null, 2));
      console.log('📥 [resetPassword] response.data:', response.data);
      console.log('📥 [resetPassword] response.error:', response.error);
      
      if (response.error) {
        console.error('❌ [resetPassword] Error de Edge Function:', response.error);
        return { error: { message: response.error.message || 'Error al enviar email de recuperación' } };
      }
      
      console.log('✅ [resetPassword] Email enviado exitosamente via Edge Function');
      return { error: null };
    } catch (error: any) {
      console.error('❌ [resetPassword] Excepción capturada:', error);
      console.error('❌ [resetPassword] Error stack:', error.stack);
      return { error: { message: error.message || 'Error inesperado' } };
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
      
      const data = response.data;
      if (!data.success) {
        return { error: { message: data.error || 'Error desconocido' } };
      }
      
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Error inesperado' } };
    }
  };

  /**
   * Reenvía email de verificación usando sistema custom con Resend
   */
  const resendConfirmationEmail = async (email: string, userName?: string) => {
    try {
      // Primero obtener el usuario ID del email
      const { data: userData, error: userError } = await supabase.auth.signInWithPassword({
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
        console.log('Verification email response:', response);
      }
      
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Error inesperado' } };
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
      
      const data = response.data;
      if (!data.success) {
        return { error: { message: data.error || 'Código inválido o expirado' } };
      }
      
      // Refrescar sesión para obtener el estado actualizado
      await supabase.auth.refreshSession();
      
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Error inesperado' } };
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
