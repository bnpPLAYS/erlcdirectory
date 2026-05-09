import { createRoot } from 'react-dom/client';
import './index.css';
import {
  getCanonicalRedirectUrl,
  shouldDeferCanonicalRedirectForOAuthCallback,
} from '@/lib/canonicalHost';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

const redirectTo = shouldDeferCanonicalRedirectForOAuthCallback()
  ? null
  : getCanonicalRedirectUrl();

const missing: string[] = [];
if (!import.meta.env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
if (!import.meta.env.VITE_SUPABASE_PROJECT_ID) missing.push('VITE_SUPABASE_PROJECT_ID');

async function boot() {
  if (missing.length > 0) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:#0c0c0f;color:#e4e4e7;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;">
        <div style="max-width:36rem;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1.5rem;background:rgba(255,255,255,.04);">
          <h1 style="margin:0 0 0.75rem;font-size:1.125rem;font-weight:600;">Configuration needed</h1>
          <p style="margin:0 0 1rem;color:#a1a1aa;">This build is missing Supabase environment variables, so the app cannot start.</p>
          <p style="margin:0 0 0.5rem;font-weight:500;">Add these (see <code style="background:rgba(0,0,0,.35);padding:0 .35rem;border-radius:4px;">.env.example</code>):</p>
          <ul style="margin:0 0 1rem;padding-left:1.25rem;color:#d4d4d8;">
            ${missing.map((k) => `<li><code style="background:rgba(0,0,0,.35);padding:0 .25rem;border-radius:4px;">${k}</code></li>`).join('')}
          </ul>
          <p style="margin:0;color:#a1a1aa;font-size:14px;">On <strong>Vercel</strong>: Project → Settings → Environment Variables → add all three → redeploy.</p>
        </div>
      </div>`;
    return;
  }

  const { default: App } = await import('./App.tsx');
  createRoot(rootEl).render(<App />);
}

if (redirectTo) {
  window.location.replace(redirectTo);
} else {
  void boot();
}
