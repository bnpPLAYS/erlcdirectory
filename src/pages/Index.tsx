import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  Pencil,
  Monitor,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import directoryPreview from '@/assets/directory-preview.png';
import homeFeaturePlaceholder from '@/assets/home-features/member-directory.png';
import SiteFooter from '@/components/layout/SiteFooter';
import { cn } from '@/lib/utils';
import { pageHeroEnter } from '@/lib/pageHero';

/**
 * Product tour: one image per row. Drop distinct PNGs into `src/assets/home-features/` and
 * point each `image` at its own import (browse, profile, servers, etc.).
 */
const PRODUCT_SCREENSHOTS: {
  title: string;
  description: string;
  image: string;
  alt: string;
}[] = [
  {
    title: 'Browse members',
    description:
      'Search the directory, open profiles, and compare experience before you reach out—without leaving one long spreadsheet of Discord tags.',
    image: homeFeaturePlaceholder,
    alt: 'Screenshot of the member browse experience on www.erlc.directory',
  },
  {
    title: 'Profiles that show the work',
    description:
      'Each listing can carry skills, bio, and verified server experience so owners see who someone is, not just a username.',
    image: homeFeaturePlaceholder,
    alt: 'Screenshot of a member profile with experience on www.erlc.directory',
  },
  {
    title: 'Server listings',
    description:
      'Communities publish their server with tags, member reach, and hiring status so staff can find a fit that matches what they want to do.',
    image: homeFeaturePlaceholder,
    alt: 'Screenshot of server listings on www.erlc.directory',
  },
];

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

      {/* Hero — split layout: copy left, product preview right (desktop) */}
      <section className="relative overflow-x-clip overflow-y-visible pb-2">
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 md:py-20 lg:py-28">
            <div className={`text-center lg:text-left order-2 lg:order-1 space-y-6 ${pageHeroEnter}`}>
              <div className="inline-flex items-center gap-2 mb-6 lg:mb-8">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-9 w-9 object-contain sm:h-10 sm:w-10"
                  width={40}
                  height={40}
                  decoding="async"
                  fetchPriority="high"
                  aria-hidden
                />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-6xl font-bold tracking-tight text-foreground leading-[1.08] mb-5">
                www.erlc.directory
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                Hire staff, post resumes and portfolios, connect with friends.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-10">
                {user ? (
                  <>
                    <Link to={profile?.id ? `/profile/${profile.id}?edit=1` : '/browse'}>
                      <Button size="lg" className="gap-2 px-7 h-12 rounded-full w-full sm:w-auto">
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                        Edit profile
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/browse">
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 h-12 rounded-full w-full sm:w-auto border-white/20 bg-transparent text-foreground hover:bg-white/[0.06]"
                      >
                        <Users className="h-4 w-4" />
                        Browse profiles
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/auth" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="gap-2 px-7 h-12 rounded-full w-full bg-discord hover:bg-discord/90 text-white"
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
                        className="gap-2 h-12 rounded-full w-full border-white/20 bg-transparent text-foreground hover:bg-white/[0.06]"
                      >
                        Browse profiles
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {(stats.profiles > 0 || stats.servers > 0) && (
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4 text-foreground/70" strokeWidth={1.75} aria-hidden />
                      <span>
                        <span className="font-semibold text-foreground tabular-nums">{stats.profiles}</span> members
                      </span>
                    </span>
                    <span className="hidden sm:inline w-px h-4 bg-white/15" aria-hidden />
                    <span className="inline-flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-foreground/70" strokeWidth={1.75} aria-hidden />
                      <span>
                        <span className="font-semibold text-foreground tabular-nums">{stats.servers}</span> servers
                      </span>
                    </span>
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 relative py-2">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/8 via-transparent to-transparent opacity-80 blur-2xl lg:block hidden"
              />
              <div className="relative home-image-pop rounded-2xl bg-white/[0.03] p-2">
                <div className="rounded-xl overflow-hidden">
                  <img
                    src={directoryPreview}
                    alt="Preview of the www.erlc.directory members page"
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

      <section className="py-12 md:py-20 border-t border-white/[0.06]">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mb-14 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-3">
              How it works on the site
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Straight from the app: browsing members, reading a profile, and scanning server listings.
            </p>
          </div>

          <div className="flex flex-col gap-16 md:gap-24">
            {PRODUCT_SCREENSHOTS.map((item, i) => (
              <div
                key={item.title}
                className="grid gap-8 md:gap-12 md:grid-cols-2 md:items-center"
              >
                <div className={cn('py-1', i % 2 === 1 && 'md:order-2')}>
                  <div className="home-image-pop rounded-2xl bg-white/[0.03] p-2">
                    <div className="rounded-xl overflow-hidden">
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
                <div className={cn('space-y-3', i % 2 === 1 && 'md:order-1')}>
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-secondary/20 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center lg:mx-0 lg:text-left lg:max-w-2xl">
            <h2 className="text-xl md:text-2xl font-bold mb-3 flex items-center justify-center lg:justify-start gap-2.5">
              <Rocket className="h-6 w-6 text-foreground/85 shrink-0" strokeWidth={1.5} aria-hidden />
              Ready to build your listing?
            </h2>
            <p className="text-muted-foreground mb-6">
              Add your Discord-linked profile and start finding the right server or staff fit.
            </p>
            <Link to={user ? '/browse' : '/auth'}>
              <Button size="lg" className="gap-2 rounded-full px-8">
                {user ? 'Browse Members' : 'Create Profile'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Index;
