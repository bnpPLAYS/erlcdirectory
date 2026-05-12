import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wraps the route tree and replays a short fade-up entrance whenever the path changes.
 * Animation is gated by `prefers-reduced-motion` in CSS (no JS work for that case).
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
