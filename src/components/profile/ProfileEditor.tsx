import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Trash2,
  Save,
  X,
  Briefcase,
  Palette,
  User as UserIcon,
  Shield,
  BadgeCheck,
  Pencil,
  ImageIcon,
  RefreshCw,
  Upload,
  Sparkles,
  Bell,
  Eye,
  ChevronDown,
  Globe,
} from 'lucide-react';
import { z } from 'zod';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PRONOUN_PRESETS = ['he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'any/all'];
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { filterPlaintext } from '@/lib/chatFilter';
import VerifyExperienceDialog from './VerifyExperienceDialog';
import AddExperienceDialog from './AddExperienceDialog';
import { isPendingPlaceholderRole, PENDING_EXPERIENCE_ROLE } from '@/lib/experienceConstants';
import { ensureVerificationLink, copyTextToClipboard } from '@/lib/experienceVerificationLink';
import { cn } from '@/lib/utils';
import {
  PROFILE_LOCATION_GROUPS,
  normalizeStoredCounty,
  PROFILE_LOCATION_OPTIONS,
} from '@/lib/profileLocations';
import { isProfileDmPrefsSchemaError } from '@/lib/profileDmPrefsMigration';
import {
  invokeDiscordProfileMediaSync,
  type DiscordProfileMediaSyncMode,
} from '@/lib/callDiscordProfileMedia';
import { imageFileToBannerDataUrl } from '@/lib/processBannerImage';
import { ProfileSocialBadges } from '@/components/profile/ProfileSocialBadges';
import { discordUserProfileUrl } from '@/lib/discordProfileUrl';
import {
  PROFILE_SOCIAL_KEYS,
  PROFILE_SOCIAL_LABELS,
  type ProfileSocialKey,
  parseProfileSocialLinks,
  serializeProfileSocialLinks,
  normalizeSocialInputUrl,
} from '@/lib/profileSocialLinks';
import { safeAvatarUrl, avatarReferrerPolicy } from '@/lib/safeAvatarUrl';
import type { Json } from '@/integrations/supabase/types';

function buildSocialDraft(social: unknown): Record<ProfileSocialKey, string> {
  const parsed = parseProfileSocialLinks(social);
  return Object.fromEntries(PROFILE_SOCIAL_KEYS.map((k) => [k, parsed[k] ?? ''])) as Record<
    ProfileSocialKey,
    string
  >;
}

interface Experience {
  id: string;
  role: string;
  server_name: string;
  server_icon: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  is_verified: boolean;
  show_on_directory_card?: boolean;
  guild_id?: string | null;
  verifier_stated_position?: string | null;
  verifier_review_text?: string | null;
  verifier_review_rating?: number | null;
  verified_by_discord_username?: string | null;
}

interface ProfileLike {
  id: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  pronouns?: string | null;
  status?: string | null;
  availability?: string | null;
  website?: string | null;
  banner_url?: string | null;
  accent_color?: string | null;
  theme_preset?: string | null;
  discord_username?: string | null;
  discord_avatar?: string | null;
  discord_id?: string | null;
  social_links?: Json | null;
  dm_website_updates?: boolean | null;
  dm_experience_status_updates?: boolean | null;
  skills: string[];
}

const EDITOR_TABS = ['general', 'customize', 'experience'] as const;
type EditorTab = (typeof EDITOR_TABS)[number];

function parseEditorTab(t: string | undefined): EditorTab {
  if (t === 'socials') return 'general';
  if (t && (EDITOR_TABS as readonly string[]).includes(t)) return t as EditorTab;
  return 'general';
}

interface Props {
  profile: ProfileLike;
  experiences: Experience[];
  onSaved: () => void;
  onCancel: () => void;
  initialTab?: string;
  openAddExperienceOnMount?: boolean;
  onConsumedAddDeepLink?: () => void;
  /** Called after Discord banner/avatar sync so the parent can reload profile data. */
  onDiscordMediaSynced?: () => void;
}

const profileSchema = z.object({
  display_name: z.string().trim().max(60, 'Name must be 60 characters or fewer').optional(),
  bio: z.string().trim().max(500, 'Bio must be 500 characters or fewer').optional(),
  location: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || PROFILE_LOCATION_OPTIONS.includes(v), 'Choose a county or region from the list.'),
  timezone: z.string().trim().max(40).optional(),
  pronouns: z.string().trim().max(30).optional(),
  status: z.string().trim().max(140).optional(),
  availability: z.string().trim().max(40).optional(),
  banner_url: z
    .string()
    .trim()
    .max(4_000_000)
    .optional()
    .refine(
      (v) =>
        !v ||
        /^https?:\/\//i.test(v) ||
        /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(v),
      'Banner must be an https URL or an uploaded image.',
    ),
});

/** Shared field chrome — matches site dark glass UI (neutral white focus, not purple) */
const editorInput =
  'h-11 rounded-2xl border border-white/12 bg-white/[0.04] px-4 text-sm shadow-inner shadow-black/20 placeholder:text-muted-foreground/45 focus-visible:border-white/35 focus-visible:ring-2 focus-visible:ring-white/15';
const editorTextarea =
  'rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm min-h-[120px] resize-y shadow-inner shadow-black/20 placeholder:text-muted-foreground/45 focus-visible:border-white/35 focus-visible:ring-2 focus-visible:ring-white/15';
const editorSelect =
  'h-11 rounded-2xl border border-white/12 bg-white/[0.04] shadow-inner shadow-black/20 ring-offset-0 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30';

const PRESETS = [
  { id: 'mono', label: 'Mono', accent: '#e4e4e7', hint: 'Clean default' },
  { id: 'slate', label: 'Slate', accent: '#94a3b8', hint: 'Cool gray' },
  { id: 'ice', label: 'Ice', accent: '#7dd3fc', hint: 'Frost blue' },
  { id: 'ocean', label: 'Ocean', accent: '#38bdf8', hint: 'Bright aqua' },
  { id: 'mint', label: 'Mint', accent: '#6ee7b7', hint: 'Soft green' },
  { id: 'ember', label: 'Ember', accent: '#fb923c', hint: 'Warm coral' },
  { id: 'rose', label: 'Rose', accent: '#fb7185', hint: 'Pink accent' },
  { id: 'gold', label: 'Gold', accent: '#fbbf24', hint: 'Highlight' },
  { id: 'violet', label: 'Violet', accent: '#a78bfa', hint: 'Brand tone' },
  { id: 'lilac', label: 'Lilac', accent: '#d8b4fe', hint: 'Soft purple' },
] as const;

const ACCENT_SWATCHES = [
  '#ffffff',
  '#94a3b8',
  '#38bdf8',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#fb7185',
  '#a78bfa',
  '#e879f9',
]

function EditorSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5 sm:p-6 shadow-xl shadow-black/25 ring-1 ring-white/[0.04]',
        className,
      )}
    >
      <div className="flex items-start gap-3 mb-5">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] border border-white/15">
            <Icon className="h-5 w-5 text-white/90" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const ProfileEditor = ({
  profile,
  experiences,
  onSaved,
  onCancel,
  initialTab,
  openAddExperienceOnMount,
  onConsumedAddDeepLink,
  onDiscordMediaSynced,
}: Props) => {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    location: normalizeStoredCounty(profile.location || ''),
    timezone: profile.timezone || '',
    pronouns: profile.pronouns || '',
    status: profile.status || '',
    availability: profile.availability || '',
    banner_url: profile.banner_url || '',
    accent_color: profile.accent_color || '#ffffff',
    theme_preset: profile.theme_preset || 'mono',
  });
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [exps, setExps] = useState<Experience[]>(experiences);
  const [removedExpIds, setRemovedExpIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<Experience | null>(null);
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>(() => parseEditorTab(initialTab));
  const [dmWebsiteUpdates, setDmWebsiteUpdates] = useState(!!profile.dm_website_updates);
  const [dmExperienceUpdates, setDmExperienceUpdates] = useState(!!profile.dm_experience_status_updates);
  const [discordMediaBusy, setDiscordMediaBusy] = useState(false);
  const [discordSyncTarget, setDiscordSyncTarget] = useState<DiscordProfileMediaSyncMode>('both');
  const [livePreviewExpanded, setLivePreviewExpanded] = useState(false);
  const [bannerDropActive, setBannerDropActive] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [socialDraft, setSocialDraft] = useState<Record<ProfileSocialKey, string>>(() =>
    buildSocialDraft(profile.social_links),
  );

  useEffect(() => {
    setSocialDraft(buildSocialDraft(profile.social_links));
  }, [profile.id]);

  useEffect(() => {
    if (!openAddExperienceOnMount) return;
    setAddOpen(true);
    onConsumedAddDeepLink?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when deep-link opens add flow
  }, [openAddExperienceOnMount]);

  useEffect(() => {
    const onTab = (e: Event) => {
      const t = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (t === 'general' || t === 'customize' || t === 'experience') setActiveTab(t);
    };
    window.addEventListener('erlc-tutorial-set-tab', onTab as EventListener);
    return () => window.removeEventListener('erlc-tutorial-set-tab', onTab as EventListener);
  }, []);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const applyBannerFromFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please use an image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      toast.error('Image is too large (max 18 MB).');
      return;
    }
    try {
      const dataUrl = await imageFileToBannerDataUrl(file);
      update('banner_url', dataUrl);
      toast.success('Banner cropped to a wide fit — click Save to publish.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not process that image.');
    }
  };

  const addSkill = () => {
    const { text: sRaw, blockedHits } = filterPlaintext(skillInput.trim());
    const s = sRaw.slice(0, 30);
    if (!s || skills.includes(s) || skills.length >= 20) return;
    if (blockedHits) toast.info('Skill wording was adjusted to meet community guidelines.');
    setSkills([...skills, s]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const refreshExperiences = async () => {
    const { data } = await supabase
      .from('experiences')
      .select('*')
      .eq('profile_id', profile.id)
      .order('start_date', { ascending: false });
    if (data) setExps(data as Experience[]);
  };

  const updateExp = (id: string, patch: Partial<Experience>) =>
    setExps(exps.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const deleteExp = (id: string) => {
    setExps(exps.filter((e) => e.id !== id));
    setRemovedExpIds((r) => [...r, id]);
  };

  /** Server-linked: copy link in place. No guild: open picker dialog. */
  const copyVerifyLinkForExperience = async (e: Experience, forceNew: boolean) => {
    if (!e.guild_id) {
      setVerifyTarget(e);
      return;
    }
    setVerifyBusyId(e.id);
    try {
      const result = await ensureVerificationLink({
        experienceId: e.id,
        profileId: profile.id,
        guild: { id: e.guild_id, name: e.server_name, icon: e.server_icon },
        forceNew,
      });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      const ok = await copyTextToClipboard(result.url);
      if (ok) {
        toast.success(
          forceNew
            ? 'New verification link copied (valid 24 hours).'
            : 'Verification link copied (valid 24 hours).',
        );
      } else {
        toast.error('Could not copy automatically. Your browser may have blocked clipboard access.');
      }
    } finally {
      setVerifyBusyId(null);
    }
  };

  const handleSave = async () => {
    let filterHits = 0;
    const f = (v: string) => {
      const r = filterPlaintext(v);
      filterHits += r.blockedHits;
      return r.text;
    };
    const filteredForm = {
      ...form,
      display_name: f(form.display_name),
      bio: f(form.bio),
      location: f(form.location),
      timezone: f(form.timezone),
      pronouns: f(form.pronouns),
      status: f(form.status),
      availability: f(form.availability),
      banner_url: form.banner_url,
    };
    const filteredSkills = skills.map((s) => {
      const r = filterPlaintext(s);
      filterHits += r.blockedHits;
      return r.text;
    }).filter(Boolean);

    const parsed = profileSchema.safeParse(filteredForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Invalid input');
      return;
    }
    setSaving(true);
    try {
      const socialPayload: Partial<Record<ProfileSocialKey, string>> = {};
      for (const key of PROFILE_SOCIAL_KEYS) {
        const norm = normalizeSocialInputUrl(socialDraft[key] || '');
        if (norm) socialPayload[key] = norm;
      }
      const baseProfileUpdate = {
        display_name: filteredForm.display_name || null,
        bio: filteredForm.bio || null,
        location: filteredForm.location || null,
        timezone: filteredForm.timezone || null,
        pronouns: filteredForm.pronouns || null,
        status: filteredForm.status || null,
        availability: filteredForm.availability || null,
        website: null,
        banner_url: filteredForm.banner_url || null,
        accent_color: form.accent_color || null,
        theme_preset: form.theme_preset || 'mono',
        skills: filteredSkills,
        social_links: serializeProfileSocialLinks(socialPayload),
      };
      const dmPrefs = {
        dm_website_updates: dmWebsiteUpdates,
        dm_experience_status_updates: dmExperienceUpdates,
      };

      let { error } = await supabase
        .from('profiles')
        .update({ ...baseProfileUpdate, ...dmPrefs })
        .eq('id', profile.id);

      if (error && isProfileDmPrefsSchemaError(error.message)) {
        ({ error } = await supabase.from('profiles').update(baseProfileUpdate).eq('id', profile.id));
        if (!error) {
          toast.warning(
            'Profile saved. Discord DM preferences need the latest database migration on your Supabase project.',
          );
        }
      }
      if (error) throw error;

      // Experiences
      for (const id of removedExpIds) {
        await supabase.from('experiences').delete().eq('id', id);
      }
      // Update existing experiences (new ones are added via the AddExperienceDialog)
      for (const e of exps) {
        if (!e.role.trim() || !e.server_name.trim()) continue;
        const roleF = filterPlaintext(e.role.trim());
        filterHits += roleF.blockedHits;
        const payload = {
          role: roleF.text.slice(0, 80),
          start_date: e.start_date,
          end_date: e.is_current ? null : e.end_date,
          is_current: e.is_current,
          show_on_directory_card: e.show_on_directory_card !== false,
        };
        await supabase.from('experiences').update(payload).eq('id', e.id);
      }

      if (filterHits) toast.info('Some wording was adjusted to meet community guidelines.');
      toast.success('Profile saved');
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header card: banner + avatar + inline name */}
      <Card id="tutorial-editor-hero" className="card-elevated liquid-edge overflow-hidden">
        <div className="relative">
          <div className="h-36 sm:h-44 w-full bg-gradient-to-br from-white/10 via-white/[0.04] to-transparent">
            {form.banner_url ? (
              <img src={form.banner_url} alt="banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Add a banner in Customize</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent pointer-events-none" />
          </div>
          <div className="relative z-10 px-5 pb-5 -mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-background overflow-hidden bg-white/10 shrink-0">
              {(() => {
                const av = safeAvatarUrl(profile.discord_avatar);
                return av ? (
                  <img
                    src={av}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy={avatarReferrerPolicy(av)}
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-2xl font-semibold">
                    {(form.display_name || profile.discord_username || '?').charAt(0).toUpperCase()}
                  </div>
                );
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Input
                  value={form.display_name}
                  maxLength={60}
                  onChange={(e) => update('display_name', e.target.value)}
                  placeholder="Your display name"
                  className={cn(
                    editorInput,
                    'text-lg font-semibold h-11 border-white/14 bg-white/[0.06]',
                  )}
                />
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
              </div>
              {profile.discord_username && (
                <p className="text-xs text-muted-foreground mt-1">@{profile.discord_username}</p>
              )}
            </div>
            <div className="flex gap-2 sm:self-center">
              <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="w-full min-w-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditorTab)} className="w-full min-w-0">
        <TabsList
          id="tutorial-editor-tabs"
          className="flex h-auto w-full min-h-[3rem] flex-wrap gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-inner shadow-black/30"
        >
          <TabsTrigger
            value="general"
            className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:shadow-black/20 data-[state=active]:border data-[state=active]:border-white/25 border border-transparent text-muted-foreground transition-all"
          >
            <UserIcon className="h-4 w-4 shrink-0 opacity-80" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="customize"
            className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:shadow-black/20 data-[state=active]:border data-[state=active]:border-white/25 border border-transparent text-muted-foreground transition-all"
          >
            <Palette className="h-4 w-4 shrink-0 opacity-80" />
            Customize
          </TabsTrigger>
          <TabsTrigger
            value="experience"
            className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:shadow-black/20 data-[state=active]:border data-[state=active]:border-white/25 border border-transparent text-muted-foreground transition-all"
          >
            <Briefcase className="h-4 w-4 shrink-0 opacity-80" />
            Experience
          </TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-5 space-y-6">
          <EditorSection
            title="About you"
            description="Basics that appear on your card — edit your display name in the banner above."
            icon={UserIcon}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Pronouns">
                {(() => {
                  const isPreset = PRONOUN_PRESETS.includes(form.pronouns);
                  const selectValue = !form.pronouns ? '__none' : isPreset ? form.pronouns : '__custom';
                  return (
                    <div className="space-y-2">
                      <Select
                        value={selectValue}
                        onValueChange={(v) => {
                          if (v === '__none') update('pronouns', '');
                          else if (v === '__custom') update('pronouns', form.pronouns && !isPreset ? form.pronouns : ' ');
                          else update('pronouns', v);
                        }}
                      >
                        <SelectTrigger className={editorSelect}>
                          <SelectValue placeholder="Select pronouns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Prefer not to say</SelectItem>
                          {PRONOUN_PRESETS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom">Other (custom)</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectValue === '__custom' && (
                        <Input
                          value={form.pronouns.trim()}
                          maxLength={30}
                          autoFocus
                          onChange={(e) => update('pronouns', e.target.value)}
                          className={editorInput}
                        />
                      )}
                    </div>
                  );
                })()}
              </Field>
              <Field label="Availability" hint="Short phrase — hiring, open to collab, etc.">
                <Input
                  value={form.availability}
                  maxLength={40}
                  onChange={(e) => update('availability', e.target.value)}
                  className={editorInput}
                />
              </Field>
              <Field
                label="Country / region"
                hint="Pick a broad area — country or state/province — not your street or town."
              >
                <Select
                  value={form.location ? form.location : '__none'}
                  onValueChange={(v) => update('location', v === '__none' ? '' : v)}
                >
                  <SelectTrigger className={editorSelect}>
                    <SelectValue placeholder="Choose country or region" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(22rem,70vh)]">
                    <SelectItem value="__none">Don&apos;t show location</SelectItem>
                    {PROFILE_LOCATION_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-muted-foreground">{group.label}</SelectLabel>
                        {group.options.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Timezone">
                <Input value={form.timezone} maxLength={40} onChange={(e) => update('timezone', e.target.value)} className={editorInput} />
              </Field>
            </div>

            <EditorSection
              title="Platform links"
              description="Optional profile buttons with hover tooltips — paste a profile or channel URL for each network you use."
              icon={Globe}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {PROFILE_SOCIAL_KEYS.map((key) => (
                  <Field key={key} label={PROFILE_SOCIAL_LABELS[key]} hint="https://… or domain only">
                    <Input
                      value={socialDraft[key]}
                      maxLength={300}
                      onChange={(e) =>
                        setSocialDraft((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="https://"
                      className={editorInput}
                    />
                  </Field>
                ))}
              </div>
            </EditorSection>

            <Field label="Status" hint={`Shown on your profile — ${form.status.length}/140`}>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 mb-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Quick emoji</p>
                <div className="flex flex-wrap gap-1.5">
                  {['💭', '🚓', '🚑', '🚒', '🎧', '☕', '🛠️', '🌙', '🔥', '✅'].map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => update('status', `${emo} ${form.status.replace(/^\p{Emoji}\s*/u, '')}`.trim())}
                      className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.05] text-base hover:bg-white/[0.12] hover:border-white/20 transition-colors"
                      aria-label={`Add ${emo}`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                value={form.status}
                maxLength={140}
                onChange={(e) => update('status', e.target.value)}
                className={editorInput}
              />
            </Field>
          </EditorSection>

          <EditorSection title="Bio & skills" description="Tell communities what you bring and tag relevant skills." icon={Sparkles}>
            <Field label="Bio">
              <Textarea value={form.bio} maxLength={500} rows={5} onChange={(e) => update('bio', e.target.value)} className={editorTextarea} />
              <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">{form.bio.length}/500</p>
            </Field>

            <Field label="Skills" hint="Up to 20 — click a chip to remove">
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  maxLength={30}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className={editorInput}
                />
                <Button type="button" variant="secondary" className="rounded-xl shrink-0 h-11 px-4" onClick={addSkill}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {skills.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="gap-1.5 cursor-pointer rounded-full border-white/15 bg-white/[0.04] px-3 py-1 text-sm hover:bg-white/[0.08]"
                      onClick={() => removeSkill(s)}
                    >
                      {s} <X className="h-3 w-3 opacity-70" />
                    </Badge>
                  ))}
                </div>
              )}
            </Field>
          </EditorSection>

          <EditorSection title="Discord notifications" description="Optional — the bot only works if you share a server with it." icon={Bell}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Website updates</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">News from staff via the admin panel.</p>
                </div>
                <Switch checked={dmWebsiteUpdates} onCheckedChange={(c) => setDmWebsiteUpdates(!!c)} />
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Experience verification</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">When a pending verification is approved or declined.</p>
                </div>
                <Switch checked={dmExperienceUpdates} onCheckedChange={(c) => setDmExperienceUpdates(!!c)} />
              </div>
            </div>
          </EditorSection>
        </TabsContent>

        {/* CUSTOMIZE */}
        <TabsContent value="customize" className="mt-5 space-y-6">
          <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5 sm:p-6 shadow-xl shadow-black/25 ring-1 ring-white/[0.04]">
            <button
              type="button"
              onClick={() => setLivePreviewExpanded((v) => !v)}
              className="flex w-full items-start gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background -m-1 p-1"
              aria-expanded={livePreviewExpanded}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08]">
                <Eye className="h-5 w-5 text-white/90" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-semibold tracking-tight text-foreground">Live preview</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  How accent color reads against your banner. Tap to {livePreviewExpanded ? 'hide' : 'show'}.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                  livePreviewExpanded && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {livePreviewExpanded ? (
              <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-5">
                <div
                  className="relative aspect-[21/9] min-h-[140px] overflow-hidden rounded-2xl border border-white/12 shadow-2xl shadow-black/40"
                  style={{
                    boxShadow: `inset 0 -4px 48px ${form.accent_color}22`,
                  }}
                >
                  {form.banner_url ? (
                    <img src={form.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ background: `linear-gradient(90deg, transparent, ${form.accent_color}, transparent)` }}
                  />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-12 w-12 shrink-0 rounded-full ring-2 ring-background shadow-lg"
                        style={{ boxShadow: `0 0 24px ${form.accent_color}55` }}
                      >
                        {(() => {
                          const av = safeAvatarUrl(profile.discord_avatar);
                          return av ? (
                            <img
                              src={av}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                              referrerPolicy={avatarReferrerPolicy(av)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                              {(form.display_name || '?').charAt(0).toUpperCase()}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate max-w-[200px]">{form.display_name || 'Your name'}</p>
                        <p className="text-[11px] text-muted-foreground" style={{ color: form.accent_color }}>
                          Accent preview
                        </p>
                      </div>
                    </div>
                    <ProfileSocialBadges
                      socialLinks={serializeProfileSocialLinks(
                        PROFILE_SOCIAL_KEYS.reduce((acc, k) => {
                          const t = socialDraft[k]?.trim();
                          if (t) acc[k] = t;
                          return acc;
                        }, {} as Partial<Record<ProfileSocialKey, string>>),
                      )}
                      discordHref={discordUserProfileUrl(profile.discord_id)}
                      className="shrink-0"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <EditorSection title="Color & theme" description="Choose a preset or tune accent — affects highlights and badges on your profile." icon={Palette}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    update('theme_preset', p.id);
                    update('accent_color', p.accent);
                  }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all hover:border-white/25 hover:bg-white/[0.06]',
                    form.theme_preset === p.id
                      ? 'border-white/40 bg-white/[0.07] ring-1 ring-white/25 shadow-lg shadow-black/40'
                      : 'border-white/10 bg-black/20',
                  )}
                >
                  <span
                    className="mb-2 block h-8 w-full rounded-lg ring-1 ring-white/10"
                    style={{ background: p.accent }}
                  />
                  <span className="text-sm font-medium block">{p.label}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">{p.hint}</span>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick accent</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Accent ${hex}`}
                    onClick={() => update('accent_color', hex)}
                    className={cn(
                      'h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-105',
                      form.accent_color.toLowerCase() === hex.toLowerCase() ? 'ring-white/50' : 'ring-transparent',
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <Field label="Custom accent">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={form.accent_color.match(/^#[0-9a-fA-F]{6}$/) ? form.accent_color : '#ffffff'}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-white/15 bg-transparent"
                  />
                  <Input
                    value={form.accent_color}
                    maxLength={9}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className={cn(editorInput, 'max-w-[180px] font-mono text-xs')}
                  />
                </div>
              </Field>
            </div>
          </EditorSection>

          <EditorSection
            title="Banner image"
            description="Drag a photo below — we crop it to a wide banner (21:9). Paste a URL, or pull media from Discord (Customize only — choose banner, profile picture, or both)."
            icon={ImageIcon}
          >
            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-hidden
              onChange={(e) => {
                void applyBannerFromFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sync from Discord</p>
                <p className="text-xs text-muted-foreground leading-snug mb-3">
                  Uses your linked Discord login. Banner-only leaves your profile picture as-is; picture-only leaves your banner as-is. Each sync also tries to refresh directory servers you share with the site (banners and invite links).
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <Select
                    value={discordSyncTarget}
                    onValueChange={(v) => setDiscordSyncTarget(v as DiscordProfileMediaSyncMode)}
                  >
                    <SelectTrigger className={cn(editorSelect, 'sm:max-w-[min(100%,280px)]')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Banner &amp; profile picture</SelectItem>
                      <SelectItem value="banner">Banner only (Nitro)</SelectItem>
                      <SelectItem value="avatar">Profile picture only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-2 sm:self-stretch sm:w-auto"
                    disabled={discordMediaBusy}
                    onClick={async () => {
                      setDiscordMediaBusy(true);
                      const r = await invokeDiscordProfileMediaSync({ sync: discordSyncTarget });
                      setDiscordMediaBusy(false);
                      if (!r.ok) {
                        toast.error(r.error || 'Could not sync from Discord');
                        return;
                      }
                      if (discordSyncTarget === 'both' || discordSyncTarget === 'banner') {
                        if (r.banner_url) update('banner_url', r.banner_url);
                      }
                      onDiscordMediaSynced?.();

                      if (discordSyncTarget === 'both') {
                        if (r.banner_url && r.discord_avatar) {
                          toast.success('Banner and profile picture updated from Discord.');
                        } else if (r.banner_url) {
                          toast.success('Banner updated from Discord.');
                        } else if (r.discord_avatar) {
                          toast.success(
                            'Profile picture updated. No Nitro banner on your account — upload one below if you want.',
                          );
                        } else {
                          toast.info('Nothing new from Discord to apply.');
                        }
                      } else if (discordSyncTarget === 'banner') {
                        if (r.banner_url) {
                          toast.success('Banner updated from Discord.');
                        } else {
                          toast.info('No Nitro banner on your Discord account — your saved banner was left unchanged.');
                        }
                      } else if (r.discord_avatar) {
                        toast.success('Profile picture updated from Discord.');
                      } else {
                        toast.info('No Discord profile image to sync.');
                      }

                      const refreshed = r.servers_refreshed ?? 0;
                      if (refreshed > 0) {
                        toast.message('Server listings refreshed', {
                          description: `Updated ${refreshed} directory server${refreshed === 1 ? '' : 's'} you’re in — banners and Discord invites when Discord provides them.`,
                        });
                      }
                    }}
                  >
                    <RefreshCw className={cn('h-4 w-4', discordMediaBusy && 'animate-spin')} />
                    Sync now
                  </Button>
                </div>
              </div>
            </div>
            <Field label="Banner URL (optional)">
              <Input
                value={form.banner_url.startsWith('data:') ? '' : form.banner_url}
                placeholder="https://… or upload below"
                maxLength={2048}
                onChange={(e) => update('banner_url', e.target.value)}
                className={editorInput}
              />
              {form.banner_url.startsWith('data:') ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mt-1.5">
                  <p className="text-xs text-muted-foreground">Uploaded image — preview below. Save your profile to publish.</p>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs shrink-0 self-start sm:self-auto" onClick={() => update('banner_url', '')}>
                    Remove upload
                  </Button>
                </div>
              ) : null}
            </Field>

            <button
              id="tutorial-banner-upload"
              type="button"
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBannerDropActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBannerDropActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBannerDropActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBannerDropActive(false);
                const f = e.dataTransfer.files?.[0];
                void applyBannerFromFile(f);
              }}
              onClick={() => bannerFileInputRef.current?.click()}
              className={cn(
                'w-full rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer',
                bannerDropActive
                  ? 'border-white/45 bg-white/[0.08]'
                  : 'border-white/18 bg-black/25 hover:border-white/30 hover:bg-white/[0.04]',
              )}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-90" aria-hidden />
              <p className="text-sm font-medium text-foreground">Drop an image here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Auto-cropped to a wide banner (center, 21:9). JPG output — best for photos.
              </p>
            </button>

            {form.banner_url ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/12 aspect-[21/9] max-h-[220px]">
                <img src={form.banner_url} alt="Banner preview" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </EditorSection>
        </TabsContent>

        {/* EXPERIENCE */}
        <TabsContent value="experience" className="mt-5">
          <div className="flex justify-end mb-3">
            <Button
              id="tutorial-add-experience-btn"
              size="sm"
              variant="secondary"
              onClick={() => setAddOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add experience
            </Button>
          </div>
          <div className="space-y-3">
            {exps.length === 0 && (
              <Card className="card-elevated"><CardContent className="p-6 text-sm text-muted-foreground text-center">No experiences yet. Add your first role.</CardContent></Card>
            )}
            {exps.map((e) => (
              <Card key={e.id} className="card-elevated liquid-edge">
                <CardContent className="p-4 grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 flex items-center gap-3">
                    {e.server_icon ? (
                      <img src={e.server_icon} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
                        {(e.server_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.server_name || 'Untitled'}</div>
                      <div className="text-[11px] text-muted-foreground">Server / project (locked)</div>
                    </div>
                  </div>
                  <Field label="Position">
                    {e.guild_id && !e.is_verified ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted-foreground">
                        {isPendingPlaceholderRole(e.role)
                          ? 'An admin sets your title when they approve the verification link.'
                          : e.role}
                      </div>
                    ) : (
                      <Input
                        value={e.role}
                        maxLength={80}
                        onChange={(ev) => updateExp(e.id, { role: ev.target.value })}
                        className={editorInput}
                      />
                    )}
                  </Field>
                  <Field label="Start date">
                    <Input
                      type="date"
                      value={e.start_date?.slice(0, 10) || ''}
                      onChange={(ev) => updateExp(e.id, { start_date: ev.target.value })}
                      className={cn(editorInput, 'font-mono text-[13px]')}
                    />
                  </Field>
                  <div className="flex items-center justify-between md:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch checked={e.is_current} onCheckedChange={(c) => updateExp(e.id, { is_current: c })} />
                      <span className="text-sm">Currently here</span>
                    </div>
                    {!e.is_current && (
                      <Field label="End date" className="w-48">
                        <Input
                          type="date"
                          value={e.end_date?.slice(0, 10) || ''}
                          onChange={(ev) => updateExp(e.id, { end_date: ev.target.value })}
                          className={cn(editorInput, 'font-mono text-[13px]')}
                        />
                      </Field>
                    )}
                  </div>
                  <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <Switch
                      checked={e.show_on_directory_card !== false}
                      onCheckedChange={(c) => updateExp(e.id, { show_on_directory_card: c })}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">Show on Member Directory</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Include this role in the “Recent work” strip on your directory card (up to two visible).
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {e.is_verified ? (
                        <Badge className="badge-verified gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={verifyBusyId === e.id}
                            onClick={() => void copyVerifyLinkForExperience(e, false)}
                            className="gap-2"
                            title="Copy a verification link (valid 24 hours)"
                          >
                            <Shield className="h-4 w-4" /> Verify
                          </Button>
                          {e.guild_id ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={verifyBusyId === e.id}
                              onClick={() => void copyVerifyLinkForExperience(e, true)}
                              className="rounded-full px-2.5 border-white/15"
                              title="New verification link (24 hours)"
                              aria-label="Generate new verification link"
                            >
                              <RefreshCw className={cn('h-4 w-4', verifyBusyId === e.id && 'animate-spin')} />
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteExp(e.id)} className="gap-2 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {verifyTarget && (
        <VerifyExperienceDialog
          open={!!verifyTarget}
          onOpenChange={(o) => !o && setVerifyTarget(null)}
          experienceId={verifyTarget.id}
          profileId={profile.id}
          serverNameHint={verifyTarget.server_name}
          linkedGuild={
            verifyTarget.guild_id
              ? {
                  id: verifyTarget.guild_id,
                  name: verifyTarget.server_name,
                  icon: verifyTarget.server_icon,
                }
              : null
          }
          onVerified={() => {
            void refreshExperiences();
          }}
        />
      )}

      <AddExperienceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        profileId={profile.id}
        onCreated={refreshExperiences}
        onRequestVerification={(row) => {
          setVerifyTarget({
            id: row.id,
            role: PENDING_EXPERIENCE_ROLE,
            server_name: row.server_name,
            server_icon: row.server_icon,
            department: null,
            start_date: new Date().toISOString(),
            end_date: null,
            is_current: true,
            is_verified: false,
            show_on_directory_card: true,
            guild_id: row.guild_id,
          });
        }}
      />
    </div>
  );
};

const Field = ({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('space-y-2', className)}>
    <div>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{hint}</p> : null}
    </div>
    {children}
  </div>
);

export default ProfileEditor;
