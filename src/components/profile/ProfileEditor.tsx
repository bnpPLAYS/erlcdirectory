import { useState } from 'react';
import { Plus, Trash2, Save, X, Briefcase, Palette, User as UserIcon, Link2, Shield, BadgeCheck, Pencil, ImageIcon, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProfilePreviewCard from './ProfilePreviewCard';
import { z } from 'zod';
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
import { cn } from '@/lib/utils';
import VerifyExperienceDialog from './VerifyExperienceDialog';
import AddExperienceDialog from './AddExperienceDialog';
import { PENDING_EXPERIENCE_ROLE } from '@/lib/experienceConstants';

const PRONOUN_PRESETS = ['he/him', 'she/her', 'they/them', 'he/they', 'she/they', 'any/all'];

/** Flush with dark directory UI: pill inputs, soft border, minimal ring */
const flushInput =
  'rounded-full border-white/12 bg-white/[0.04] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-white/25 focus-visible:ring-offset-0';
const flushSelectTrigger =
  'rounded-full border-white/12 bg-white/[0.04] text-foreground shadow-none focus:ring-1 focus:ring-white/25 focus:ring-offset-0';
const flushTextarea =
  'rounded-2xl border-white/12 bg-white/[0.04] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-white/25 focus-visible:ring-offset-0 min-h-[100px]';

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
  skills: string[];
  social_links: Record<string, string> | null;
}

interface Props {
  profile: ProfileLike;
  experiences: Experience[];
  onSaved: () => void;
  onCancel: () => void;
}

const profileSchema = z.object({
  display_name: z.string().trim().max(60, 'Name must be 60 characters or fewer').optional(),
  bio: z.string().trim().max(500, 'Bio must be 500 characters or fewer').optional(),
  location: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(40).optional(),
  pronouns: z.string().trim().max(30).optional(),
  status: z.string().trim().max(140).optional(),
  availability: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional().refine(
    (v) => !v || /^https?:\/\//i.test(v),
    'Website must start with http:// or https://'
  ),
  banner_url: z.string().trim().max(500).optional().refine(
    (v) => !v || /^https?:\/\//i.test(v),
    'Banner URL must start with http:// or https://'
  ),
});

const PRESETS = [
  { id: 'mono', label: 'Mono', accent: '#ffffff' },
  { id: 'ice', label: 'Ice', accent: '#cfe8ff' },
  { id: 'ember', label: 'Ember', accent: '#ffb4a2' },
  { id: 'mint', label: 'Mint', accent: '#b8f2d8' },
  { id: 'lilac', label: 'Lilac', accent: '#d6c2ff' },
  { id: 'slate', label: 'Slate', accent: '#94a3b8' },
  { id: 'rose', label: 'Rose', accent: '#fda4af' },
  { id: 'gold', label: 'Gold', accent: '#fcd34d' },
  { id: 'ocean', label: 'Ocean', accent: '#67e8f9' },
  { id: 'violet', label: 'Violet', accent: '#c4b5fd' },
];

const ACCENT_SWATCHES = [
  '#ffffff',
  '#e9d5ff',
  '#c4b5fd',
  '#a78bfa',
  '#7dd3fc',
  '#6ee7b7',
  '#86efac',
  '#fca5a5',
  '#fdba74',
  '#94a3b8',
];

const ProfileEditor = ({ profile, experiences, onSaved, onCancel }: Props) => {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    timezone: profile.timezone || '',
    pronouns: profile.pronouns || '',
    status: profile.status || '',
    availability: profile.availability || '',
    website: profile.website || '',
    banner_url: profile.banner_url || '',
    accent_color: profile.accent_color || '#ffffff',
    theme_preset: profile.theme_preset || 'mono',
  });
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>(profile.social_links || {});
  const [exps, setExps] = useState<Experience[]>(experiences);
  const [newExpKeys, setNewExpKeys] = useState<Set<string>>(new Set());
  const [removedExpIds, setRemovedExpIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<Experience | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addSkill = () => {
    const { text: sRaw, blockedHits } = filterPlaintext(skillInput.trim());
    const s = sRaw.slice(0, 30);
    if (!s || skills.includes(s) || skills.length >= 20) return;
    if (blockedHits) toast.info('Skill wording was adjusted to meet community guidelines.');
    setSkills([...skills, s]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const setSocial = (k: string, v: string) => setSocials((p) => ({ ...p, [k]: v }));

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
    if (!newExpKeys.has(id)) setRemovedExpIds((r) => [...r, id]);
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
      website: form.website,
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
      const cleanedSocials = Object.fromEntries(
        Object.entries(socials)
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => {
            const r = filterPlaintext(v.trim());
            filterHits += r.blockedHits;
            return [k, r.text];
          })
      );

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: filteredForm.display_name || null,
          bio: filteredForm.bio || null,
          location: filteredForm.location || null,
          timezone: filteredForm.timezone || null,
          pronouns: filteredForm.pronouns || null,
          status: filteredForm.status || null,
          availability: filteredForm.availability || null,
          website: filteredForm.website || null,
          banner_url: filteredForm.banner_url || null,
          accent_color: form.accent_color || null,
          theme_preset: form.theme_preset || 'mono',
          skills: filteredSkills,
          social_links: cleanedSocials,
        })
        .eq('id', profile.id);
      if (error) throw error;

      // Experiences
      for (const id of removedExpIds) {
        await supabase.from('experiences').delete().eq('id', id);
      }
      // Update existing experiences (new ones are added via the AddExperienceDialog)
      for (const e of exps) {
        if (newExpKeys.has(e.id)) continue;
        if (!e.role.trim() || !e.server_name.trim()) continue;
        const roleF = filterPlaintext(e.role.trim());
        filterHits += roleF.blockedHits;
        const payload = {
          role: roleF.text.slice(0, 80),
          start_date: e.start_date,
          end_date: e.is_current ? null : e.end_date,
          is_current: e.is_current,
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
      <Card className="card-elevated liquid-edge overflow-hidden">
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
              {profile.discord_avatar ? (
                <img src={profile.discord_avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-2xl font-semibold">
                  {(form.display_name || profile.discord_username || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Input
                  value={form.display_name}
                  maxLength={60}
                  onChange={(e) => update('display_name', e.target.value)}
                  placeholder="Your display name"
                  className="text-lg font-semibold rounded-full border-white/12 bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/25 focus-visible:ring-offset-0 h-10"
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

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <Tabs defaultValue="general" className="w-full min-w-0">
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-muted-foreground">
          <TabsTrigger
            value="general"
            className="gap-2 rounded-full px-3 py-2 text-sm data-[state=active]:bg-white/12 data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <UserIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="customize"
            className="gap-2 rounded-full px-3 py-2 text-sm data-[state=active]:bg-white/12 data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Palette className="h-4 w-4" />
            Customize
          </TabsTrigger>
          <TabsTrigger
            value="experience"
            className="gap-2 rounded-full px-3 py-2 text-sm data-[state=active]:bg-white/12 data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Briefcase className="h-4 w-4" />
            Experience
          </TabsTrigger>
          <TabsTrigger
            value="socials"
            className="gap-2 rounded-full px-3 py-2 text-sm data-[state=active]:bg-white/12 data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Link2 className="h-4 w-4" />
            Socials
          </TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-4">
          <Card className="card-elevated liquid-edge border-white/10">
            <CardContent className="p-5 grid md:grid-cols-2 gap-4">
              <Field label="Display name">
                <Input
                  className={flushInput}
                  value={form.display_name}
                  maxLength={60}
                  onChange={(e) => update('display_name', e.target.value)}
                  placeholder="How others see you"
                />
              </Field>
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
                        <SelectTrigger className={flushSelectTrigger}>
                          <SelectValue placeholder="Select pronouns" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Prefer not to say</SelectItem>
                          {PRONOUN_PRESETS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                          <SelectItem value="__custom">Other (custom)</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectValue === '__custom' && (
                        <Input
                          className={flushInput}
                          value={form.pronouns.trim()}
                          maxLength={30}
                          autoFocus
                          onChange={(e) => update('pronouns', e.target.value)}
                          placeholder="Enter custom pronouns"
                        />
                      )}
                    </div>
                  );
                })()}
              </Field>
              <Field label="What's on your mind" className="md:col-span-2">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['💭', '🚓', '🚑', '🚒', '🎧', '☕', '🛠️', '🌙', '🔥', '✅'].map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => update('status', `${emo} ${form.status.replace(/^\p{Emoji}\s*/u, '')}`.trim())}
                      className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] text-base hover:bg-white/[0.08] transition-colors"
                      aria-label={`Add ${emo}`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
                <Input
                  className={flushInput}
                  value={form.status}
                  maxLength={140}
                  onChange={(e) => update('status', e.target.value)}
                  placeholder="What are you up to right now?"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Share a vibe — what you're doing, listening to, or looking for. {form.status.length}/140
                </p>
              </Field>
              <Field label="Availability">
                <Input
                  className={flushInput}
                  value={form.availability}
                  maxLength={40}
                  onChange={(e) => update('availability', e.target.value)}
                  placeholder="Open to work"
                />
              </Field>
              <Field label="Location">
                <Input
                  className={flushInput}
                  value={form.location}
                  maxLength={80}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="Manchester, UK"
                />
              </Field>
              <Field label="Timezone">
                <Input
                  className={flushInput}
                  value={form.timezone}
                  maxLength={40}
                  onChange={(e) => update('timezone', e.target.value)}
                  placeholder="GMT / UTC+0"
                />
              </Field>
              <Field label="Bio" className="md:col-span-2">
                <Textarea
                  className={flushTextarea}
                  value={form.bio}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => update('bio', e.target.value)}
                  placeholder="Tell servers what you bring."
                />
                <p className="text-xs text-muted-foreground mt-1">{form.bio.length}/500</p>
              </Field>

              <Field label="Skills" className="md:col-span-2">
                <div className="flex gap-2">
                  <Input
                    className={flushInput}
                    value={skillInput}
                    maxLength={30}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="Add a skill and press Enter"
                  />
                  <Button type="button" variant="secondary" className="rounded-full shrink-0" onClick={addSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="outline" className="gap-1 cursor-pointer" onClick={() => removeSkill(s)}>
                        {s} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOMIZE */}
        <TabsContent value="customize" className="mt-4">
          <Card className="card-elevated liquid-edge border-white/10">
            <CardContent className="p-5 space-y-8">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tune how your profile looks in the directory. Changes apply to your banner, accents, and the link on your card.
              </p>

              <div className="space-y-3">
                <Field label="Banner image URL">
                  <Input
                    className={flushInput}
                    value={form.banner_url}
                    maxLength={500}
                    onChange={(e) => update('banner_url', e.target.value)}
                    placeholder="https://…/banner.jpg"
                  />
                </Field>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden aspect-[21/8] max-h-40">
                  {form.banner_url ? (
                    <img src={form.banner_url} alt="Banner preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs text-muted-foreground px-4 text-center">
                      Paste an image URL to preview your banner here
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Field label="Personal website">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className={cn(flushInput, 'pl-10')}
                      value={form.website}
                      maxLength={200}
                      onChange={(e) => update('website', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Shown on your public profile. Must start with http:// or https://
                  </p>
                </Field>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick accent</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((c) => {
                    const active = form.accent_color.toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => update('accent_color', c)}
                        className={cn(
                          'h-10 w-10 rounded-full border-2 transition-transform shrink-0',
                          active
                            ? 'border-white scale-105 ring-2 ring-violet-400/50 ring-offset-2 ring-offset-background'
                            : 'border-white/25 hover:border-white/45',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                </div>
              </div>

              <Field label="Accent hex">
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    type="color"
                    value={form.accent_color.match(/^#[0-9a-fA-F]{6}$/) ? form.accent_color : '#ffffff'}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className="h-10 w-12 shrink-0 rounded-full border border-white/15 bg-transparent cursor-pointer overflow-hidden"
                    aria-label="Pick accent color"
                  />
                  <Input
                    className={flushInput}
                    value={form.accent_color}
                    maxLength={9}
                    onChange={(e) => update('accent_color', e.target.value)}
                    placeholder="#ffffff"
                  />
                </div>
              </Field>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Theme preset</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        update('theme_preset', p.id);
                        update('accent_color', p.accent);
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors',
                        form.theme_preset === p.id
                          ? 'border-violet-400/35 bg-violet-500/10 text-foreground'
                          : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:border-white/15',
                      )}
                    >
                      <span
                        className="h-8 w-8 rounded-full border border-white/15 shrink-0"
                        style={{ background: p.accent }}
                      />
                      <span className="font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPERIENCE */}
        <TabsContent value="experience" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} className="gap-2">
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
                        {e.role === PENDING_EXPERIENCE_ROLE
                          ? 'An admin sets your title when they approve the verification link.'
                          : e.role}
                      </div>
                    ) : (
                      <Input
                        className={flushInput}
                        value={e.role}
                        maxLength={80}
                        onChange={(ev) => updateExp(e.id, { role: ev.target.value })}
                        placeholder="e.g. Patrol Officer, Staff"
                      />
                    )}
                  </Field>
                  <Field label="Start date">
                    <Input
                      className={cn(flushInput, 'rounded-2xl')}
                      type="date"
                      value={e.start_date?.slice(0, 10) || ''}
                      onChange={(ev) => updateExp(e.id, { start_date: ev.target.value })}
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
                          className={cn(flushInput, 'rounded-2xl')}
                          type="date"
                          value={e.end_date?.slice(0, 10) || ''}
                          onChange={(ev) => updateExp(e.id, { end_date: ev.target.value })}
                        />
                      </Field>
                    )}
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {e.is_verified ? (
                        <Badge className="badge-verified gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setVerifyTarget(e)}
                          className="gap-2"
                        >
                          <Shield className="h-4 w-4" /> Verify with admin
                        </Button>
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

        {/* SOCIALS */}
        <TabsContent value="socials" className="mt-4">
          <Card className="card-elevated liquid-edge border-white/10">
            <CardContent className="p-5 grid md:grid-cols-2 gap-4">
              {['twitter', 'youtube', 'twitch', 'roblox', 'discord_server', 'github'].map((k) => (
                <Field key={k} label={k.replace('_', ' ')}>
                  <Input
                    className={flushInput}
                    value={socials[k] || ''}
                    maxLength={200}
                    onChange={(e) => setSocial(k, e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <aside className="hidden lg:block sticky top-20">
        <ProfilePreviewCard
          discord_avatar={profile.discord_avatar ?? null}
          discord_username={profile.discord_username ?? null}
          is_verified={(profile as any).is_verified}
          display_name={form.display_name}
          bio={form.bio}
          location={form.location}
          timezone={form.timezone}
          pronouns={form.pronouns.trim()}
          status={form.status}
          availability={form.availability}
          website={form.website}
          banner_url={form.banner_url}
          accent_color={form.accent_color}
          skills={skills}
          social_links={socials}
        />
      </aside>
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
            setExps((prev) => prev.map((x) => (x.id === verifyTarget.id ? { ...x, is_verified: true } : x)));
          }}
        />
      )}

      <AddExperienceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        profileId={profile.id}
        onCreated={refreshExperiences}
      />
    </div>
  );
};

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">{label}</Label>
    {children}
  </div>
);

export default ProfileEditor;
