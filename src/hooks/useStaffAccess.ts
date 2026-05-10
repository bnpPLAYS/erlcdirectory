import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';

/** Site owner (Pixelnovaa) or `user_roles.admin` — same as staff panel access. */
export function useStaffAccess() {
  const { user, profile } = useAuth();
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsStaff(false);
      return;
    }
    if (isSiteOwnerDiscordUsername(profile?.discord_username ?? null)) {
      setIsStaff(true);
      return;
    }
    setIsStaff(false);
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
