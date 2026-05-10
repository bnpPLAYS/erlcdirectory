import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll to top on SPA navigation before paint.
 * Temporarily overrides `scroll-behavior: smooth` on `<html>` so the jump is instant (avoids “old page” scroll glitch).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = prev;
  }, [pathname]);

  return null;
}
