import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';
import SiteFooter from '@/components/layout/SiteFooter';
import { profileEditorPath } from '@/lib/profilePath';

const Index = () => {
  const { user, profile } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <section className="relative flex flex-1 flex-col justify-center overflow-hidden border-b border-white/[0.06] home-hero-aurora">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 55% at 50% 42%, black 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 42%, black 20%, transparent 75%)',
          }}
        />

        <div className="relative container mx-auto px-4 py-20 md:py-28 lg:py-32">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-10">
              <img
                src={logo}
                alt=""
                className="logo-mark mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16"
                width={64}
                height={64}
                decoding="async"
                fetchPriority="high"
                aria-hidden
              />
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.08]">
              Browse professional staff on{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-violet-400 bg-clip-text font-semibold text-transparent">
                erlc.directory
              </span>
            </h1>

            <div className="mt-12 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
              <Link to="/browse" className="w-full sm:w-auto sm:min-w-[11rem]">
                <Button size="lg" className="h-12 w-full gap-2 rounded-md px-8 font-medium sm:min-w-[11rem]">
                  <Users className="h-4 w-4" strokeWidth={1.75} />
                  Browse staff
                  <ArrowRight className="h-4 w-4 opacity-80" />
                </Button>
              </Link>
              {user ? (
                <Link to={profile?.id ? profileEditorPath(profile) : '/browse'} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full gap-2 rounded-md border-white/15 bg-background/40 px-8 font-medium backdrop-blur-sm sm:min-w-[11rem]"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                    Edit profile
                  </Button>
                </Link>
              ) : (
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full gap-2 rounded-md border-white/15 bg-background/40 px-8 font-medium backdrop-blur-sm sm:min-w-[11rem]"
                  >
                    Sign in
                    <ArrowRight className="h-4 w-4 opacity-80" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Index;
