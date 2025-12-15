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
  signUp: (email: string, password: string, name: string, role?: 'buyer' | 'agent' | 'agency') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>;
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

  const signUp = async (email: string, password: string, name: string, role: 'buyer' | 'agent' | 'agency' = 'buyer') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
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
    
    if (!error) {
      navigate('/');
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

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    return { error };
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    
    return { error };
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null || user?.confirmed_at !== null;
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signInWithGoogle, signUp, signOut, resetPassword, updatePassword, resendConfirmationEmail, isEmailVerified, loading }}>
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
