import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { Mail } from 'lucide-react';

const Contact = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1 container mx-auto px-4 py-16 max-w-lg text-center">
      <h1 className="text-3xl font-bold tracking-tight mb-3">Contact</h1>
      <p className="text-muted-foreground text-sm mb-8">
        For support, privacy requests, or abuse reports related to erlc.directory.
      </p>
      <a
        href="mailto:support@erlc.directory?subject=erlc.directory%20support"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-6 py-4 text-sm font-medium hover:bg-white/[0.1] transition-colors"
      >
        <Mail className="h-4 w-4" />
        support@erlc.directory
      </a>
      <p className="mt-6 text-xs text-muted-foreground">
        Replace this address with your real inbox in production if different.
      </p>
    </main>
    <SiteFooter />
  </div>
);

export default Contact;
