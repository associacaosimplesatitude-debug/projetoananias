import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type AppRole = 'admin' | 'client' | 'tesoureiro' | 'secretario' | 'gerente_ebd' | 'financeiro' | 'representante' | 'autor' | 'gerente_royalties' | 'gerente_sorteio';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 12_000;

function withAuthTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
    }),
  ]);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const ROLE_PRIORITY: AppRole[] = ['admin', 'gerente_royalties', 'financeiro', 'gerente_ebd', 'gerente_sorteio', 'secretario', 'tesoureiro', 'representante', 'autor', 'client'];

    try {
      const { data, error } = await withAuthTimeout(
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId),
        'A consulta de permissão demorou mais que o esperado.'
      );

      if (error || !data || data.length === 0) {
        console.warn('Role não encontrada para usuário:', userId);
        setRole(null);
        return;
      }

      // If multiple roles, pick the highest priority one
      const roles = data.map(d => d.role as AppRole);
      const primaryRole = ROLE_PRIORITY.find(p => roles.includes(p)) || roles[0];
      setRole(primaryRole);
    } catch (error) {
      console.error('Erro ao carregar permissão do usuário:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const registerLoginActivity = async (userId: string) => {
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('ebd_clientes')
        .select('id, ultimo_login, email_superintendente')
        .eq('superintendente_user_id', userId)
        .maybeSingle();

      if (clienteError) {
        console.error('Error loading login activity:', clienteError);
        return;
      }

      if (!clienteData) return;

      const isFirstLogin = !clienteData.ultimo_login;

      const { error: loginUpdateError } = await supabase
        .from('ebd_clientes')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', clienteData.id);

      if (loginUpdateError) {
        console.error('Error updating login activity:', loginUpdateError);
      }

      if (isFirstLogin && clienteData.email_superintendente) {
        const { error: leadError } = await supabase
          .from('ebd_leads_reativacao')
          .update({ status_kanban: 'Logou' })
          .eq('email', clienteData.email_superintendente)
          .eq('created_via', 'landing_page_form')
          .eq('status_kanban', 'Cadastrou');

        if (leadError) {
          console.error('Error updating lead kanban status:', leadError);
        }
      }
    } catch (error) {
      console.error('Error registering login activity:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await withAuthTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      'A conexão demorou mais que o esperado. Tente novamente.'
    );

    // Login activity is secondary and must never delay or block authentication.
    if (!error && data.user) {
      void registerLoginActivity(data.user.id);
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    
    if (!error && data.user) {
      await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
        });
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    // Always clear local state and redirect, even if signOut fails
    setSession(null);
    setUser(null);
    setRole(null);
    navigate('/ebd-login');
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
