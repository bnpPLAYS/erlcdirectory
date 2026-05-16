// OG HTML for crawler user agents (no JS). Helps when upstream returns a challenge page.

import {
  buildProfileOpenGraph,
  pickProfileOgImageUrl,
} from './proLinkPreviewOg.ts';
import {
  fetchPublicProfileOgBundle,
  fetchPublicServerOgRow,
  httpsOgImageUrl,
  parsePublicProfileOgRoute,
  parseServerPageId,
  sanitizeServerOgFields,
} from './server/ogServerPreview';

export const config = {
  matcher: [
    '/',
    '/((?!api/|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|json|txt|xml|woff2?|ttf|webmanifest|map|js|css|mjs)$).*)',
  ],
};

const EMBED_UA =
  /Discordbot|Twitterbot|facebookexternalhit|Facebot|Slackbot|LinkedInBot|Embedly|Pinterest|vkShare|TelegramBot|WhatsApp|SkypeUriPreview|Slack-ImgProxy/i;

const SITE_NAME = 'ERLC.Directory';
const SITE_TITLE = 'ERLC.Directory';
const SITE_DESCRIPTION = 'ER:LC servers, staff profiles, invites.';
const THEME_COLOR = '#0b0b0f';

/** Real site screenshot for default Discord/link previews (see `public/og-image.png`). */
const OG_FALLBACK_IMAGE_FILE = 'og-image.png?v=1';
const OG_FALLBACK_WIDTH = 1156;
const OG_FALLBACK_HEIGHT = 810;

function ogFallbackImageUrl(origin: string): string {
  return `${origin}/${OG_FALLBACK_IMAGE_FILE}`;
}

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
  imageWidth: number;
  imageHeight: number;
  themeColor: string;
  bodyHtml: string;
}): string {
  const escTitle = escapeHtml(opts.title);
  const escDesc = escapeHtml(opts.description);
  const escUrl = escapeHtml(opts.canonicalUrl);
  const escImg = escapeHtml(opts.imageUrl);
  const escTheme = escapeHtml(opts.themeColor);
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
<meta property="og:image" content="${escImg}" />
<meta property="og:image:width" content="${String(opts.imageWidth)}" />
<meta property="og:image:height" content="${String(opts.imageHeight)}" />
<meta name="twitter:card" content="summary_large_image" />
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
  return `<p style="max-width:28rem"><a href="${escUrl}" style="color:#93c5fd">Continue</a> — Discord sign-in on the next screen.</p>`;
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

export default async function middleware(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return fetch(request);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  const ua = request.headers.get('user-agent') ?? '';
  const isEmbed = EMBED_UA.test(ua);

  if (path.startsWith('/verify/')) {
    const afterPrefix = path.slice('/verify/'.length);
    if (afterPrefix && !afterPrefix.includes('/') && isEmbed) {
      const canonicalUrl = `${url.origin}${url.pathname}${url.search}`;
      const imageUrl = ogFallbackImageUrl(url.origin);
      const title = `Verify — ${SITE_NAME}`;
      const description = `${SITE_DESCRIPTION} Sign in with Discord to confirm.`;
      return new Response(
        ogDocument({
          title,
          description,
          canonicalUrl,
          imageUrl,
          imageWidth: OG_FALLBACK_WIDTH,
          imageHeight: OG_FALLBACK_HEIGHT,
          themeColor: THEME_COLOR,
          bodyHtml: verifyEmbedBody(canonicalUrl),
        }),
        { status: 200, headers: ogHtmlHeaders },
      );
    }
    return fetch(request);
  }

  if (!isEmbed) {
    return fetch(request);
  }

  const canonicalUrl = `${url.origin}${url.pathname}${url.search}`;
  const fallbackImage = ogFallbackImageUrl(url.origin);
  const sb = supabaseEnv();

  const serverId = parseServerPageId(path);
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
          imageWidth: bannerOg ? 960 : OG_FALLBACK_WIDTH,
          imageHeight: bannerOg ? 540 : OG_FALLBACK_HEIGHT,
          themeColor: THEME_COLOR,
          bodyHtml: siteEmbedBody(canonicalUrl),
        }),
        { status: 200, headers: ogHtmlHeaders },
      );
    }
  }

  const profileOgLookup = parsePublicProfileOgRoute(path);
  if (profileOgLookup && sb) {
    const bundle = await fetchPublicProfileOgBundle(sb.url, sb.anonKey, profileOgLookup);
    if (bundle) {
      const built = buildProfileOpenGraph({
        profile: bundle.profile,
        topExperience: bundle.topExperience,
      });
      const bannerHttps = httpsOgImageUrl(bundle.profile.banner_url);
      const avatarHttps = httpsOgImageUrl(bundle.profile.discord_avatar);
      const pick = pickProfileOgImageUrl({
        bannerHttps,
        avatarHttps,
        fallbackUrl: fallbackImage,
        fallbackWidth: OG_FALLBACK_WIDTH,
        fallbackHeight: OG_FALLBACK_HEIGHT,
      });
      return new Response(
        ogDocument({
          title: built.title,
          description: built.description,
          canonicalUrl,
          imageUrl: pick.url,
          imageWidth: pick.width,
          imageHeight: pick.height,
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
      imageWidth: OG_FALLBACK_WIDTH,
      imageHeight: OG_FALLBACK_HEIGHT,
      themeColor: THEME_COLOR,
      bodyHtml: siteEmbedBody(canonicalUrl),
    }),
    { status: 200, headers: ogHtmlHeaders },
  );
}
