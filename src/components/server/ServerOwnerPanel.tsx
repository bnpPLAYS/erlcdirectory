import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Loader2,
  Palette,
  Save,
  Trash2,
  Link2,
  Eye,
  EyeOff,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { uploadServerGalleryImage } from '@/lib/callServerOwnerApi';
import { discordInviteLooksValid } from '@/lib/discordInvite';
import { extractYouTubeId } from '@/lib/youtubeEmbed';

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
};

export function ServerOwnerPanel({ server, ownerIsPro, coworkers, onPatch }: Props) {
  const [open, setOpen] = useState(true);
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
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <Card className="card-elevated border-white/10 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Owner customization</span>
              <span className="text-xs text-muted-foreground">(invite, page copy, theme, gallery, webhook)</span>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-6 border-t border-white/10">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Discord invite (only you can edit)</Label>
              <Input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="https://discord.gg/…"
                className="bg-background/60 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Long description (shown instead of short blurb when set)</Label>
              <Textarea
                value={longDesc}
                onChange={(e) => setLongDesc(e.target.value)}
                rows={6}
                maxLength={MAX_DESC}
                className="bg-background/60 border-white/10 resize-y min-h-[140px]"
              />
              <p className="text-[11px] text-muted-foreground">
                {longDesc.length} / {MAX_DESC}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Accent color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : '#a1a1aa'}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-9 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                    aria-label="Accent color"
                  />
                  <Input
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    placeholder="#a1a1aa"
                    className="bg-background/60 border-white/10 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Theme preset</Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger className="bg-background/60 border-white/10">
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
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <ImagePlus className="h-3.5 w-3.5" /> Gallery
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {ownerIsPro ? 'Up to 12 images (Pro).' : 'Up to 6 images. Pro owners can use up to 12.'} Drag the handle to
                reorder, or drop a file on the dashed area.
              </p>
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
                className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-6 text-center text-xs text-muted-foreground"
              >
                Drop an image here, or use Add image
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="relative border-white/12" disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={onPickImage}
                    disabled={uploading}
                  />
                </Button>
              </div>
              {galleryUrls.length > 0 ? (
                <ul className="space-y-2 mt-2">
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
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2"
                    >
                      <button
                        type="button"
                        className="cursor-grab active:cursor-grabbing text-muted-foreground p-1 touch-none"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <img src={url} alt="" className="h-14 w-24 object-cover rounded border border-white/10 no-image-drag" draggable={false} />
                      <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{url}</span>
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

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" /> Review Discord webhook
              </Label>
              <Input
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/…"
                className="bg-background/60 border-white/10 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When someone posts a new review, we send a short embed with a link back to this server page. Leave empty to disable.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 p-3">
              <p className="text-xs font-medium text-foreground">Review Discord embed</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Customize the embed color and footer on the notification sent to your webhook (Discord limit {MAX_EMBED_FOOTER}{' '}
                chars on footer).
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Embed color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(embedColorHex) ? embedColorHex : DEFAULT_REVIEW_EMBED_HEX}
                      onChange={(e) => setEmbedColorHex(e.target.value)}
                      className="h-9 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                      aria-label="Discord review embed color"
                    />
                    <Input
                      value={embedColorHex}
                      onChange={(e) => setEmbedColorHex(e.target.value)}
                      placeholder={DEFAULT_REVIEW_EMBED_HEX}
                      className="bg-background/60 border-white/10 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Embed footer</Label>
                  <Input
                    value={embedFooter}
                    onChange={(e) => setEmbedFooter(e.target.value.slice(0, MAX_EMBED_FOOTER))}
                    placeholder="e.g. Your server name · reviews"
                    className="bg-background/60 border-white/10 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {embedFooter.length} / {MAX_EMBED_FOOTER}
                  </p>
                </div>
              </div>
            </div>

            {ownerIsPro ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <Youtube className="h-3.5 w-3.5" /> Hero video (YouTube only, Pro)
                </Label>
                <Input
                  value={heroVideo}
                  onChange={(e) => setHeroVideo(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="bg-background/60 border-white/10"
                />
              </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-white/10 p-3">
              <p className="text-xs font-medium text-foreground">Public page sections</p>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {showStaff ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Show “Members who work here”
                </span>
                <Switch checked={showStaff} onCheckedChange={setShowStaff} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {showReviews ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Show reviews block
                </span>
                <Switch checked={showReviews} onCheckedChange={setShowReviews} />
              </label>
            </div>

            {verifiedCoworkers.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hide verified members from the public list</Label>
                <p className="text-[11px] text-muted-foreground">They still keep their experience; they just won’t show on this server’s directory card.</p>
                <div className="rounded-xl border border-white/10 divide-y divide-white/10 max-h-48 overflow-y-auto">
                  {verifiedCoworkers.map((c) => (
                    <label key={c.profileId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03]">
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
            ) : null}

            <Button type="button" className="gap-2" onClick={() => void onSaveAll()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
