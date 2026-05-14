import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Plus, Trash2, Upload, Paintbrush, Webhook, Sparkles, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  SERVER_THEME_PALETTES,
  SERVER_THEME_PRO_PALETTES,
  ServerGalleryItem,
  ServerLayout,
  ServerTheme,
  MAX_GALLERY_PRO,
  MAX_GALLERY_STANDARD,
  isValidDiscordWebhookUrl,
  sanitizeServerGallery,
  sanitizeServerLayout,
  sanitizeServerTheme,
  DEFAULT_LAYOUT,
} from '@/lib/serverTheme';
import { imageFileToGalleryDataUrl } from '@/lib/processGalleryImage';
import { discordInviteLooksValid, normalizeDiscordInvite } from '@/lib/discordInvite';

type Props = {
  serverId: string;
  initial: {
    long_description: string | null;
    theme: ServerTheme | null;
    gallery: ServerGalleryItem[];
    layout: ServerLayout | null;
    review_webhook_url: string | null;
    discord_invite: string | null;
  };
  ownerIsPro: boolean;
  /** Called after a successful save with the new persisted values. */
  onSaved?: (next: {
    long_description: string | null;
    theme: ServerTheme;
    gallery: ServerGalleryItem[];
    layout: ServerLayout;
    review_webhook_url: string | null;
    discord_invite: string | null;
  }) => void;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function ServerOwnerPanel({ serverId, initial, ownerIsPro, onSaved }: Props) {
  const [longDescription, setLongDescription] = useState(initial.long_description ?? '');
  const [theme, setTheme] = useState<ServerTheme>(initial.theme ?? {});
  const [gallery, setGallery] = useState<ServerGalleryItem[]>(initial.gallery ?? []);
  const [layout, setLayout] = useState<ServerLayout>(initial.layout ?? {});
  const [webhook, setWebhook] = useState(initial.review_webhook_url ?? '');
  const [invite, setInvite] = useState(initial.discord_invite ?? '');
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const maxGallery = ownerIsPro ? MAX_GALLERY_PRO : MAX_GALLERY_STANDARD;
  const palettes = useMemo(
    () => (ownerIsPro ? [...SERVER_THEME_PALETTES, ...SERVER_THEME_PRO_PALETTES] : SERVER_THEME_PALETTES),
    [ownerIsPro],
  );

  useEffect(() => {
    setLongDescription(initial.long_description ?? '');
    setTheme(sanitizeServerTheme(initial.theme));
    setGallery(sanitizeServerGallery(initial.gallery, maxGallery));
    setLayout(sanitizeServerLayout(initial.layout));
    setWebhook(initial.review_webhook_url ?? '');
    setInvite(initial.discord_invite ?? '');
  }, [
    initial.long_description,
    initial.theme,
    initial.gallery,
    initial.layout,
    initial.review_webhook_url,
    initial.discord_invite,
    maxGallery,
  ]);

  const applyPalette = (paletteId: string) => {
    const all = palettes;
    const found = all.find((p) => p.id === paletteId);
    if (!found) return;
    setTheme((t) => ({
      ...t,
      palette_id: found.id,
      accent_hex: found.accent,
      secondary_hex: found.secondary,
      pro_palette: ownerIsPro && SERVER_THEME_PRO_PALETTES.some((p) => p.id === paletteId),
    }));
  };

  const addFiles = async (files: FileList | File[] | null | undefined) => {
    if (!files) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    const room = maxGallery - gallery.length;
    if (room <= 0) {
      toast.error(`Up to ${maxGallery} images${ownerIsPro ? '' : ' on standard plan'}.`);
      return;
    }
    const slice = arr.slice(0, room);
    const next: ServerGalleryItem[] = [...gallery];
    for (const file of slice) {
      try {
        const url = await imageFileToGalleryDataUrl(file);
        next.push({ url, caption: '' });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not process image.');
      }
    }
    setGallery(next);
  };

  const save = async () => {
    const cleanTheme = sanitizeServerTheme(theme);
    const cleanLayout = sanitizeServerLayout({ ...DEFAULT_LAYOUT, ...layout });
    const cleanGallery = sanitizeServerGallery(gallery, maxGallery);

    let normWebhook: string | null = webhook.trim() || null;
    if (normWebhook && !isValidDiscordWebhookUrl(normWebhook)) {
      toast.error('Webhook must be a valid https://discord.com/api/webhooks/… URL.');
      return;
    }

    let normInvite: string | null = invite.trim() || null;
    if (normInvite && !discordInviteLooksValid(normInvite)) {
      toast.error('Use a discord.gg link, discord.com/invite/…, or invite code.');
      return;
    }
    if (normInvite) normInvite = normalizeDiscordInvite(normInvite) || normInvite;

    setBusy(true);
    const { error } = await supabase
      .from('servers')
      .update({
        long_description: longDescription.trim() ? longDescription.trim().slice(0, 8000) : null,
        theme: cleanTheme as unknown as never,
        layout: cleanLayout as unknown as never,
        gallery: cleanGallery as unknown as never,
        review_webhook_url: normWebhook,
        discord_invite: normInvite,
      } as never)
      .eq('id', serverId);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Server page updated.');
    onSaved?.({
      long_description: longDescription.trim() ? longDescription.trim().slice(0, 8000) : null,
      theme: cleanTheme,
      gallery: cleanGallery,
      layout: cleanLayout,
      review_webhook_url: normWebhook,
      discord_invite: normInvite,
    });
  };

  const setLayoutFlag = (key: keyof ServerLayout, value: boolean) => {
    setLayout((l) => ({ ...l, [key]: value }));
  };

  return (
    <Card className="card-elevated">
      <CardContent className="p-5 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 opacity-80" />
          <h3 className="text-lg font-semibold">Customize this server page</h3>
          {ownerIsPro && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-300/15 text-amber-100 px-2 py-0.5 text-[11px] font-medium">
              <Sparkles className="h-3 w-3" /> Pro extras unlocked
            </span>
          )}
        </div>

        {/* Description */}
        <section className="space-y-2">
          <Label htmlFor="srv-long-desc">Long description</Label>
          <Textarea
            id="srv-long-desc"
            rows={5}
            maxLength={8000}
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            placeholder="Tell visitors what this server is about: theme, region, vibe, how to apply, perks…"
            className="border-white/12 bg-background/80 text-sm resize-none"
          />
          <p className="text-[11px] text-muted-foreground">{longDescription.trim().length}/8000</p>
        </section>

        {/* Discord invite (owner only) */}
        <section className="space-y-2">
          <Label htmlFor="srv-invite">Discord invite</Label>
          <Input
            id="srv-invite"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="https://discord.gg/… or invite code"
            className="border-white/12 bg-background/80"
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground">
            Only the claimed owner can update the invite from now on.
          </p>
        </section>

        {/* Theme */}
        <section className="space-y-3">
          <Label>Color scheme</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {palettes.map((p) => {
              const isActive = theme.palette_id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPalette(p.id)}
                  className={cn(
                    'group rounded-xl border p-3 text-left transition-colors',
                    isActive
                      ? 'border-white/40 bg-white/[0.08]'
                      : 'border-white/12 bg-background/60 hover:border-white/25',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full ring-1 ring-white/20"
                      style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.secondary})` }}
                    />
                    <span className="text-sm font-medium">{p.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="srv-accent" className="text-xs uppercase tracking-wide text-muted-foreground">
                Accent (hex)
              </Label>
              <Input
                id="srv-accent"
                value={theme.accent_hex ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setTheme((t) => ({
                    ...t,
                    accent_hex: HEX_RE.test(v) ? v.toLowerCase() : v.length ? t.accent_hex : undefined,
                    palette_id: undefined,
                  }));
                }}
                placeholder="#6366f1"
                className="border-white/12 bg-background/80"
                maxLength={7}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="srv-secondary" className="text-xs uppercase tracking-wide text-muted-foreground">
                Secondary (hex)
              </Label>
              <Input
                id="srv-secondary"
                value={theme.secondary_hex ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setTheme((t) => ({
                    ...t,
                    secondary_hex: HEX_RE.test(v) ? v.toLowerCase() : v.length ? t.secondary_hex : undefined,
                    palette_id: undefined,
                  }));
                }}
                placeholder="#a855f7"
                className="border-white/12 bg-background/80"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <Label htmlFor="srv-overlay" className="text-xs uppercase tracking-wide text-muted-foreground">
              Banner overlay strength ({(theme.banner_overlay ?? 0.4).toFixed(2)})
            </Label>
            <input
              id="srv-overlay"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={theme.banner_overlay ?? 0.4}
              onChange={(e) =>
                setTheme((t) => ({ ...t, banner_overlay: parseFloat(e.target.value) }))
              }
              className="w-full accent-white"
            />
          </div>
        </section>

        {/* Gallery */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Gallery ({gallery.length}/{maxGallery})</Label>
            {!ownerIsPro && (
              <span className="text-[11px] text-muted-foreground">Pro: up to {MAX_GALLERY_PRO}</span>
            )}
          </div>
          <button
            type="button"
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'w-full rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer',
              dropActive
                ? 'border-white/45 bg-white/[0.08]'
                : 'border-white/18 bg-black/25 hover:border-white/30 hover:bg-white/[0.04]',
            )}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop images here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-cropped to 16:9 landscape. JPG output.</p>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {gallery.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gallery.map((g, i) => (
                <div key={`${g.url.slice(0, 32)}-${i}`} className="rounded-xl border border-white/12 overflow-hidden bg-black/20">
                  <div className="aspect-video">
                    <img
                      src={g.url}
                      alt={g.caption || `Gallery ${i + 1}`}
                      draggable={false}
                      className="h-full w-full object-cover no-image-drag"
                    />
                  </div>
                  <div className="p-2 flex items-center gap-2">
                    <Input
                      value={g.caption ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 240);
                        setGallery((arr) => arr.map((it, idx) => (idx === i ? { ...it, caption: v } : it)));
                      }}
                      placeholder="Caption (optional)"
                      className="border-white/12 bg-background/80 h-8 text-xs"
                      maxLength={240}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 text-destructive"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Webhook */}
        <section className="space-y-2">
          <Label htmlFor="srv-webhook" className="flex items-center gap-2">
            <Webhook className="h-4 w-4 opacity-70" /> Discord review webhook
          </Label>
          <Input
            id="srv-webhook"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="border-white/12 bg-background/80"
            maxLength={400}
          />
          <p className="text-[11px] text-muted-foreground">
            We post a clean embed (with a link to your server's directory page) to this channel whenever
            someone reviews this server. Leave empty to disable.
          </p>
        </section>

        {/* Layout flags */}
        <section className="space-y-3">
          <Label className="flex items-center gap-2">
            <Eye className="h-4 w-4 opacity-70" /> Visible sections
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                ['show_long_description', 'Long description'],
                ['show_gallery', 'Gallery'],
                ['show_members', 'Members who work here'],
                ['show_reviews', 'Reviews'],
              ] as Array<[keyof ServerLayout, string]>
            ).map(([key, label]) => {
              const current = layout[key];
              const value = current === undefined ? (DEFAULT_LAYOUT[key] as boolean) : !!current;
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-background/60 px-3 py-2"
                >
                  <span className="text-sm">{label}</span>
                  <Switch checked={value} onCheckedChange={(v) => setLayoutFlag(key, v)} />
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <EyeOff className="h-3 w-3" /> Hidden sections are skipped on the public page.
          </p>
        </section>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={() => void save()} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" />
            {busy ? 'Saving…' : 'Save server page'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
