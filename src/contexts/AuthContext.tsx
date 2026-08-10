/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import {
  AdminPermissionLevel,
  AdminSection,
  AdminSectionPermission,
  hasSectionPermission,
} from '../lib/adminPermissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  adminPermissions: AdminSectionPermission[];
  isAdmin: boolean;
  canAccessAdmin: boolean;
  hasAdminPermission: (section: AdminSection, level?: AdminPermissionLevel) => boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  sendMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  completeRequiredPasswordChange: (newPassword: string) => Promise<{ error: Error | AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminSectionPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data;
  };

  const fetchAdminPermissions = async (userId: string): Promise<AdminSectionPermission[]> => {
    const { data, error } = await supabase
      .from('admin_section_permissions')
      .select('*')
      .eq('profile_id', userId);

    if (error) {
      console.warn('Could not load admin section permissions:', error.message);
      return [];
    }

    return (data ?? []) as AdminSectionPermission[];
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(session);
      if (session?.user) {
        const [profileData, permissionsData] = await Promise.all([
          fetchProfile(session.user.id),
          fetchAdminPermissions(session.user.id),
        ]);
        if (!mounted) return;
        setUser(session.user);
        setProfile(profileData);
        setAdminPermissions(permissionsData);
      } else {
        setUser(null);
        setProfile(null);
        setAdminPermissions([]);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!mounted) return;
        setLoading(true);
        setSession(session);
        if (session?.user) {
          const [profileData, permissionsData] = await Promise.all([
            fetchProfile(session.user.id),
            fetchAdminPermissions(session.user.id),
          ]);
          if (!mounted) return;
          setUser(session.user);
          setProfile(profileData);
          setAdminPermissions(permissionsData);
        } else {
          setUser(null);
          setProfile(null);
          setAdminPermissions([]);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/my-lodge`,
      },
    });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const completeRequiredPasswordChange = async (newPassword: string) => {
    if (!user?.id) {
      return { error: new Error('No active user session found.') };
    }

    const { error } = await supabase.functions.invoke('change-required-password', {
      body: { password: newPassword },
    });
    if (error) {
      const errorResponse = (error as { context?: unknown }).context;
      if (errorResponse instanceof Response) {
        const errorBody = await errorResponse.clone().json().catch(() => null) as { error?: unknown } | null;
        if (typeof errorBody?.error === 'string') {
          return { error: new Error(errorBody.error) };
        }
      }
      return { error };
    }

    setProfile((current) => current ? { ...current, force_password_change: false } : current);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.is_admin ?? false;
  const canAccessAdmin = isAdmin || adminPermissions.some(
    (permission) => permission.can_read || permission.can_write || permission.can_approve
  );
  const hasAdminPermission = (section: AdminSection, level: AdminPermissionLevel = 'read') =>
    hasSectionPermission(isAdmin, adminPermissions, section, level);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        adminPermissions,
        isAdmin,
        canAccessAdmin,
        hasAdminPermission,
        loading,
        signIn,
        signUp,
        sendMagicLink,
        sendPasswordReset,
        updatePassword,
        completeRequiredPasswordChange,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
