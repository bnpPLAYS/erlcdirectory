import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  UserCircle,
  Building2,
  FileText,
  Users,
  ShieldCheck,
  Sparkles,
  Search,
  BadgeCheck,
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
    toc: ['What is ERLC Directory?', 'Who it’s for', 'Major areas of the site'],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: Sparkles,
    toc: ['Discord sign-in', 'Terms & first login', 'Staying signed in'],
  },
  {
    id: 'profiles',
    title: 'Profiles & directory',
    icon: UserCircle,
    toc: ['Member Directory', 'Your profile URL', 'Editing your profile', 'Reviews'],
  },
  {
    id: 'experience-verification',
    title: 'Experience & verification',
    icon: BadgeCheck,
    toc: ['Adding experience', 'Verification links', 'What verifiers do'],
  },
  {
    id: 'servers-posts',
    title: 'Servers & posts',
    icon: Building2,
    toc: ['Servers list & detail', 'Posts — types & actions'],
  },
  {
    id: 'connections-messages',
    title: 'Connections & messages',
    icon: Users,
    toc: ['Connection requests', 'Messages inbox'],
  },
  {
    id: 'trust-account',
    title: 'Trust, staff & account',
    icon: ShieldCheck,
    toc: ['Text filtering', 'Staff tools', 'Reporting & DB setup', 'Legal', 'Troubleshooting'],
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
                What is ERLC Directory?
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                ERLC Directory (<Link to="/" className="text-primary underline-offset-2 hover:underline">www.erlc.directory</Link>) is a
                staff-focused directory for Emergency Response: Liberty County communities. It brings together member profiles with verified
                server experience, server listings, structured community posts (hiring, looking for work, announcements, discussion), and light
                networking through connections and direct messages.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="introduction-who">
                Who it’s for
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Staff members building a credible résumé, server owners who want hiring and culture visible in one place, and players who need
                clear proof of roles—without spreadsheets or fragmented Discord bios alone.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="introduction-areas">
                Major areas of the site
              </h3>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>
                  <strong className="text-foreground">Home</strong> — Overview and entry points into the directory.
                </li>
                <li>
                  <strong className="text-foreground">Members</strong> — Browse public profiles and open someone’s page.
                </li>
                <li>
                  <strong className="text-foreground">Servers</strong> — Explore ER:LC communities; open a server for description, invite,
                  and members who work there.
                </li>
                <li>
                  <strong className="text-foreground">Posts</strong> — Community board with filters by post type and server context where
                  relevant.
                </li>
                <li>
                  <strong className="text-foreground">Messages</strong> — Conversations with people you’re connected with (when signed in).
                </li>
              </ul>
              <Tip>
                Sign in with <strong className="text-foreground">Discord</strong> so your profile ties to your real Discord identity—used for
                trust, server verification, and hiring flows.
              </Tip>
            </>
          ) : meta.id === 'getting-started' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="getting-started-discord">
                Discord sign-in
              </h3>
              <ol className="mt-3 list-decimal pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>
                  Open <Link to="/auth" className="text-primary underline-offset-2 hover:underline">Sign in</Link> from the navigation menu.
                </li>
                <li>
                  Approve Discord OAuth. The app requests identity-related scopes so we can attach your Discord username, avatar, and (where
                  needed) your server list—for example when linking experience to a Discord guild or fetching servers you belong to.
                </li>
                <li>
                  After authorization you land back on the site; your session is stored so returning visits keep you signed in when the
                  browser allows it.
                </li>
              </ol>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="getting-started-terms">
                Terms & first login
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                New accounts may see an in-app gate to accept <Link to="/terms" className="text-primary underline-offset-2 hover:underline">Terms</Link> and{' '}
                <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy</Link>. Optional preferences (such as Discord DM
                updates from the site, where enabled) can be chosen there or later in profile settings.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="getting-started-session">
                Staying signed in
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                The app refreshes your Supabase session when you focus the tab or come back online. If you ever appear logged out after OAuth,
                try signing in again from the canonical site URL (www.erlc.directory); staging or preview hostnames use separate cookie/storage
                contexts.
              </p>
            </>
          ) : meta.id === 'profiles' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-directory">
                Member Directory
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                <Link to="/browse" className="text-primary underline-offset-2 hover:underline">Members</Link> lists public profiles. You can search and
                sort to find people; each card links to that member’s profile page.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-url">
                Your profile URL
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                When your Discord username can be turned into a safe path segment, your public URL is{' '}
                <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">https://www.erlc.directory/&lt;username&gt;</code> — trailing dots on
                Discord names are ignored for the URL (for example <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">pixelnovaa.</code>{' '}
                becomes <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">/pixelnovaa</code>). If your name clashes with a reserved route
                or cannot be slugged, the site falls back to <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">/profile/&lt;id&gt;</code>.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Opening your profile from the avatar menu always uses the canonical path the site generates for you—prefer that link when
                sharing.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-editing">
                Editing your profile
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                On your own profile, choose <strong className="text-foreground">Edit profile</strong>. Tabs typically cover:
              </p>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>
                  <strong className="text-foreground">General</strong> — Display name (also editable in the banner card), pronouns, availability,
                  county/region, timezone, status line, bio, skills, and optional Discord notification preferences where offered.
                </li>
                <li>
                  <strong className="text-foreground">Customize</strong> — Theme presets, accent color, banner image URL, and live accent preview.
                </li>
                <li>
                  <strong className="text-foreground">Experience</strong> — List roles (including Discord-linked server experience), dates,
                  verification actions, and adding/removing entries.
                </li>
              </ul>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Long text fields are passed through a community language filter; adjust wording if a save is rejected.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="profiles-reviews">
                Reviews
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                The profile <strong className="text-foreground">Reviews</strong> tab shows ratings and comments others leave about this member.
                Star ratings aggregate into the summary shown on cards where applicable.
              </p>
            </>
          ) : meta.id === 'experience-verification' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="exp-add">
                Adding experience
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Under Edit profile → Experience, add a row for each role. For server-linked experience you pick from Discord servers you belong
                to (from your OAuth guild list). New server-linked entries start with a pending role label until a verifier approves—you do not
                set your final server title yourself in that flow.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="exp-verify-links">
                Verification links
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                For a pending server-linked row, use <strong className="text-foreground">Verify</strong> to copy a time-limited verification link (often 24 hours).
                Share it with someone who can approve your role on that server. A refresh control may rotate the token; older links then expire.
              </p>
              <Tip>
                Use the site’s generated verification URL on the production domain you configured—Discord OAuth and redirects must match what
                is registered for your Supabase and Discord app.
              </Tip>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="exp-verifier">
                What verifiers do
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                A verifier with authority on the Discord server opens the link, signs in with Discord if prompted, and confirms or denies the
                request. They set your <strong className="text-foreground">verified title/role</strong> on the server and may leave a structured review (for example
                stars). After approval, your experience shows as verified on your profile.
              </p>
            </>
          ) : meta.id === 'servers-posts' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="servers-list">
                Servers list & detail
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                <Link to="/servers" className="text-primary underline-offset-2 hover:underline">Servers</Link> shows ER:LC communities we track. Cards may show hiring
                status, banners when available, descriptions, Discord invites when configured, and staff counts driven from verified experience
                links to that guild. Opening a server shows detail and members linked through experience.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="posts-types">
                Posts — types & actions
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                <Link to="/posts" className="text-primary underline-offset-2 hover:underline">Posts</Link> is the community board. When creating a post you choose a{' '}
                <strong className="text-foreground">type</strong>; the form adapts so each type collects the right fields:
              </p>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
                <li>
                  <strong className="text-foreground">Discussion</strong> — Threaded replies for conversation.
                </li>
                <li>
                  <strong className="text-foreground">Hiring</strong> — Often includes an application link; Discord membership may be checked when configured.
                </li>
                <li>
                  <strong className="text-foreground">Looking for work</strong> — Highlights that someone is seeking roles; links may point to their profile or messaging.
                </li>
                <li>
                  <strong className="text-foreground">Announcement</strong> — Broadcast-style updates from servers or staff.
                </li>
              </ul>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Filters help narrow by type; author names link to member profiles where available.
              </p>
            </>
          ) : meta.id === 'connections-messages' ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="connections-requests">
                Connection requests
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                On another member’s profile, <strong className="text-foreground">Connect</strong> sends a request. The recipient can accept or decline from{' '}
                <Link to="/connections" className="text-primary underline-offset-2 hover:underline">Connections</Link>. Notes are moderated by the same text rules as
                elsewhere.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="connections-messages-tab">
                Messages inbox
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                <Link to="/messages" className="text-primary underline-offset-2 hover:underline">Messages</Link> lists conversations with accepted connections. Deep links
                may open a thread with a specific person using query parameters where supported.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-filter">
                Text filtering
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Typed content across profiles, posts, reviews, connection notes, and messaging passes through client-side moderation helpers.
                Keep language professional so submissions succeed.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-staff">
                Staff tools
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                A restricted <strong className="text-foreground">Staff</strong> area exists for site operators (enforced in the database and UI). It includes post moderation and a{' '}
                <strong className="text-foreground">Reports</strong> queue for flagged reviews and messages.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                To grant Pixelnovaa. admin in one step: open{' '}
                <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">supabase/snippets/grant_staff_pixelnovaa.sql</code>, copy{' '}
                <strong className="text-foreground">all SQL</strong> into Supabase SQL Editor, run after signing into the site once so a profile row exists.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-reporting-db">
                Reporting & DB setup
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Signed-in members can report reviews and DMs. Staff triages under <strong className="text-foreground">Staff panel → Reports</strong>. Production needs{' '}
                <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code> on Vercel for the <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">/api/submit-report</code> route.
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                If you see <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">moderation_reports</code> / schema cache errors, paste the full file{' '}
                <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">supabase/migrations/20260530120000_staff_warnings_reports.sql</code> into SQL Editor (entire contents, not the path). If <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">is_site_owner</code> is missing, run older migrations first or <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">supabase db push</code>.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-legal">
                Legal
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                Read <Link to="/terms" className="text-primary underline-offset-2 hover:underline">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy Policy</Link>. Contact for abuse or privacy requests via{' '}
                <Link to="/contact" className="text-primary underline-offset-2 hover:underline">Contact</Link>.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-8 scroll-mt-28" id="trust-troubleshooting">
                Troubleshooting: “Profile not found”
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                If your profile opens everywhere except under your <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">/@username</code> URL, ensure the database
                migration for username lookup is applied on your Supabase project and that your <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">profiles.discord_username</code>{' '}
                matches Discord. Use the <strong className="text-foreground">My profile</strong> link from the avatar menu for the canonical URL. Stay on the production domain
                you configured for OAuth.
              </p>
              <Tip>
                Deploy pending SQL migrations (<code className="text-xs rounded bg-white/10 px-1.5 py-0.5">supabase db push</code> or CI) so functions such as{' '}
                <code className="text-xs rounded bg-white/10 px-1.5 py-0.5">get_profile_by_username_lookup</code> exist in production.
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

          <main className="flex-1 min-w-0 space-y-16">
            <header className={pageHeroEnter}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
                <FileText className="h-3.5 w-3.5" />
                Documentation
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">How to use ERLC Directory</h1>
              <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">
                In-depth guide to profiles, verification, servers, posts, connections, and account behavior. Use the sidebar or search to jump
                around.
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
