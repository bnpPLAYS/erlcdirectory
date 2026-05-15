import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { profileEditorPath, profilePath } from '@/lib/profilePath';
import { supabase } from '@/integrations/supabase/client';
import {
  clearExperienceNudgePending,
  dismissExperienceNudgePermanently,
  EXPERIENCE_NUDGE_UPDATE_EVENT,
  isExperienceNudgeDismissed,
  isExperienceNudgePending,
} from '@/lib/postTutorialExperienceNudge';

/**
 * Shown after the first-login profile tour when the member still has no experience rows.
 * Dismiss with ✕; primary action opens Edit profile on the Experience tab with Add experience.
 */
export function PostTutorialExperienceNudge() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((t) => t + 1), []);

  useEffect(() => {
    const fn = () => bump();
    window.addEventListener(EXPERIENCE_NUDGE_UPDATE_EVENT, fn);
    return () => window.removeEventListener(EXPERIENCE_NUDGE_UPDATE_EVENT, fn);
  }, [bump]);

  const show =
    !!profile &&
    !loading &&
    isExperienceNudgePending(profile.id) &&
    !isExperienceNudgeDismissed(profile.id);

  useEffect(() => {
    if (!show || !profile) return;
    const check = async () => {
      const { count, error } = await supabase
        .from('experiences')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profile.id);
      if (error) return;
      if ((count ?? 0) > 0) {
        clearExperienceNudgePending(profile.id);
        bump();
      }
    };
    void check();
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [show, profile, bump]);

  const onOwnProfileEditor =
    !!profile &&
    location.pathname === profilePath(profile) &&
    location.search.includes('edit=1');

  if (location.pathname === '/auth' || location.pathname.startsWith('/discord/callback')) {
    return null;
  }

  if (!show || !profile || onOwnProfileEditor) return null;

  const onAdd = () => {
    navigate(profileEditorPath(profile, { tab: 'experience', addExperience: true }));
  };

  const onDismiss = () => {
    dismissExperienceNudgePermanently(profile.id);
    bump();
  };

  return (
    <div
      className="pointer-events-none fixed bottom-20 left-4 right-4 z-[45] flex justify-center sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end"
      role="region"
      aria-label="Reminder to add your first experience"
    >
      <div className="pointer-events-auto relative w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950/95 p-4 pr-12 shadow-2xl shadow-black/50 backdrop-blur-md sm:max-w-md">
        <button
          type="button"
          className="absolute right-2 top-2 rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss reminder"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
            <Briefcase className="h-5 w-5 text-white/90" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-white">Add your first experience</p>
            <p className="text-xs leading-relaxed text-zinc-400">
              Profiles with roles and servers get more views and trust. Link a server you staff on, or add a direct
              role — it only takes a minute. You can close this anytime with the ✕.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" className="rounded-lg" onClick={onAdd}>
                Add experience
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg text-zinc-400 hover:text-white" onClick={onDismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
