import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wraps the route tree and replays a short fade-in whenever the path changes.
 * Avoid `transform` on this wrapper so descendants with `position: fixed` (e.g. Navbar)
 * stay pinned to the viewport. Animation is gated by `prefers-reduced-motion` in CSS.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.classList.remove('route-enter');
    void node.offsetWidth;
    node.classList.add('route-enter');
  }, [pathname]);

  return (
    <div ref={ref} className="route-enter">
      {children}
    </div>
  );
}
