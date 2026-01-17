import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Users, Building2, Shield, Star, Zap, CheckCircle2, TrendingUp } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import ServerCard from '@/components/server/ServerCard';
import { mockProfiles, mockServers } from '@/lib/mockData';
import logo from '@/assets/logo.png';

const Index = () => {
  const featuredProfiles = mockProfiles.filter(p => p.isFeatured).slice(0, 3);
  const topServers = mockServers.slice(0, 2);

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
              <Link to="/auth">
                <Button size="lg" variant="ghost" className="gap-2 h-11">
                  <CheckCircle2 className="h-4 w-4" />
                  Get Verified
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-border/30 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, value: '2,500+', label: 'Verified Professionals' },
              { icon: Building2, value: '150+', label: 'Active Servers' },
              { icon: Shield, value: '10K+', label: 'Verified Experiences' },
              { icon: TrendingUp, value: '4.6', label: 'Avg. Rating' },
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

      {/* Top Servers */}
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
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Create Your Profile
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
