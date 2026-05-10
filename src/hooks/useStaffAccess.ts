import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';

/** Site owner (Pixelnovaa) or `user_roles.admin` — same as staff panel access. */
export function useStaffAccess() {
  const { user, profile } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      setIsStaff(false);
      return;
    }

    // Only clear staff when a *different* account signed in — never flash false→true on re-runs
    // for the same user (e.g. profile hydrate, route change) while user_roles is in flight.
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== user.id) {
      setIsStaff(false);
    }
    prevUserIdRef.current = user.id;

    if (isSiteOwnerDiscordUsername(profile?.discord_username ?? null)) {
      setIsStaff(true);
      return;
    }

    let cancelled = false;
    void supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsStaff(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile?.discord_username]);

  return { isStaff };
}
