import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { pageHeroEnter } from '@/lib/pageHero';

const Privacy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
      <div className={pageHeroEnter}>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: May 9, 2026 · Site: www.erlc.directory</p>
      </div>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Overview</h2>
          <p>
            This policy describes how www.erlc.directory (“we”, “us”) collects and uses information when you use the Service.
            By using the Service, you acknowledge this policy alongside our Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong className="text-foreground">Discord OAuth:</strong> username, numeric Discord ID, avatar URL, email (OAuth scope required by our sign-in provider), and server list scope used for features such as listing verified servers.
            </li>
            <li>
              <strong className="text-foreground">Profile content:</strong> fields you fill out such as bio, roles, skills, banners, and links you submit.
            </li>
            <li>
              <strong className="text-foreground">Operational data:</strong> approximate timestamps, IP-derived abuse signals processed by our hosting providers as applicable.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. How we use information</h2>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Create and maintain your account and profile.</li>
            <li>Show directory listings, openings, messages, and connections you choose to use.</li>
            <li>Operate moderation tooling including automated text filtering.</li>
            <li>Improve reliability, security, and product quality.</li>
            <li>
              <strong className="text-foreground">Optional Discord DMs:</strong> if you opt in, our Discord bot may send you
              direct messages about site announcements or the status of your experience verifications. You can change this
              anytime in your profile settings. Delivery requires you to share at least one Discord server with our bot and
              your Discord privacy settings allowing DMs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Sharing</h2>
          <p>
            Your public profile and postings are visible as intended by product features. We may share data with vendors that host or secure the Service (e.g., Supabase, Discord),
            when required by law, or to protect safety and integrity.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Retention</h2>
          <p>
            We retain information while your account is active and as needed for legitimate purposes such as legal compliance and dispute resolution.
            You may request deletion where applicable by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Children</h2>
          <p>The Service is not directed at children under 13. Do not use the Service if you are under the minimum age required by applicable law.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Security</h2>
          <p>
            We implement reasonable safeguards; no online service is perfectly secure. Protect your Discord account and report suspected misuse via Contact.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes</h2>
          <p>We may update this Privacy Policy. We will adjust the “Last updated” date above when we do.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
          <p>
            Privacy requests:{' '}
            <Link to="/contact" className="text-primary underline underline-offset-2 hover:no-underline">
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default Privacy;
