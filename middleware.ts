/**
 * Discord (and other messengers) fetch shared URLs without running JavaScript.
 * They only see the initial HTML, so SPAs often show a generic preview.
 * For `/verify/:token`, serve Open Graph markup to known embed crawlers only;
 * real browsers continue to the Vite SPA via `fetch(request)`.
 *
 * @see https://vercel.com/docs/routing-middleware
 */

export const config = {
  matcher: ['/verify/:path*'],
};

const EMBED_UA =
  /Discordbot|Twitterbot|facebookexternalhit|Facebot|Slackbot|LinkedInBot|Embedly|Pinterest|vkShare|TelegramBot|WhatsApp|SkypeUriPreview|Slack-ImgProxy/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function embedHtml(canonicalUrl: string, imageUrl: string): string {
  const title = 'Verify experience — erlc.directory';
  const description =
    'Open this link to confirm staff experience with your Discord login. Hire staff, post resumes and portfolios, connect with friends.';
  const escTitle = escapeHtml(title);
  const escDesc = escapeHtml(description);
  const escUrl = escapeHtml(canonicalUrl);
  const escImg = escapeHtml(imageUrl);
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
<meta property="og:site_name" content="erlc.directory" />
<meta property="og:image" content="${escImg}" />
<meta property="og:image:alt" content="${escTitle}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escTitle}" />
<meta name="twitter:description" content="${escDesc}" />
<meta name="twitter:image" content="${escImg}" />
<meta name="theme-color" content="#0b0b0f" />
</head>
<body style="margin:0;background:#0b0b0f;color:#e8e8ec;font-family:system-ui,sans-serif;padding:2rem;line-height:1.5">
<p style="max-width:28rem"><a href="${escUrl}" style="color:#93c5fd">Continue to verification</a> — you will sign in with Discord on the next screen.</p>
</body>
</html>`;
}

export default function middleware(request: Request): Response | Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/verify/')) {
    return fetch(request);
  }
  const afterPrefix = path.slice('/verify/'.length);
  if (!afterPrefix || afterPrefix.includes('/')) {
    return fetch(request);
  }

  const ua = request.headers.get('user-agent') ?? '';
  if (!EMBED_UA.test(ua)) {
    return fetch(request);
  }

  const canonicalUrl = `${url.origin}${url.pathname}${url.search}`;
  /** Wide screenshot read by Discord/Facebook crawlers (no JS). Keep file in `public/`. */
  const imageUrl = `${url.origin}/share-verify-preview.png`;

  return new Response(embedHtml(canonicalUrl, imageUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
