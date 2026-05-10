import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/hooks/useAuth';
import { profileEditorPath, profilePath } from '@/lib/profilePath';
import {
  shouldOfferTutorial,
  markTutorialCompleted,
  TUTORIAL_RESUME_EDITOR,
} from '@/lib/firstLoginTutorialStorage';

const POPOVER_CLASS = 'driverjs-erlc';

function navDismissedSessionKey(profileId: string): string {
  return `erlc-dir-tutorial-nav-dismissed:${profileId}`;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isProfileEditorRoute(pathname: string, profile: { id: string; discord_username?: string | null }): boolean {
  return pathname === profilePath(profile);
}

/**
 * Guided first-session tour: navbar shortcuts, then profile editor (tabs, banner, customize, experience).
 */
export function FirstLoginTutorial() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const navTourStartedRef = useRef(false);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const startEditorTour = useCallback(
    (prof: NonNullable<typeof profile>) => {
      destroyDriver();
      let drv: ReturnType<typeof driver>;

      const animate = !prefersReducedMotion();

      const afterTab = (tab: 'general' | 'customize' | 'experience', then: () => void) => {
        window.dispatchEvent(new CustomEvent('erlc-tutorial-set-tab', { detail: { tab } }));
        window.setTimeout(() => {
          drv.refresh();
          then();
        }, animate ? 320 : 0);
      };

      const steps: DriveStep[] = [
        {
          element: '#tutorial-editor-tabs',
          popover: {
            title: 'Profile editor sections',
            description:
              'General — bio, location, skills, and Discord notification preferences. Customize — banner, theme, and accent. Experience — your ER:LC and community roles.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '#tutorial-editor-hero',
          popover: {
            title: 'Banner & display name',
            description:
              'Your banner and name show at the top of your public profile. Upload a wide image under Customize, or sync from Discord if you have Nitro.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          popover: {
            title: 'Customize your look',
            description:
              'Next we’ll open the Customize tab so you can set colors, presets, and banner upload — this is where the “zoom” spotlight moves with you.',
            side: 'over',
            align: 'center',
            onNextClick: () => {
              afterTab('customize', () => drv.moveNext());
            },
          },
        },
        {
          element: '#tutorial-banner-upload',
          popover: {
            title: 'Banner upload',
            description:
              'Drop an image or click to upload — we crop to a wide 21:9 banner. You can also paste a URL or use Sync from Discord.',
            side: 'top',
            align: 'center',
          },
        },
        {
          popover: {
            title: 'Add experience',
            description:
              'Now we’ll switch to Experience — add servers and roles, then send a verification link to a server admin when you’re ready.',
            side: 'over',
            align: 'center',
            onNextClick: () => {
              afterTab('experience', () => drv.moveNext());
            },
          },
        },
        {
          element: '#tutorial-add-experience-btn',
          popover: {
            title: 'New role',
            description:
              'Use Add experience to link a Discord server and your time there. Verifiers set your official title when they approve — you can copy the verification link to share in staff channels.',
            side: 'left',
            align: 'start',
            doneBtnText: 'Done',
          },
        },
      ];

      drv = driver({
        showProgress: true,
        animate,
        smoothScroll: true,
        stagePadding: 14,
        stageRadius: 16,
        overlayOpacity: 0.85,
        overlayColor: '#030308',
        popoverClass: POPOVER_CLASS,
        allowClose: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        progressText: '{{current}} of {{total}}',
        disableActiveInteraction: false,
        onDestroyed: () => {
          driverRef.current = null;
          markTutorialCompleted(prof.id);
        },
        steps,
      });

      driverRef.current = drv;
      drv.drive();
    },
    [destroyDriver],
  );

  const startNavTour = useCallback(
    (prof: NonNullable<typeof profile>) => {
      destroyDriver();
      let drv: ReturnType<typeof driver>;
      const animate = !prefersReducedMotion();

      const steps: DriveStep[] = [
        {
          popover: {
            title: 'Welcome to erlc.directory',
            description:
              'A quick tour will show how to customize your profile and add verified experience. You can close anytime with ✕ — we won’t show this again once you finish.',
            side: 'over',
            align: 'center',
          },
        },
        {
          element: '#tutorial-main-nav',
          popover: {
            title: 'Find members & posts',
            description:
              'Browse the directory, servers, and posts from here. When you’re signed in, the + button opens Add experience (on small screens, open the menu ☰ first — Add experience is inside).',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '#tutorial-nav-account-trigger',
          popover: {
            title: 'Your account',
            description:
              'Open this menu for My profile, Edit profile, Messages, and Connections. Click Next and we’ll open Edit profile to continue the tour.',
            side: 'left',
            align: 'start',
            onNextClick: () => {
              try {
                sessionStorage.setItem(TUTORIAL_RESUME_EDITOR, '1');
              } catch {
                /* ignore */
              }
              navigate(profileEditorPath(prof));
              drv.destroy();
            },
          },
        },
      ];

      drv = driver({
        showProgress: true,
        animate,
        smoothScroll: true,
        stagePadding: 12,
        stageRadius: 14,
        overlayOpacity: 0.85,
        overlayColor: '#030308',
        popoverClass: POPOVER_CLASS,
        allowClose: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Next',
        progressText: '{{current}} of {{total}}',
        onDestroyed: () => {
          driverRef.current = null;
          try {
            if (sessionStorage.getItem(TUTORIAL_RESUME_EDITOR) !== '1') {
              sessionStorage.setItem(navDismissedSessionKey(prof.id), '1');
            }
          } catch {
            /* ignore */
          }
        },
        steps,
      });

      driverRef.current = drv;
      drv.drive();
    },
    [destroyDriver, navigate],
  );

  /** Resume editor segment after navigation from nav tour. */
  useEffect(() => {
    if (loading || !user || !profile) return;
    let resume = false;
    try {
      resume = sessionStorage.getItem(TUTORIAL_RESUME_EDITOR) === '1';
    } catch {
      return;
    }
    if (!resume) return;
    if (!isProfileEditorRoute(location.pathname, profile)) return;
    if (!location.search.includes('edit=1')) return;

    const t = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(TUTORIAL_RESUME_EDITOR);
      } catch {
        /* ignore */
      }
      startEditorTour(profile);
    }, 500);

    return () => clearTimeout(t);
  }, [loading, user, profile, location.pathname, location.search, startEditorTour]);

  /** Start nav tour for eligible new accounts (once per mount; dismiss blocks until new browser session). */
  useEffect(() => {
    if (loading || !user || !profile) return;
    if (!shouldOfferTutorial(profile)) return;
    if (navTourStartedRef.current) return;
    if (location.pathname === '/discord/callback' || location.pathname === '/auth') return;
    try {
      if (sessionStorage.getItem(TUTORIAL_RESUME_EDITOR) === '1') return;
      if (sessionStorage.getItem(navDismissedSessionKey(profile.id)) === '1') return;
    } catch {
      /* ignore */
    }

    const delay = 1000;
    const t = window.setTimeout(() => {
      if (driverRef.current?.isActive?.()) return;
      if (navTourStartedRef.current) return;
      navTourStartedRef.current = true;
      startNavTour(profile);
    }, delay);

    return () => clearTimeout(t);
  }, [
    loading,
    user?.id,
    profile?.id,
    profile?.created_at,
    profile?.terms_accepted_at,
    location.pathname,
    startNavTour,
  ]);

  useEffect(() => () => destroyDriver(), [destroyDriver]);

  return null;
}
