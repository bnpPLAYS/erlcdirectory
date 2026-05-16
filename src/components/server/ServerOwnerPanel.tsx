import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  ImagePlus,
  Loader2,
  Link2,
  Palette,
  Save,
  Trash2,
  Type,
  Eye,
  EyeOff,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadServerGalleryImage } from '@/lib/callServerOwnerApi';
import { discordInviteLooksValid } from '@/lib/discordInvite';
import { extractYouTubeId } from '@/lib/youtubeEmbed';
import { cn } from '@/lib/utils';

const PRESETS_FREE = ['zinc', 'slate', 'neutral'] as const;
const PRESETS_PRO = ['rose', 'cyan', 'amber', 'violet'] as const;
const MAX_DESC = 8000;
const MAX_EMBED_FOOTER = 200;
const DEFAULT_REVIEW_EMBED_HEX = '#5865f2';

function discordEmbedIntFromHex(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  return parseInt(m[1], 16);
}

function hexFromDiscordEmbedInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DEFAULT_REVIEW_EMBED_HEX;
  const c = Math.max(0, Math.min(0xffffff, Math.floor(n)));
  return `#${c.toString(16).padStart(6, '0')}`;
}

const blockCard = 'rounded-md border border-white/10 bg-zinc-950/70 p-4 shadow-sm';
const blockInput =
  'rounded-md border border-white/10 bg-black/45 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-white/20';

function parseJsonStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter((s) => s.length > 0);
}

function isDiscordWebhookUrl(u: string): boolean {
  try {
    const x = new URL(u.trim());
    if (x.protocol !== 'https:') return false;
    const h = x.hostname.toLowerCase();
    if (h !== 'discord.com' && h !== 'discordapp.com') return false;
    return /^\/api\/webhooks\/\d+\/[\w-]+$/.test(x.pathname);
  } catch {
    return false;
  }
}

export type ServerOwnerPanelCoworker = {
  profileId: string;
  label: string;
  isVerified: boolean;
};

export type ServerOwnerPanelServer = {
  id: string;
  discord_invite: string | null;
  owner_long_description: string | null;
  owner_accent_hex: string | null;
  owner_theme_preset: string | null;
  owner_gallery_urls: unknown;
  owner_review_webhook_url: string | null;
  owner_discord_embed_color: number | null;
  owner_discord_embed_footer: string | null;
  owner_hidden_staff_profile_ids: unknown;
  owner_show_staff_section: boolean | null;
  owner_show_reviews_section: boolean | null;
  owner_hero_video_url: string | null;
};

type Props = {
  server: ServerOwnerPanelServer;
  ownerIsPro: boolean;
  coworkers: ServerOwnerPanelCoworker[];
  onPatch: (patch: Partial<ServerOwnerPanelServer>) => void;
  className?: string;
};

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function FieldCard({
  icon: Icon,
  label,
  hint,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(blockCard, 'flex flex-col gap-3', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ServerOwnerPanel({ server, ownerIsPro, coworkers, onPatch, className }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragGalleryIdx, setDragGalleryIdx] = useState<number | null>(null);

  const [longDesc, setLongDesc] = useState(server.owner_long_description ?? '');
  const [accent, setAccent] = useState(server.owner_accent_hex ?? '#a1a1aa');
  const [preset, setPreset] = useState(server.owner_theme_preset || 'zinc');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(() => parseJsonStringArray(server.owner_gallery_urls));
  const [webhook, setWebhook] = useState(server.owner_review_webhook_url ?? '');
  const [embedColorHex, setEmbedColorHex] = useState(() => hexFromDiscordEmbedInt(server.owner_discord_embed_color));
  const [embedFooter, setEmbedFooter] = useState(server.owner_discord_embed_footer ?? '');
  const [invite, setInvite] = useState(server.discord_invite ?? '');
  const [showStaff, setShowStaff] = useState(server.owner_show_staff_section !== false);
  const [showReviews, setShowReviews] = useState(server.owner_show_reviews_section !== false);
  const [heroVideo, setHeroVideo] = useState(server.owner_hero_video_url ?? '');
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(parseJsonStringArray(server.owner_hidden_staff_profile_ids)),
  );

  useEffect(() => {
    setLongDesc(server.owner_long_description ?? '');
    setAccent(server.owner_accent_hex ?? '#a1a1aa');
    setPreset(server.owner_theme_preset || 'zinc');
    setGalleryUrls(parseJsonStringArray(server.owner_gallery_urls));
    setWebhook(server.owner_review_webhook_url ?? '');
    setEmbedColorHex(hexFromDiscordEmbedInt(server.owner_discord_embed_color));
    setEmbedFooter(server.owner_discord_embed_footer ?? '');
    setInvite(server.discord_invite ?? '');
    setShowStaff(server.owner_show_staff_section !== false);
    setShowReviews(server.owner_show_reviews_section !== false);
    setHeroVideo(server.owner_hero_video_url ?? '');
    setHiddenIds(new Set(parseJsonStringArray(server.owner_hidden_staff_profile_ids)));
  }, [server]);

  useEffect(() => {
    if (!ownerIsPro && PRESETS_PRO.includes(preset as (typeof PRESETS_PRO)[number])) {
      setPreset('zinc');
    }
  }, [ownerIsPro, preset]);

  const presetOptions = useMemo(() => {
    return [...PRESETS_FREE, ...(ownerIsPro ? PRESETS_PRO : [])];
  }, [ownerIsPro]);

  const verifiedCoworkers = useMemo(
    () => coworkers.filter((c) => c.isVerified && c.profileId),
    [coworkers],
  );

  const copyInvite = async () => {
    const t = invite.trim();
    if (!t) {
      toast.message('Nothing to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(t);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  const persistGalleryUrls = async (next: string[]) => {
    const prev = galleryUrls;
    setGalleryUrls(next);
    const { error } = await supabase.from('servers').update({ owner_gallery_urls: next }).eq('id', server.id);
    if (error) {
      toast.error(error.message);
      setGalleryUrls(prev);
      return false;
    }
    onPatch({ owner_gallery_urls: next });
    return true;
  };

  const uploadGalleryFile = async (file: File) => {
    setUploading(true);
    try {
      const r = await uploadServerGalleryImage(server.id, file);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const next = [...galleryUrls, r.url];
      const ok = await persistGalleryUrls(next);
      if (ok) toast.success('Image added');
    } finally {
      setUploading(false);
    }
  };

  const reorderGallery = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= galleryUrls.length || to >= galleryUrls.length) return;
    const next = [...galleryUrls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void persistGalleryUrls(next);
  };

  const persist = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('servers').update(patch).eq('id', server.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      onPatch(patch as Partial<ServerOwnerPanelServer>);
      toast.success('Saved');
    } finally {
      setSaving(false);
    }
  };

  const onSaveAll = async () => {
    if (longDesc.length > MAX_DESC) {
      toast.error(`Description is too long (max ${MAX_DESC} characters).`);
      return;
    }
    const wh = webhook.trim();
    if (wh && !isDiscordWebhookUrl(wh)) {
      toast.error('Webhook must be a https://discord.com/api/webhooks/… URL.');
      return;
    }
    const embedInt = discordEmbedIntFromHex(embedColorHex.trim() || DEFAULT_REVIEW_EMBED_HEX);
    if (embedInt == null) {
      toast.error('Review embed color must be a #RRGGBB hex value.');
      return;
    }
    const foot = embedFooter.trim().slice(0, MAX_EMBED_FOOTER);
    const inv = invite.trim();
    if (inv && !discordInviteLooksValid(inv)) {
      toast.error('Invite must look like a real Discord invite link or code.');
      return;
    }
    let hero: string | null = heroVideo.trim() || null;
    if (hero && ownerIsPro) {
      if (!extractYouTubeId(hero)) {
        toast.error('Hero video must be a YouTube watch or youtu.be link.');
        return;
      }
    } else if (!ownerIsPro) {
      hero = null;
    }

    const safePreset = presetOptions.includes(
      preset as (typeof PRESETS_FREE)[number] | (typeof PRESETS_PRO)[number],
    )
      ? preset
      : 'zinc';

    const accentHex: string | null = accent.trim() || null;
    if (accentHex && !/^#[0-9A-Fa-f]{6}$/.test(accentHex)) {
      toast.error('Accent must be a #RRGGBB color.');
      return;
    }

    await persist({
      owner_long_description: longDesc.trim() || null,
      owner_accent_hex: accentHex,
      owner_theme_preset: safePreset,
      owner_gallery_urls: galleryUrls,
      owner_review_webhook_url: wh || null,
      owner_discord_embed_color: embedInt,
      owner_discord_embed_footer: foot || null,
      owner_hidden_staff_profile_ids: [...hiddenIds],
      owner_show_staff_section: showStaff,
      owner_show_reviews_section: showReviews,
      owner_hero_video_url: ownerIsPro ? hero : null,
      discord_invite: inv || null,
    });
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void uploadGalleryFile(file);
  };

  const removeGalleryAt = (idx: number) => {
    const next = galleryUrls.filter((_, i) => i !== idx);
    void persistGalleryUrls(next);
  };

  const moveGallery = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= galleryUrls.length) return;
    reorderGallery(idx, j);
  };

  return (
    <div className={cn('space-y-10', className)}>
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80">
          <Palette className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Server customization</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Update your public server page: invite, copy, visuals, gallery, and review notifications in one place.
          </p>
        </div>
      </header>

      <section>
        <SectionTitle
          title="Server page"
          description="What visitors see on your directory listing and server detail page."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldCard
            icon={Link2}
            label="Discord invite"
            hint="Only you can change this after claiming. Users tap Join from your card."
          >
            <div className="flex gap-2">
              <Input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="https://discord.gg/…"
                className={cn(blockInput, 'flex-1 font-mono text-xs')}
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0 border-white/10 bg-black/30" onClick={() => void copyInvite()}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy invite</span>
              </Button>
            </div>
          </FieldCard>
          <FieldCard
            icon={Type}
            label="Long description"
            hint="Optional. When set, this replaces the short blurb on your server page."
          >
            <Textarea
              value={longDesc}
              onChange={(e) => setLongDesc(e.target.value)}
              rows={6}
              maxLength={MAX_DESC}
              className={cn(blockInput, 'min-h-[140px] resize-y text-sm')}
            />
            <p className="text-[11px] text-muted-foreground">
              {longDesc.length} / {MAX_DESC}
            </p>
          </FieldCard>
        </div>
      </section>

      <section>
        <SectionTitle title="Look & theme" description="Accent and preset control highlights and gradients on the page." />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldCard icon={Palette} label="Accent color" hint="Use a hex color that matches your community brand.">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : '#a1a1aa'}
                onChange={(e) => setAccent(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-white/10 bg-transparent"
                aria-label="Accent color"
              />
              <Input
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                placeholder="#a1a1aa"
                className={cn(blockInput, 'min-w-[8rem] flex-1 font-mono text-sm')}
              />
            </div>
          </FieldCard>
          <FieldCard icon={Palette} label="Theme preset" hint="Pro unlocks extra presets beyond the free set.">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className={blockInput}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                    {!PRESETS_FREE.includes(p as (typeof PRESETS_FREE)[number]) ? ' (Pro)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCard>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Gallery & media"
          description={ownerIsPro ? 'Up to 12 images (Pro). Drag to reorder or drop files on the zone.' : 'Up to 6 images. Pro owners can use up to 12.'}
        />
        <div className={blockCard}>
          <div className="mb-3 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Screenshots</p>
              <p className="text-xs text-muted-foreground">Square or wide images both work. PNG, JPEG, WebP, or GIF.</p>
            </div>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f && /^image\//.test(f.type)) void uploadGalleryFile(f);
            }}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/20 bg-black/25 px-4 py-8 text-center"
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground/80" />
            <p className="text-xs text-muted-foreground">Drop file here or use Add image</p>
            <Button type="button" variant="outline" size="sm" className="relative mt-1 border-white/12 bg-zinc-900/60" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={onPickImage}
                disabled={uploading}
              />
            </Button>
          </div>
          {galleryUrls.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {galleryUrls.map((url, idx) => (
                <li
                  key={`${url}-${idx}`}
                  draggable
                  onDragStart={() => setDragGalleryIdx(idx)}
                  onDragEnd={() => setDragGalleryIdx(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragGalleryIdx;
                    setDragGalleryIdx(null);
                    if (from === null) return;
                    reorderGallery(from, idx);
                  }}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 p-2"
                >
                  <button
                    type="button"
                    className="cursor-grab touch-none p-1 text-muted-foreground active:cursor-grabbing"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <img src={url} alt="" className="no-image-drag h-14 w-24 rounded border border-white/10 object-cover" draggable={false} />
                  <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</span>
                  <div className="flex flex-col gap-0.5">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveGallery(idx, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveGallery(idx, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeGalleryAt(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle
          title="Integrations"
          description="Discord webhook for new reviews, embed styling, and optional Pro hero video."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldCard
            icon={Link2}
            label="Review Discord webhook"
            hint="We post a short embed with a link when someone leaves a review. Leave empty to disable."
            className="md:col-span-2"
          >
            <Input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className={cn(blockInput, 'font-mono text-xs')}
            />
          </FieldCard>
          <FieldCard
            icon={Palette}
            label="Review embed color"
            hint="Accent color for the Discord notification embed (#RRGGBB)."
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(embedColorHex) ? embedColorHex : DEFAULT_REVIEW_EMBED_HEX}
                onChange={(e) => setEmbedColorHex(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-white/10 bg-transparent"
                aria-label="Discord review embed color"
              />
              <Input
                value={embedColorHex}
                onChange={(e) => setEmbedColorHex(e.target.value)}
                placeholder={DEFAULT_REVIEW_EMBED_HEX}
                className={cn(blockInput, 'min-w-[8rem] flex-1 font-mono text-sm')}
              />
            </div>
          </FieldCard>
          <FieldCard
            icon={Type}
            label="Review embed footer"
            hint={`Short footer under the embed (Discord limit ${MAX_EMBED_FOOTER} characters).`}
          >
            <Input
              value={embedFooter}
              onChange={(e) => setEmbedFooter(e.target.value.slice(0, MAX_EMBED_FOOTER))}
              placeholder="e.g. Your server name · reviews"
              className={cn(blockInput, 'text-sm')}
            />
            <p className="text-[11px] text-muted-foreground">
              {embedFooter.length} / {MAX_EMBED_FOOTER}
            </p>
          </FieldCard>
          {ownerIsPro ? (
            <FieldCard
              icon={Youtube}
              label="Hero video"
              hint="YouTube watch or youtu.be link only. Shown prominently for Pro listings."
              className="md:col-span-2"
            >
              <Input
                value={heroVideo}
                onChange={(e) => setHeroVideo(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className={cn(blockInput, 'text-sm')}
              />
            </FieldCard>
          ) : (
            <div className={cn(blockCard, 'flex flex-col justify-center md:col-span-2')}>
              <p className="text-sm font-medium text-foreground">Hero video</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Upgrade to Pro to feature a YouTube hero on your server page.
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionTitle title="Visibility" description="Control which blocks appear on the public server page." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn(blockCard, 'space-y-4')}>
            <p className="text-sm font-medium text-foreground">Public sections</p>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                {showStaff ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                Show “Members who work here”
              </span>
              <Switch checked={showStaff} onCheckedChange={setShowStaff} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                {showReviews ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                Show reviews block
              </span>
              <Switch checked={showReviews} onCheckedChange={setShowReviews} />
            </label>
          </div>
          {verifiedCoworkers.length > 0 ? (
            <div className={cn(blockCard, 'flex flex-col gap-3')}>
              <div>
                <p className="text-sm font-medium text-foreground">Hidden verified members</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  They keep their experience; they won’t appear on this server’s public staff list.
                </p>
              </div>
              <div className="max-h-48 divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10 bg-black/25">
                {verifiedCoworkers.map((c) => (
                  <label
                    key={c.profileId}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-white/[0.04]"
                  >
                    <span className="truncate">{c.label}</span>
                    <Switch
                      checked={hiddenIds.has(c.profileId)}
                      onCheckedChange={(on) => {
                        setHiddenIds((prev) => {
                          const n = new Set(prev);
                          if (on) n.add(c.profileId);
                          else n.delete(c.profileId);
                          return n;
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className={cn(blockCard, 'flex items-center text-xs text-muted-foreground')}>
              No verified coworkers to hide yet.
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
        <Button type="button" className="gap-2" onClick={() => void onSaveAll()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
        <p className="text-[11px] text-muted-foreground">Gallery uploads save immediately; other fields apply when you save.</p>
      </div>
    </div>
  );
}
