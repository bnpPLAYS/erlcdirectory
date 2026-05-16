import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** Staff panel access — `is_staff()` RPC only (fail closed). */
export function useStaffAccess() {
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      setIsStaff(false);
      return;
    }

    if (prevUserIdRef.current !== null && prevUserIdRef.current !== user.id) {
      setIsStaff(false);
    }
    prevUserIdRef.current = user.id;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('is_staff');
      if (!cancelled) {
        setIsStaff(!error && data === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isStaff };
}
