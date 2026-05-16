/**
 * Serves `dist/` (after `vite build`) and same-origin `/api/*` proxies to Supabase Edge Functions.
 * Set the same `VITE_*` variables in the process environment at runtime so `/api/*` handlers can forward requests.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCrawlerOgResponse } from './ogCrawler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

type ApiHandler = (req: Request) => Response | Promise<Response>;

const API_LOADERS: Record<string, () => Promise<ApiHandler>> = {
  'canary-session': async () => (await import('../api/canary-session.ts')).default,
  'discord-oauth': async () => (await import('../api/discord-oauth.ts')).default,
  'discord-guilds': async () => (await import('../api/discord-guilds.ts')).default,
  'discord-profile-media': async () => (await import('../api/discord-profile-media.ts')).default,
  'experience-verify': async () => (await import('../api/experience-verify.ts')).default,
  'roblox-oauth-complete': async () => (await import('../api/roblox-oauth-complete.ts')).default,
  'roblox-oauth-start': async () => (await import('../api/roblox-oauth-start.ts')).default,
  'roblox-user-public': async () => (await import('../api/roblox-user-public.ts')).default,
  'site-owner-staff-role': async () => (await import('../api/site-owner-staff-role.ts')).default,
  'staff-directory-action': async () => (await import('../api/staff-directory-action.ts')).default,
  'staff-moderation-action': async () => (await import('../api/staff-moderation-action.ts')).default,
  'staff-server-claim-action': async () => (await import('../api/staff-server-claim-action.ts')).default,
  'submit-report': async () => (await import('../api/submit-report.ts')).default,
  'submit-server-claim': async () => (await import('../api/submit-server-claim.ts')).default,
  'sync-discord-tokens': async () => (await import('../api/sync-discord-tokens.ts')).default,
  'server-review-notify': async () => (await import('../api/server-review-notify.ts')).default,
  'upload-server-gallery': async () => (await import('../api/upload-server-gallery.ts')).default,
  'verify-roblox-pro': async () => (await import('../api/verify-roblox-pro.ts')).default,
};

const handlerMemo = new Map<string, ApiHandler>();

async function getApiHandler(name: string): Promise<ApiHandler | null> {
  const loader = API_LOADERS[name];
  if (!loader) return null;
  let h = handlerMemo.get(name);
  if (!h) {
    h = await loader();
    handlerMemo.set(name, h);
  }
  return h;
}

function getRequestOrigin(req: IncomingMessage): string {
  const xfProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const proto = xfProto === 'https' || xfProto === 'http' ? xfProto : 'http';
  const xfHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const host = xfHost || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

async function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function incomingToRequest(req: IncomingMessage, baseOrigin: string): Promise<Request> {
  const rawUrl = req.url || '/';
  const url = new URL(rawUrl, baseOrigin);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else {
      headers.set(k, v);
    }
  }
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }
  const body = await readBodyBuffer(req);
  return new Request(url, { method, headers, body: body.length ? new Uint8Array(body) : undefined });
}

async function sendWebResponse(res: ServerResponse, web: Response): Promise<void> {
  res.statusCode = web.status;
  web.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (web.body) {
    const buf = Buffer.from(await web.arrayBuffer());
    res.end(buf);
  } else {
    res.end();
  }
}

function safeResolvedPath(distDir: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (decoded.includes('..')) return null;
  const joined = path.join(distDir, decoded);
  const distResolved = path.resolve(distDir);
  const resolved = path.resolve(joined);
  if (!resolved.startsWith(distResolved + path.sep) && resolved !== distResolved) {
    return null;
  }
  return resolved;
}

async function trySendFile(
  res: ServerResponse,
  filePath: string,
  method: string,
): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const buf = method === 'HEAD' ? null : await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(method === 'HEAD' ? undefined : buf);
    return true;
  } catch {
    return false;
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const baseOrigin = getRequestOrigin(req);
  const u = new URL(req.url || '/', baseOrigin);
  const pathname = u.pathname;

  if (pathname.startsWith('/api/')) {
    const seg = pathname.slice('/api/'.length).replace(/\/$/, '');
    const name = seg.split('/')[0];
    const handler = await getApiHandler(name);
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown API route' }));
      return;
    }
    const webReq = await incomingToRequest(req, baseOrigin);
    const webRes = await handler(webReq);
    await sendWebResponse(res, webRes);
    return;
  }

  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/share-verify-preview.png') {
    const embed = path.join(DIST, 'embed.png');
    if (await trySendFile(res, embed, method)) return;
  }

  if (method === 'GET' || method === 'HEAD') {
    const webReq = await incomingToRequest(req, baseOrigin);
    const og = await getCrawlerOgResponse(webReq);
    if (og) {
      await sendWebResponse(res, og);
      return;
    }
  }

  const filePath = safeResolvedPath(DIST, pathname);
  if (filePath && (await trySendFile(res, filePath, method))) {
    return;
  }

  const ext = path.extname(pathname);
  if (ext && ext !== '') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const indexHtml = path.join(DIST, 'index.html');
  if (await trySendFile(res, indexHtml, method)) {
    return;
  }

  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Missing dist/index.html — run vite build first.');
}

const port = Number(process.env.PORT) || 3000;

createServer((req, res) => {
  void handleRequest(req, res).catch((err) => {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`Listening on http://0.0.0.0:${port} (dist: ${DIST})`);
});
