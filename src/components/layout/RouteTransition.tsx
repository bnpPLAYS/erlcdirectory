import { type ReactNode } from 'react';

/**
 * Previously applied a full-page opacity fade on every pathname change, which felt like a
 * flash on each navigation. Routes render without a wrapper animation.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
