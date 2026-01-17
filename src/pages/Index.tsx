import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Users, Building2, Shield, Star, Zap, MessageSquare } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import ServerCard from '@/components/server/ServerCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

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

const Index = () => {
  const { user } = useAuth();
  const [featuredProfiles, setFeaturedProfiles] = useState<Profile[]>([]);
  const [topServers, setTopServers] = useState<Server[]>([]);
  const [stats, setStats] = useState({ profiles: 0, servers: 0 });

  useEffect(() => {
    fetchFeaturedData();
    fetchStats();
  }, []);

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
        .limit(2)
    ]);

    if (profilesRes.data) setFeaturedProfiles(profilesRes.data);
    if (serversRes.data) setTopServers(serversRes.data);
  };

  const fetchStats = async () => {
    const [profileCount, serverCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('servers').select('id', { count: 'exact', head: true })
    ]);
    
    setStats({
      profiles: profileCount.count || 0,
      servers: serverCount.count || 0
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-card border border-border/50 flex items-center justify-center shadow-2xl shadow-primary/10 animate-in overflow-hidden">
              <img src={logo} alt="ERLC Directory" className="w-full h-full object-cover" />
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight animate-in stagger-1">
              ERLC Directory
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-in stagger-2">
              The professional networking platform for the ER:LC community. 
              Discover verified staff, connect with communities, and build your reputation.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-in stagger-3">
              {user ? (
                <>
                  <Link to="/browse">
                    <Button size="lg" className="gap-2 px-6 h-11">
                      <Users className="h-4 w-4" />
                      Browse Professionals
                    </Button>
                  </Link>
                  <Link to="/servers">
                    <Button size="lg" variant="outline" className="gap-2 h-11 border-border/60">
                      <Building2 className="h-4 w-4" />
                      Explore Servers
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button size="lg" className="gap-2 px-6 h-11 bg-discord hover:bg-discord/90 text-white">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      Get Started with Discord
                    </Button>
                  </Link>
                  <Link to="/browse">
                    <Button size="lg" variant="outline" className="gap-2 h-11 border-border/60">
                      Browse Directory
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-border/30 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, value: stats.profiles || '0', label: 'Professionals' },
              { icon: Building2, value: stats.servers || '0', label: 'Servers' },
              { icon: Shield, value: '100%', label: 'Discord Verified' },
              { icon: MessageSquare, value: 'Direct', label: 'Messaging' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Professionals */}
      {featuredProfiles.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1">Featured Professionals</h2>
                <p className="text-sm text-muted-foreground">Top-rated members in the community</p>
              </div>
              <Link to="/browse">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Servers */}
      {topServers.length > 0 && (
        <section className="py-12 md:py-16 bg-secondary/10 border-y border-border/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1">Top Servers</h2>
                <p className="text-sm text-muted-foreground">Verified communities looking for staff</p>
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

      {/* Features */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold mb-2">Why ERLC Directory?</h2>
            <p className="text-sm text-muted-foreground">Build your professional presence</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Shield, title: 'Verified Experiences', desc: 'All experiences verified by server staff.' },
              { icon: Star, title: 'Reputation System', desc: 'Ratings and reviews from the community.' },
              { icon: Zap, title: 'Quick Connections', desc: 'Message and connect with professionals.' },
            ].map((f, i) => (
              <Card key={i} className="card-elevated">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16 bg-secondary/20 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-3">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-6">
              Create your profile, verify your experience, and connect with the ERLC community.
            </p>
            <Link to={user ? "/browse" : "/auth"}>
              <Button size="lg" className="gap-2">
                {user ? 'Browse Profiles' : 'Create Your Profile'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded overflow-hidden">
                <img src={logo} alt="ERLC" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm text-muted-foreground">© 2025 erlc.directory</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
