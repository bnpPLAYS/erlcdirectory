import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useInViewOnce } from '@/hooks/useInViewOnce';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import homeHeroProfile from '@/assets/home-features/public-profile.png';
import homeFeatureProfileEditor from '@/assets/home-features/profile-editor.png';
import homeFeatureCreatePost from '@/assets/home-features/create-post.png';
import homeFeatureConnections from '@/assets/home-features/connections.png';
import homeFeatureServerDetail from '@/assets/home-features/server-detail.png';
import SiteFooter from '@/components/layout/SiteFooter';
import { cn } from '@/lib/utils';
import { profileEditorPath } from '@/lib/profilePath';

const PRODUCT_SCREENSHOTS: {
  title: string;
  description: string;
  image: string;
  alt: string;
}[] = [
  {
    title: 'Profile',
    description: 'Edit your listing, banner, and verified roles in one place.',
    image: homeFeatureProfileEditor,
    alt: 'Profile editor on erlc.directory',
  },
  {
    title: 'Posts',
    description: 'Hiring, looking for work, announcements, and discussion.',
    image: homeFeatureCreatePost,
    alt: 'Create post on erlc.directory',
  },
  {
    title: 'Network',
    description: 'Connections and requests — find people through the directory.',
    image: homeFeatureConnections,
    alt: 'Connections on erlc.directory',
  },
  {
    title: 'Servers',
    description: 'Community pages with join links, members who work there, and reviews.',
    image: homeFeatureServerDetail,
    alt: 'Server directory page on erlc.directory',
  },
];

function HomeSectionIntro() {
  const { ref, visible } = useInViewOnce<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn('max-w-2xl mb-12 md:mb-14 home-reveal-row', visible && 'home-reveal-visible')}
    >
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-2">How it works</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Screens from the live site — no mockups.
      </p>
    </div>
  );
}

function HomeFeatureRow({
  item,
  i,
}: {
  item: (typeof PRODUCT_SCREENSHOTS)[number];
  i: number;
}) {
  const { ref, visible } = useInViewOnce<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'grid gap-8 md:gap-10 md:grid-cols-2 md:items-center home-reveal-row',
        visible && 'home-reveal-visible',
      )}
    >
      <div className={cn('py-0.5', i % 2 === 1 && 'md:order-2')}>
        <div className="home-image-pop rounded-xl border border-white/[0.08] bg-zinc-950/40 p-1.5">
          <div className="rounded-lg overflow-hidden">
            <img
              src={item.image}
              alt={item.alt}
              width={1156}
              height={810}
              className="block w-full h-auto"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
      <div className={cn('space-y-2', i % 2 === 1 && 'md:order-1')}>
        <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
          {String(i + 1).padStart(2, '0')}
        </p>
        <h3 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">{item.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
      </div>
    </div>
  );
}

function HomeCtaBar({ signedIn }: { signedIn: boolean }) {
  const { ref, visible } = useInViewOnce<HTMLElement>();
  return (
    <section
      ref={ref}
      className={cn(
        'py-12 border-t border-white/[0.06] home-reveal-row',
        visible && 'home-reveal-visible',
      )}
    >
      <div className="container mx-auto px-4 text-center md:text-left">
        <Link to={signedIn ? '/browse' : '/auth'}>
          <Button size="lg" className="rounded-md px-8 font-medium gap-2">
            {signedIn ? 'Browse members' : 'Get started'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

const Index = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ profiles: 0, servers: 0 });

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      const [profileCount, serverCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('servers').select('id', { count: 'exact', head: true }),
      ]);

      if (cancelled) return;
      setStats({
        profiles: profileCount.count || 0,
        servers: serverCount.count || 0,
      });
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative border-b border-white/[0.06] home-hero-aurora overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center py-14 md:py-20 lg:py-24">
            <div className="text-center lg:text-left order-2 lg:order-1 space-y-8 home-hero-stagger">
              <div className="home-hero-item inline-flex items-center gap-3">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-10 w-10 object-contain"
                  width={40}
                  height={40}
                  decoding="async"
                  fetchPriority="high"
                  aria-hidden
                />
                <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
                  erlc.directory
                </span>
              </div>

              <div className="home-hero-item space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-foreground leading-[1.06]">
                  Staff, resumes, and connections for ER:LC communities.
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  Hire staff, post resumes and portfolios, connect with friends.
                </p>
              </div>

              <div className="home-hero-item flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                {user ? (
                  <>
                    <Link to={profile?.id ? profileEditorPath(profile) : '/browse'}>
                      <Button size="lg" className="gap-2 px-6 h-11 rounded-md w-full sm:w-auto font-medium">
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        Edit profile
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/browse">
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 h-11 rounded-md w-full sm:w-auto border-white/15 bg-transparent font-medium"
                      >
                        <Users className="h-4 w-4" />
                        Browse members
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/auth" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="gap-2 px-6 h-11 rounded-md w-full bg-discord hover:bg-discord/90 text-white font-medium"
                      >
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        Continue with Discord
                      </Button>
                    </Link>
                    <Link to="/browse" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 h-11 rounded-md w-full border-white/15 bg-transparent font-medium"
                      >
                        Browse members
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {(stats.profiles > 0 || stats.servers > 0) && (
                <p className="home-hero-item text-sm text-muted-foreground">
                  <span className="tabular-nums text-foreground font-medium">{stats.profiles}</span> members ·{' '}
                  <span className="tabular-nums text-foreground font-medium">{stats.servers}</span> servers
                </p>
              )}
            </div>

            <div className="order-1 lg:order-2 home-hero-item home-hero-side-preview">
              <div className="home-image-pop rounded-xl border border-white/[0.08] bg-zinc-950/40 p-1.5">
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={homeHeroProfile}
                    alt="Public profile on erlc.directory"
                    width={1156}
                    height={810}
                    className="block w-full h-auto"
                    loading="eager"
                    decoding="async"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <HomeSectionIntro />

          <div className="flex flex-col gap-14 md:gap-20">
            {PRODUCT_SCREENSHOTS.map((item, i) => (
              <HomeFeatureRow key={item.title} item={item} i={i} />
            ))}
          </div>
        </div>
      </section>

      <HomeCtaBar signedIn={!!user} />

      <SiteFooter />
    </div>
  );
};

export default Index;
