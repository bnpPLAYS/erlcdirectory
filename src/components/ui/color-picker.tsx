import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max < 1e-6 ? 0 : d / max;
  return { h: h * 360, s: s * 100, v: max * 100 };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  v = clamp(v, 0, 100) / 100;
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 1) {
    rp = c;
    gp = x;
  } else if (hh < 2) {
    rp = x;
    gp = c;
  } else if (hh < 3) {
    gp = c;
    bp = x;
  } else if (hh < 4) {
    gp = x;
    bp = c;
  } else if (hh < 5) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const m = v - c;
  return {
    r: clamp(Math.round((rp + m) * 255), 0, 255),
    g: clamp(Math.round((gp + m) * 255), 0, 255),
    b: clamp(Math.round((bp + m) * 255), 0, 255),
  };
}

function normalizeFallback(hex: string | undefined, d: string): string {
  const t = (hex ?? d).trim();
  return parseHexRgb(t) ? (t.startsWith('#') ? t : `#${t}`) : d;
}

export type ColorPickerInputProps = {
  value: string;
  onChange: (hex: string) => void;
  /** When `value` is not #RRGGBB, this swatch / HSV seed is used */
  fallbackHex?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
};

export function ColorPickerInput({
  value,
  onChange,
  fallbackHex = '#888888',
  className,
  'aria-label': ariaLabel,
  disabled,
}: ColorPickerInputProps) {
  const fallback = normalizeFallback(fallbackHex, '#888888');
  const safeValue = parseHexRgb(value.trim()) ? value.trim().replace(/^#/, '#') : fallback;

  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => {
    const rgb = parseHexRgb(safeValue) ?? parseHexRgb(fallback)!;
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  useEffect(() => {
    const rgb = parseHexRgb(value.trim()) ?? parseHexRgb(fallback);
    if (rgb) {
      const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
      hsvRef.current = next;
      setHsv(next);
    }
  }, [value, fallback]);

  const pushHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      const h = clamp(next.h, 0, 360);
      const s = clamp(next.s, 0, 100);
      const v = clamp(next.v, 0, 100);
      const state = { h, s, v };
      hsvRef.current = state;
      setHsv(state);
      const { r, g, b } = hsvToRgb(h, s, v);
      onChange(rgbToHex(r, g, b));
    },
    [onChange],
  );

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const readSvFromClient = useCallback((clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp(clientX - r.left, 0, r.width);
    const y = clamp(clientY - r.top, 0, r.height);
    const s = (x / r.width) * 100;
    const v = ((r.height - y) / r.height) * 100;
    const cur = hsvRef.current;
    pushHsv({ h: cur.h, s, v });
  }, [pushHsv]);

  const readHueFromClient = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp(clientX - r.left, 0, r.width);
      const h = (x / r.width) * 360;
      const cur = hsvRef.current;
      pushHsv({ h, s: cur.s, v: cur.v });
    },
    [pushHsv],
  );

  const onSvPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    readSvFromClient(e.clientX, e.clientY);
  };
  const onSvPointerMove = (e: React.PointerEvent) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    readSvFromClient(e.clientX, e.clientY);
  };
  const onSvPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onHuePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    readHueFromClient(e.clientX);
  };
  const onHuePointerMove = (e: React.PointerEvent) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    readHueFromClient(e.clientX);
  };
  const onHuePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const displayRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const displayHex = rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? 'Choose color'}
          className={cn(
            'h-10 w-14 shrink-0 rounded-[6px] border border-border bg-muted/20 shadow-inner outline-none transition-opacity',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'cursor-pointer hover:opacity-95',
            className,
          )}
          style={{ backgroundColor: displayHex }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(calc(100vw-1.5rem),280px)] border-border bg-card p-3 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div
            ref={svRef}
            role="application"
            aria-label="Saturation and brightness"
            className="relative h-36 w-full touch-none rounded-md border border-border shadow-inner"
            style={{
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
              backgroundImage:
                'linear-gradient(to right, rgb(255,255,255), rgba(255,255,255,0)), linear-gradient(to top, rgb(0,0,0), rgba(0,0,0,0))',
            }}
            onPointerDown={onSvPointerDown}
            onPointerMove={onSvPointerMove}
            onPointerUp={onSvPointerUp}
            onPointerCancel={onSvPointerUp}
          >
            <span
              className="pointer-events-none absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
              }}
            />
          </div>

          <div
            ref={hueRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            aria-label="Hue"
            className="relative h-3 w-full touch-none rounded-full border border-border shadow-inner"
            style={{
              background:
                'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            }}
            onPointerDown={onHuePointerDown}
            onPointerMove={onHuePointerMove}
            onPointerUp={onHuePointerUp}
            onPointerCancel={onHuePointerUp}
          >
            <span
              className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/50"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
          </div>

          <p className="text-center font-mono text-xs text-muted-foreground">{displayHex}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
