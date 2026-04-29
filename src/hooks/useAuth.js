import React from 'react';
import { supabase, isEmailAllowed } from '../lib/supabase.js';

const { useState, useEffect } = React;

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      handleSession(data?.session);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      handleSession(sess);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  function handleSession(sess) {
    if (!sess) { setSession(null); setAuthError(null); return; }
    const email = sess?.user?.email;
    if (!isEmailAllowed(email)) {
      // Email no autorizado → cerrar sesión inmediatamente
      setAuthError(`El email ${email} no está autorizado para entrar a este dashboard.`);
      supabase.auth.signOut();
      setSession(null);
      return;
    }
    setSession(sess);
    setAuthError(null);
  }

  const signInWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error('[auth] signIn', error);
      setAuthError(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return { session, loading, authError, signInWithGoogle, signOut, user: session?.user };
}
