/** Minimal Open Graph HTML for Discord and other crawlers (no JavaScript). */

import {
  fetchPublicServerOgRow,
  httpsOgImageUrl,
  parseServerPageId,
  sanitizeServerOgFields,
} from './ogServerPreview.ts';

const EMBED_UA =
  /Discordbot|Twitterbot|facebookexternalhit|Facebot|Slackbot|LinkedInBot|Embedly|Pinterest|vkShare|TelegramBot|WhatsApp|SkypeUriPreview|Slack-ImgProxy/i;

const SKIP_OG_PATH =
  /\.(?:ico|png|jpg|jpeg|gif|webp|svg|json|txt|xml|woff2?|ttf|webmanifest|map|js|css|mjs)$/i;

const SITE_NAME = 'ERLC.Directory';
const SITE_TITLE = 'ERLC.Directory';
const SITE_DESCRIPTION =
  'Discover ER:LC roleplay servers, staff portfolios, and communities.';
const THEME_COLOR = '#0b0b0f';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ogDocument(opts: {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  siteName: string;
  themeColor: string;
  bodyHtml: string;
}): string {
  const escTitle = escapeHtml(opts.title);
  const escDesc = escapeHtml(opts.description);
  const escUrl = escapeHtml(opts.canonicalUrl);
  const escImg = escapeHtml(opts.imageUrl);
  const escSite = escapeHtml(opts.siteName);
  const escTheme = escapeHtml(opts.themeColor);
  const w = opts.imageWidth ?? 1200;
  const h = opts.imageHeight ?? 630;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escTitle}</title>
<link rel="canonical" href="${escUrl}" />
<meta name="description" content="${escDesc}" />
<meta property="og:title" content="${escTitle}" />
<meta property="og:description" content="${escDesc}" />
<meta property="og:url" content="${escUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escSite}" />
<meta property="og:image" content="${escImg}" />
<meta property="og:image:width" content="${String(w)}" />
<meta property="og:image:height" content="${String(h)}" />
<meta property="og:image:alt" content="${escTitle}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escTitle}" />
<meta name="twitter:description" content="${escDesc}" />
<meta name="twitter:image" content="${escImg}" />
<meta name="theme-color" content="${escTheme}" />
</head>
<body style="margin:0;background:#0b0b0f;color:#e8e8ec;font-family:system-ui,sans-serif;padding:2rem;line-height:1.5">
${opts.bodyHtml}
</body>
</html>`;
}

function verifyEmbedBody(canonicalUrl: string): string {
  const escUrl = escapeHtml(canonicalUrl);
  return `<p style="max-width:28rem"><a href="${escUrl}" style="color:#93c5fd">Continue to verification</a> — you will sign in with Discord on the next screen.</p>`;
}

function siteEmbedBody(canonicalUrl: string): string {
  const escUrl = escapeHtml(canonicalUrl);
  return `<p style="max-width:28rem"><a href="${escUrl}" style="color:#93c5fd">Open ERLC.Directory</a></p>`;
}

const ogHtmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300, s-maxage=600',
};

function supabaseEnv(): { url: string; anonKey: string } | null {
  const ref = process.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (ref ? `https://${ref}.supabase.co` : '')
  )
    .trim()
    .replace(/\/$/, '');
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    '';
  if (!supabaseUrl || !anonKey) return null;
  return { url: supabaseUrl, anonKey };
}

export function shouldSkipOgForPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  return SKIP_OG_PATH.test(pathname);
}

/** Returns HTML for embed crawlers, or null to serve the SPA / static file instead. */
export async function getCrawlerOgResponse(request: Request): Promise<Response | null> {
  if (request.method !== 'GET') return null;

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (shouldSkipOgForPath(pathname)) return null;

  const ua = request.headers.get('user-agent') ?? '';
  const isEmbed = EMBED_UA.test(ua);

  if (pathname.startsWith('/verify/')) {
    const afterPrefix = pathname.slice('/verify/'.length);
    if (afterPrefix && !afterPrefix.includes('/') && isEmbed) {
      const canonicalUrl = `${url.origin}${url.pathname}${url.search}`;
      const imageUrl = `${url.origin}/embed.png?v=2`;
      const title = `Verify experience — ${SITE_NAME}`;
      const description = `${SITE_DESCRIPTION} Open this link to confirm staff experience with your Discord login.`;
      return new Response(
        ogDocument({
          title,
          description,
          canonicalUrl,
          imageUrl,
          imageWidth: 1200,
          imageHeight: 630,
          siteName: SITE_NAME,
          themeColor: THEME_COLOR,
          bodyHtml: verifyEmbedBody(canonicalUrl),
        }),
        { status: 200, headers: ogHtmlHeaders },
      );
    }
    return null;
  }

  if (!isEmbed) return null;

  const canonicalUrl = `${url.origin}${url.pathname}${url.search}`;
  const fallbackImage = `${url.origin}/embed.png?v=2`;

  const serverId = parseServerPageId(pathname);
  const sb = serverId ? supabaseEnv() : null;
  if (serverId && sb) {
    const row = await fetchPublicServerOgRow(sb.url, sb.anonKey, serverId);
    if (row) {
      const bannerOg = httpsOgImageUrl(row.banner);
      const imageUrl = bannerOg ?? fallbackImage;
      const { title: ogTitle, description } = sanitizeServerOgFields({
        name: row.name,
        description: row.description,
        descriptionMax: 280,
        siteFallbackDescription: `${SITE_DESCRIPTION} Open this server’s listing on ERLC.Directory.`,
      });
      return new Response(
        ogDocument({
          title: ogTitle,
          description,
          canonicalUrl,
          imageUrl,
          imageWidth: bannerOg ? 960 : 1200,
          imageHeight: bannerOg ? 540 : 630,
          siteName: SITE_NAME,
          themeColor: THEME_COLOR,
          bodyHtml: siteEmbedBody(canonicalUrl),
        }),
        { status: 200, headers: ogHtmlHeaders },
      );
    }
  }

  return new Response(
    ogDocument({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      canonicalUrl,
      imageUrl: fallbackImage,
      imageWidth: 1200,
      imageHeight: 630,
      siteName: SITE_NAME,
      themeColor: THEME_COLOR,
      bodyHtml: siteEmbedBody(canonicalUrl),
    }),
    { status: 200, headers: ogHtmlHeaders },
  );
}
