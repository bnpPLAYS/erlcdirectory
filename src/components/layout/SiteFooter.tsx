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

  const quickRail: FooterLink[] = [
    { label: 'Browse staff', to: '/browse' },
    { label: 'Servers', to: '/servers' },
    { label: 'Posts', to: '/posts' },
    ...(user ? [{ label: 'Messages', to: '/messages' }] : [{ label: 'Sign in', to: '/auth' }]),
    { label: 'Docs', to: '/docs' },
    {
      label: 'Discord',
      href: COMMUNITY_DISCORD_URL,
      external: true,
    },
  ];

  return (
    <footer
      className={cn(
        'relative mt-auto overflow-hidden border-t border-white/[0.08] bg-black text-zinc-400',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, transparent, black 28%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 28%, black 88%, transparent)',
        }}
      />

      <div
        className="pointer-events-none absolute -right-[12%] bottom-0 select-none text-[clamp(5rem,18vw,11rem)] font-bold leading-none tracking-tighter text-white/[0.03]"
        aria-hidden
      >
        erlc
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="flex flex-col gap-10 py-14 lg:flex-row lg:items-start lg:justify-between lg:py-16">
          <div className="max-w-sm space-y-6">
            <Link to="/" className="group inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] transition-colors group-hover:border-white/25 group-hover:bg-white/[0.07]">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-7 w-7 object-contain"
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              </span>
              <span className="text-left">
                <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                  erlc.directory
                </span>
                <span className="block text-lg font-semibold tracking-tight text-white">ERLC Directory</span>
              </span>
            </Link>

            <p className="text-sm leading-relaxed text-zinc-500">
              ER:LC staff and servers in one place — verified profiles, hiring posts, and live Discord invites.
            </p>

            <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
              </span>
              <span className="font-medium text-emerald-100/90">All systems operational</span>
            </div>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
            {FOOTER_TILES.map((tile) => {
              const Icon = tile.icon;
              const links = resolveTileLinks(tile, !!user, profileHref);
              if (links.length === 0) return null;

              return (
                <div
                  key={tile.id}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/16 hover:bg-white/[0.04]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-zinc-400 transition-colors group-hover:text-zinc-200">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {tile.label}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link.label}>
                        <FooterAnchor link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-2 border-y border-white/[0.06] py-4 sm:justify-start"
          aria-label="Quick links"
        >
          {quickRail.map((link, i) => (
            <span key={link.label} className="inline-flex items-center gap-2">
              {i > 0 ? (
                <span className="hidden text-zinc-700 sm:inline" aria-hidden>
                  /
                </span>
              ) : null}
              <FooterAnchor
                link={link}
                className="rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-white/12 hover:bg-white/[0.04] hover:text-white"
              />
            </span>
          ))}
        </nav>

        <div className="flex flex-col gap-4 py-6 text-[11px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            © {new Date().getFullYear()} ERLC Directory
            <span className="mx-2 text-zinc-700" aria-hidden>
              ·
            </span>
            <span className="tabular-nums text-zinc-500">v{APP_VERSION}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
              className="inline-flex items-center gap-1 transition-colors hover:text-zinc-300"
            >
              Discord
              <ArrowUpRight className="h-3 w-3 opacity-70" aria-hidden />
            </a>
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
  const base = cn('text-sm text-zinc-400 transition-colors hover:text-white', className);

  if (link.href) {
    return (
      <a
        href={link.href}
        target={link.external ? '_blank' : undefined}
        rel={link.external ? 'noopener noreferrer' : undefined}
        className={cn(base, 'inline-flex items-center gap-1')}
      >
        {link.label}
        {link.external ? <ArrowUpRight className="h-3 w-3 opacity-50" aria-hidden /> : null}
      </a>
    );
  }

  if (link.to) {
    return (
      <Link to={link.to} className={base}>
        {link.label}
      </Link>
    );
  }

  return null;
}

export default SiteFooter;
