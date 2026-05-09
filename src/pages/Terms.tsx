import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { pageHeroEnter } from '@/lib/pageHero';

const Terms = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
      <div className={pageHeroEnter}>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: May 9, 2026 · Site: erlc.directory</p>
      </div>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Agreement</h2>
          <p>
            By creating an account or using erlc.directory (the “Service”), you agree to these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Eligibility & accounts</h2>
          <p>
            You authenticate using Discord. You must comply with Discord’s Terms of Service and Community Guidelines.
            You are responsible for activity performed through your account. You must provide accurate profile information and keep your credentials secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Directory purpose</h2>
          <p>
            The Service helps Emergency Response: Liberty County (“ER:LC”) communities showcase staffing history,
            discover talent, post openings, and stay connected. It is not affiliated with Roblox Corporation unless expressly stated elsewhere on the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Harass, threaten, defraud, or abuse others.</li>
            <li>Post unlawful content, malware, or spam.</li>
            <li>Attempt to scrape or overload the Service in ways that harm availability.</li>
            <li>Misrepresent identity, roles, or verification status.</li>
            <li>Circumvent moderation or security controls.</li>
          </ul>
          <p className="mt-2">
            Automated filters may alter or restrict certain text submissions; operators may remove content or suspend accounts that violate these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. User content</h2>
          <p>
            You retain ownership of content you submit. You grant erlc.directory a non-exclusive license to host, display,
            and distribute that content solely to operate and improve the Service. You represent that you have the rights needed for what you upload or write.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Verification & badges</h2>
          <p>
            Verification indicators reflect checks performed by server administrators or site operators when applicable.
            They do not constitute guarantees about employment, skill level, or trustworthiness beyond what is expressly indicated on the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, ERLC.DIRECTORY AND ITS OPERATORS WILL NOT BE LIABLE FOR INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA OR PROFITS.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Changes</h2>
          <p>
            We may update these Terms. Continued use after changes constitutes acceptance of the revised Terms.
            Material changes may require renewed acceptance in-app where technically feasible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Contact</h2>
          <p>
            Questions about these Terms: see{' '}
            <Link to="/contact" className="text-primary underline underline-offset-2 hover:no-underline">
              Contact
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default Terms;
