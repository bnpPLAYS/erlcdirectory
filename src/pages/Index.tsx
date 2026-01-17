import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Users, Building2, Shield, Star, Zap, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import { mockProfiles } from '@/lib/mockData';
import logo from '@/assets/logo.png';

const Index = () => {
  const featuredProfiles = mockProfiles.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-card to-secondary border border-border/50 flex items-center justify-center shadow-2xl shadow-primary/10 animate-in">
              <img src={logo} alt="ERLC Directory" className="w-16 h-16 object-contain" />
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight animate-in stagger-1">
              Browse Professionals
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-in stagger-2">
              Discover talented staff, developers, and designers in the ER:LC community. 
              Connect with verified professionals and build your reputation.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in stagger-3">
              <Link to="/browse">
                <Button size="lg" className="gap-2 px-8 h-12 text-base">
                  Browse Directory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="gap-2 h-12 text-base border-border/60">
                  <CheckCircle2 className="h-4 w-4" />
                  Get Verified
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 border-y border-border/30 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { icon: Users, value: '2,500+', label: 'Verified Members' },
              { icon: Building2, value: '150+', label: 'Active Servers' },
              { icon: Shield, value: '10,000+', label: 'Experiences Verified' },
              { icon: Star, value: '4.5', label: 'Avg. Rating' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl md:text-3xl font-bold mb-0.5">{stat.value}</div>
                <div className="text-xs md:text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">Featured Professionals</h2>
              <p className="text-muted-foreground text-sm md:text-base">Top-rated members in the community</p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" className="gap-2 hidden sm:flex">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 bg-secondary/20 border-y border-border/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Why Use ERLC Directory?</h2>
            <p className="text-muted-foreground">Build your professional presence</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Shield, title: 'Verified Experiences', desc: 'All experiences verified by high-ranking staff members.' },
              { icon: Star, title: 'Reputation System', desc: 'Build reputation with ratings from community members.' },
              { icon: Zap, title: 'Quick Connections', desc: 'Connect with professionals and find opportunities.' },
            ].map((f, i) => (
              <Card key={i} className="card-elevated">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ERLC" className="w-6 h-6 opacity-60" />
              <span className="text-sm text-muted-foreground">© 2024 erlc.directory</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
