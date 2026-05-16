import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Home,
  Shield,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { profilePath } from '@/lib/profilePath';
import { COMMUNITY_DISCORD_URL } from '@/lib/siteCommunityDiscord';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

type FooterLink = {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
  authOnly?: boolean;
};

type FooterTile = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: FooterLink[];
};

const FOOTER_TILES: FooterTile[] = [
  {
    id: 'start',
    label: 'Start',
    icon: Home,
    links: [
      { label: 'Home', to: '/' },
      { label: 'Join a server', to: '/servers' },
      { label: 'My profile', to: '__profile__' },
      { label: 'Sign in', to: '/auth' },
    ],
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: Users,
    links: [
      { label: 'Members', to: '/browse' },
      { label: 'Posts', to: '/posts' },
      { label: 'Connections', to: '/connections' },
      { label: 'Messages', to: '/messages', authOnly: true },
    ],
  },
  {
    id: 'trust',
    label: 'Trust',
    icon: Shield,
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    icon: BookOpen,
    links: [
      { label: 'Docs', to: '/docs' },
      {
        label: 'Community',
        href: COMMUNITY_DISCORD_URL,
        external: true,
      },
    ],
  },
];

function resolveTileLinks(tile: FooterTile, signedIn: boolean, profileHref: string | null): FooterLink[] {
  return tile.links
    .filter((link) => {
      if (link.authOnly && !signedIn) return false;
      if (link.to === '__profile__') return signedIn && !!profileHref;
      if (link.to === '/auth' && signedIn) return false;
      return true;
    })
    .map((link) => {
      if (link.to === '__profile__' && profileHref) {
        return { ...link, to: profileHref, label: 'My profile' };
      }
      return link;
    });
}

const SiteFooter = ({ className }: { className?: string }) => {
  const { user, profile } = useAuth();
  const profileHref = profile ? profilePath(profile) : null;

  return (
    <footer
      className={cn(
        'relative mt-auto border-t border-white/[0.08] bg-black text-zinc-400',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 90%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 90%, transparent)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:py-9">
        <div className="flex flex-col items-center gap-6 text-center sm:items-stretch sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Link to="/" className="group inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] transition-colors group-hover:border-white/20">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-5 w-5 object-contain"
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              </span>
              <span className="text-left">
                <span className="block text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                  erlc.directory
                </span>
                <span className="block text-sm font-semibold tracking-tight text-white">ERLC Directory</span>
              </span>
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-2.5 py-1 text-[10px] sm:shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="font-medium text-emerald-100/85">Operational</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-zinc-500 sm:max-w-md">
            ER:LC staff and servers — profiles, posts, and Discord invites.
          </p>

          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-5 border-y border-white/[0.06] py-5 sm:grid-cols-4 sm:gap-x-3">
            {FOOTER_TILES.map((tile) => {
              const Icon = tile.icon;
              const links = resolveTileLinks(tile, !!user, profileHref);
              if (links.length === 0) return null;

              return (
                <div key={tile.id} className="min-w-0 space-y-2">
                  <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <Icon className="h-3 w-3 text-zinc-500" strokeWidth={1.75} aria-hidden />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {tile.label}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {links.map((link) => (
                      <li key={link.label}>
                        <FooterAnchor link={link} className="text-xs" />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2 text-[10px] text-zinc-600 sm:flex-row sm:justify-between sm:gap-3">
            <p className="tabular-nums">
              © {new Date().getFullYear()} ERLC Directory · v{APP_VERSION}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link to="/privacy" className="transition-colors hover:text-zinc-300">
                Privacy
              </Link>
              <Link to="/terms" className="transition-colors hover:text-zinc-300">
                Terms
              </Link>
              <a
                href={COMMUNITY_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 transition-colors hover:text-zinc-300"
              >
                Discord
                <ArrowUpRight className="h-2.5 w-2.5 opacity-70" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

function FooterAnchor({
  link,
  className,
}: {
  link: FooterLink;
  className?: string;
}) {
  const base = cn('text-zinc-400 transition-colors hover:text-white', className);

  if (link.href) {
    return (
      <a
        href={link.href}
        target={link.external ? '_blank' : undefined}
        rel={link.external ? 'noopener noreferrer' : undefined}
        className={cn(base, 'inline-flex items-center justify-center gap-0.5 sm:justify-start')}
      >
        {link.label}
        {link.external ? <ArrowUpRight className="h-2.5 w-2.5 opacity-50" aria-hidden /> : null}
      </a>
    );
  }

  if (link.to) {
    return (
      <Link to={link.to} className={cn(base, 'block sm:inline')}>
        {link.label}
      </Link>
    );
  }

  return null;
}

export default SiteFooter;
