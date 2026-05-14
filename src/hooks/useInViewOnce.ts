import { useCallback, useEffect, useState } from 'react';

/** Fires once when the element intersects the viewport (for scroll-in animations). */
export function useInViewOnce<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element || visible) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(element);
    return () => io.disconnect();
  }, [element, visible]);

  return { ref, visible };
}
