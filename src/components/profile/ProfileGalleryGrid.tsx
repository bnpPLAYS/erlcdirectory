import { cn } from '@/lib/utils';

type Props = {
  urls: string[];
  className?: string;
};

/** Public gallery grid — images are not draggable. */
export function ProfileGalleryGrid({ urls, className }: Props) {
  if (urls.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-2 md:grid-cols-3', className)}>
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
        >
          <img
            src={u}
            alt=""
            draggable={false}
            className="no-image-drag h-40 w-full object-cover transition-opacity hover:opacity-90"
          />
        </a>
      ))}
    </div>
  );
}
