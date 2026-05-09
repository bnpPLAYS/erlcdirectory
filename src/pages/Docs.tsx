import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  UserCircle,
  Building2,
  FileText,
  Users,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Search,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { pageHeroEnter } from '@/lib/pageHero';

type Section = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  toc: string[];
  body: ReactNode;
};

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
      <Sparkles className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden />
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

const SECTION_DATA: Omit<Section, 'body'>[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: BookOpen,
    toc: ['What is www.erlc.directory?', 'Who it’s for'],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: Sparkles,
    toc: ['Discord sign-in', 'First-time checklist'],
  },
  {
    id: 'profiles',
    title: 'Profiles',
    icon: UserCircle,
    toc: ['Editing your profile', 'Experience & verification'],
  },
  {
    id: 'servers-openings',
    title: 'Servers & openings',
    icon: Building2,
    toc: ['Listing a server', 'Posting an opening'],
  },
  {
    id: 'connections-messages',
    title: 'Connections & messages',
    icon: Users,
    toc: ['Connection requests', 'Messages'],
  },
  {
    id: 'trust-safety',
    title: 'Trust & safety',
    icon: ShieldCheck,
    toc: ['Text filtering', 'Terms & privacy'],
  },
];

const Docs = () => {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState(SECTION_DATA[0].id);

  const sections: Section[] = useMemo(
    () =>
      SECTION_DATA.map((meta) => ({
        ...meta,
        body:
          meta.id === 'introduction' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="introduction-what">
                What is www.erlc.directory?
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                www.erlc.directory is a staff-focused directory for Emergency Response: Liberty County communities—profiles, verified experience,
                server listings, openings, and lightweight networking between members.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="introduction-who">
                Who it’s for
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Players building a credible staff résumé, server owners hiring or showcasing culture, and contributors who want clear proof of roles without noisy spreadsheets.
              </p>
              <Tip>
                Use the same Discord account consistently—your profile links to your Discord identity for trust and faster onboarding.
              </Tip>
            </>
          ) : meta.id === 'getting-started' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="getting-started-discord">
                Discord sign-in
              </h3>
              <ol className="mt-3 list-decimal pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>Open <Link to="/auth" className="text-primary underline-offset-2 hover:underline">Sign in</Link>.</li>
                <li>Authorize Discord with the requested scopes (identity, email, guild list where needed).</li>
                <li>Accept the in-app Terms & Privacy prompt on first login for new accounts.</li>
              </ol>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="getting-started-checklist">
                First-time checklist
              </h3>
              <ol className="mt-3 list-decimal pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>Fill display name, bio, skills, and banner under Edit profile.</li>
                <li>Add experience entries (server-linked or direct).</li>
                <li>Browse members or servers and send a connection request when appropriate.</li>
              </ol>
            </>
          ) : meta.id === 'profiles' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-editing">
                Editing your profile
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                From your profile page, choose Edit to update banner, accent theme presets, skills, social links, availability, and bio text.
                Long-form fields run through an automatic chat filter—keep language respectful so saves succeed smoothly.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-experience">
                Experience & verification
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Add roles tied to Discord servers you belong to, or document direct collaborations. Where supported, generate a verification link so server leadership can confirm your role.
              </p>
              <Tip>
                Verified badges reflect administrator approval—not every role requires verification, but it boosts credibility for hiring flows.
              </Tip>
            </>
          ) : meta.id === 'servers-openings' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="servers-openings-list">
                Listing a server
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Navigate to Servers → List a server. Provide accurate descriptions, invite links, tags, and hiring status so candidates understand your culture before applying.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="servers-openings-post">
                Posting an opening
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Use Posts to publish hiring threads, looking-for-work listings, announcements, and discussions tied to verified Discord servers when required. Titles and descriptions are filtered automatically—focus on responsibilities and requirements.
              </p>
            </>
          ) : meta.id === 'connections-messages' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="connections-requests">
                Connection requests
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Visit another member’s profile and choose Connect. Optional notes are moderated by the same chat filter. Accepted connections unlock messaging according to product rules.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="connections-messages-tab">
                Messages
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Open Messages from the navigation bar to continue conversations. Compose boxes also enforce filtering—keep outreach professional and on-topic.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-filter">
                Text filtering
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Typed content across profiles, posts, reviews, connection notes, and messaging passes through client-side moderation helpers that mask disallowed language patterns.
                Operators may extend this list server-side—when in doubt, rewrite politely before submitting.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-legal">
                Terms & privacy
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Review <Link to="/terms" className="text-primary underline-offset-2 hover:underline">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy Policy</Link>—first-time Discord logins must acknowledge both before continuing.
              </p>
              <Tip>
                Report harmful behavior via the Contact page so moderators can investigate alongside automated tooling.
              </Tip>
            </>
          ),
      })),
    [],
  );

  const filteredNav = useMemo(() => {
    if (!q.trim()) return sections;
    const needle = q.toLowerCase();
    return sections.filter((s) => s.title.toLowerCase().includes(needle));
  }, [q, sections]);

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const nodes = ids.map((id) => document.getElementById(`doc-${id}`)).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target?.id?.replace('doc-', '');
        if (id) setActiveId(id);
      },
      { rootMargin: '-45% 0px -40% 0px', threshold: [0, 0.1, 0.25, 0.5] },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const flatToc = sections.find((s) => s.id === activeId)?.toc ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-40 lg:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…" className="h-9 border-white/10" />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 max-w-7xl mx-auto">
          {/* Left sidebar */}
          <aside className="lg:w-56 shrink-0 lg:sticky lg:top-28 lg:self-start space-y-6 animate-in fade-in slide-in-from-left-3 duration-500">
            <div className="hidden lg:block relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…" className="pl-9 h-10 border-white/10 bg-white/[0.03]" />
            </div>
            <nav className="space-y-1">
              {filteredNav.map((s) => {
                const Icon = s.icon;
                const active = activeId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                      active ? 'bg-white/[0.1] text-foreground border border-primary/30' : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {s.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 space-y-16">
            <header className={pageHeroEnter}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
                <FileText className="h-3.5 w-3.5" />
                Documentation
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">How to use www.erlc.directory</h1>
              <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">
                Animated reference layout aligned with our monochrome accent—jump between sections or skim the on-this-page outline on desktop.
              </p>
            </header>

            {sections.map((s, idx) => (
              <article
                key={s.id}
                id={`doc-${s.id}`}
                className="scroll-mt-28 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">{s.body}</div>
              </article>
            ))}
          </main>

          {/* Right TOC */}
          <aside className="hidden xl:block w-48 shrink-0 sticky top-28 self-start text-sm animate-in fade-in slide-in-from-right-3 duration-500">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
            <ul className="space-y-2 border-l border-white/10 pl-4">
              {flatToc.map((label) => (
                <li key={label} className="text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Docs;
