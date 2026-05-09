import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Users } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import ServerCard from '@/components/server/ServerCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import directoryPreview from '@/assets/directory-preview.png';

// Rotating taglines under the main hero description
const HEADLINES = [
  'Build your portfolio on erlc.directory',
  'Make connections on erlc.directory',
  'Find your next ER:LC role on erlc.directory',
  'Get verified experience on erlc.directory',
  'Hire trusted staff on erlc.directory',
  'Show your work on erlc.directory',
];

interface Profile {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
}

interface Server {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  member_count: number;
  staff_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_hiring: boolean;
  tags: string[];
}

const FEATURE_CARDS: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: '🛡️',
    title: 'Clear experience',
    desc: 'List roles, departments, and current positions in one place.',
  },
  {
    emoji: '⭐',
    title: 'Useful profiles',
    desc: 'Skills, history, and Discord details help owners make faster decisions.',
  },
  {
    emoji: '⚡',
    title: 'Direct contact',
    desc: 'Reach out to staff candidates and server teams from their profile.',
  },
];

const Index = () => {
  const { user, profile } = useAuth();
  const [featuredProfiles, setFeaturedProfiles] = useState<Profile[]>([]);
  const [topServers, setTopServers] = useState<Server[]>([]);
  const [stats, setStats] = useState({ profiles: 0, servers: 0 });
  const [headlineIndex, setHeadlineIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const last = Number(sessionStorage.getItem('homeHeadlineIdx') ?? '-1');
    let next = Math.floor(Math.random() * HEADLINES.length);
    if (HEADLINES.length > 1 && next === last) {
      next = (next + 1) % HEADLINES.length;
    }
    sessionStorage.setItem('homeHeadlineIdx', String(next));
    setHeadlineIndex(next);

    const fetchFeaturedData = async () => {
      const [profilesRes, serversRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, discord_avatar, bio, is_verified, is_featured, rating, review_count, skills')
          .eq('is_featured', true)
          .limit(3),
        supabase
          .from('servers')
          .select('id, name, description, icon, member_count, staff_count, is_verified, is_featured, is_hiring, tags')
          .order('member_count', { ascending: false })
          .limit(2),
      ]);

      if (cancelled) return;
      if (profilesRes.data) setFeaturedProfiles(profilesRes.data);
      if (serversRes.data) setTopServers(serversRes.data);
    };

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

    fetchFeaturedData();
    fetchStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <img
              src={logo}
              alt=""
              className="logo-mark w-16 h-16 md:w-20 md:h-20 mb-8 object-contain"
              width={80}
              height={80}
              decoding="async"
              fetchPriority="high"
              aria-hidden
            />

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight leading-[1.05]">
              erlc.directory
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-xl">
              Hire staff, post resumes and portfolios, connect with friends.
            </p>

            <div className="flex flex-wrap justify-center gap-2.5 mb-6 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-muted-foreground">
                <span className="emoji-on-dark text-lg leading-none" aria-hidden>
                  💼
                </span>
                Hire
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-muted-foreground">
                <span className="emoji-on-dark text-lg leading-none" aria-hidden>
                  📄
                </span>
                Resumes &amp; portfolios
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-muted-foreground">
                <span className="emoji-on-dark text-lg leading-none" aria-hidden>
                  🤝
                </span>
                Connect
              </span>
            </div>

            <p className="text-sm text-muted-foreground/90 mb-10 max-w-md">{HEADLINES[headlineIndex]}</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <>
                  <Link to={profile?.id ? `/profile/${profile.id}?edit=1` : '/browse'}>
                    <Button size="lg" className="gap-2 px-8 h-12 rounded-full">
                      <span className="emoji-on-dark text-base leading-none" aria-hidden>
                        ✏️
                      </span>
                      Edit profile
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/browse">
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 h-12 rounded-full border-white/15 bg-white/5 text-foreground hover:bg-white/10"
                    >
                      <Users className="h-4 w-4" />
                      Browse profiles
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button size="lg" className="gap-2 px-8 h-12 rounded-full bg-discord hover:bg-discord/90 text-white">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      Continue with Discord
                    </Button>
                  </Link>
                  <Link to="/browse">
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 h-12 rounded-full border-white/15 bg-white/5 text-foreground hover:bg-white/10"
                    >
                      Browse profiles
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {(stats.profiles > 0 || stats.servers > 0) && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="emoji-on-dark text-base leading-none" aria-hidden>
                    👥
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{stats.profiles}</span> members
                  </span>
                </span>
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-border" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <span className="emoji-on-dark text-base leading-none" aria-hidden>
                    🖥️
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{stats.servers}</span> servers
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <div className="rounded-xl border border-white/10 overflow-hidden bg-secondary/30 shadow-2xl">
              <img
                src={directoryPreview}
                alt="Preview of the erlc.directory members page"
                width={1156}
                height={810}
                className="block w-full h-auto"
                loading="lazy"
                decoding="async"
                sizes="(max-width: 896px) 100vw, 896px"
              />
            </div>
          </div>
        </div>
      </section>

      {featuredProfiles.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1 inline-flex items-center gap-2 flex-wrap">
                  <span className="emoji-on-dark text-2xl leading-none" aria-hidden>
                    ✨
                  </span>
                  Featured Members
                </h2>
                <p className="text-sm text-muted-foreground">Members with complete profiles and recent activity</p>
              </div>
              <Link to="/browse">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProfiles.map((p) => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {topServers.length > 0 && (
        <section className="py-12 md:py-16 bg-secondary/10 border-y border-border/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1 inline-flex items-center gap-2 flex-wrap">
                  <span className="emoji-on-dark text-2xl leading-none" aria-hidden>
                    🎮
                  </span>
                  Active Servers
                </h2>
                <p className="text-sm text-muted-foreground">Communities sharing openings and server details</p>
              </div>
              <Link to="/servers">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {topServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold mb-2 inline-flex items-center justify-center gap-2 flex-wrap">
              <span className="emoji-on-dark text-2xl leading-none" aria-hidden>
                🎯
              </span>
              Built for ER:LC hiring
            </h2>
            <p className="text-sm text-muted-foreground">Keep staff searches organized and easy to trust</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {FEATURE_CARDS.map((f) => (
              <Card key={f.title} className="card-elevated">
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                    <span className="emoji-on-dark text-2xl leading-none" aria-hidden>
                      {f.emoji}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1 capitalize">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-secondary/20 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-3 inline-flex items-center justify-center gap-2 flex-wrap">
              <span className="emoji-on-dark text-2xl leading-none" aria-hidden>
                🚀
              </span>
              Ready to build your listing?
            </h2>
            <p className="text-muted-foreground mb-6">
              Add your Discord-linked profile and start finding the right server or staff fit.
            </p>
            <Link to={user ? '/browse' : '/auth'}>
              <Button size="lg" className="gap-2">
                {user ? 'Browse Members' : 'Create Profile'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-6 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark w-6 h-6 object-contain"
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              </div>
              <span className="text-sm text-muted-foreground">© 2026 erlc.directory</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
