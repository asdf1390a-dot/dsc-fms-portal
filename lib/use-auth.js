import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data?.session?.user || null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe(); };
  }, []);

  return {
    user,
    loading,
    isAuthed: !!user,
    employeeId: user?.user_metadata?.employee_id || null,
    fullName: user?.user_metadata?.full_name || user?.email || null,
    role: user?.user_metadata?.role || null,
    signOut: () => supabase.auth.signOut(),
  };
}
