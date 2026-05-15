import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { profilePath } from '@/lib/profilePath';
import { COMMUNITY_DISCORD_URL } from '@/lib/siteCommunityDiscord';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

const SiteFooter = ({ className }: { className?: string }) => {
  const { user, profile } = useAuth();

  return (
    <footer
      className={cn(
        'border-t border-white/10 bg-black text-zinc-400 pt-14 pb-10 mt-auto',
        className,
      )}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <img
                src={logo}
                alt=""
                className="logo-mark w-8 h-8 object-contain"
                width={32}
                height={32}
                loading="lazy"
                decoding="async"
                aria-hidden
              />
              <span className="font-semibold text-white text-lg tracking-tight">ERLC Directory</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              ER:LC staff and servers in one place — profiles, posts, invites.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-white font-medium">System status</span>
              <span className="text-zinc-500">Operational</span>
            </div>
            <p className="text-[11px] text-zinc-600 pt-2 leading-relaxed">
              © {new Date().getFullYear()} ERLC Directory. All rights reserved.{' '}
              <span className="text-zinc-500 tabular-nums">v{APP_VERSION}</span>
            </p>
          </div>

          {/* General */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 tracking-tight">General</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/servers" className="hover:text-white transition-colors">
                  Join a server
                </Link>
              </li>
              <li>
                {user && profile ? (
                  <Link to={profilePath(profile)} className="hover:text-white transition-colors">
                    My profile
                  </Link>
                ) : (
                  <Link to="/auth" className="hover:text-white transition-colors">
                    Sign in
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* Directory */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 tracking-tight">Directory</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/browse" className="hover:text-white transition-colors">
                  Member directory
                </Link>
              </li>
              <li>
                <Link to="/posts" className="hover:text-white transition-colors">
                  Posts
                </Link>
              </li>
              <li>
                <Link to="/connections" className="hover:text-white transition-colors">
                  Connections
                </Link>
              </li>
              {user && (
                <li>
                  <Link to="/messages" className="hover:text-white transition-colors">
                    Messages
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 tracking-tight">Resources</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={COMMUNITY_DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  Community & support
                  <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                </a>
              </li>
              <li>
                <Link to="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
