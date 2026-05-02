import { useState } from 'react';
import { Plus, Trash2, Save, X, Briefcase, Palette, User as UserIcon, Link2 } from 'lucide-react';
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
  status: z.string().trim().max(80).optional(),
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

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addSkill = () => {
    const s = skillInput.trim().slice(0, 30);
    if (!s || skills.includes(s) || skills.length >= 20) return;
    setSkills([...skills, s]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const setSocial = (k: string, v: string) => setSocials((p) => ({ ...p, [k]: v }));

  const addExperience = () => {
    const id = `new-${crypto.randomUUID()}`;
    setExps([
      {
        id,
        role: '',
        server_name: '',
        server_icon: null,
        department: '',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: null,
        is_current: true,
        is_verified: false,
      },
      ...exps,
    ]);
    setNewExpKeys((s) => new Set(s).add(id));
  };

  const updateExp = (id: string, patch: Partial<Experience>) =>
    setExps(exps.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const deleteExp = (id: string) => {
    setExps(exps.filter((e) => e.id !== id));
    if (!newExpKeys.has(id)) setRemovedExpIds((r) => [...r, id]);
  };

  const handleSave = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Invalid input');
      return;
    }
    setSaving(true);
    try {
      const cleanedSocials = Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v && v.trim())
      );

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: form.display_name || null,
          bio: form.bio || null,
          location: form.location || null,
          timezone: form.timezone || null,
          pronouns: form.pronouns || null,
          status: form.status || null,
          availability: form.availability || null,
          website: form.website || null,
          banner_url: form.banner_url || null,
          accent_color: form.accent_color || null,
          theme_preset: form.theme_preset || 'mono',
          skills,
          social_links: cleanedSocials,
        })
        .eq('id', profile.id);
      if (error) throw error;

      // Experiences
      for (const id of removedExpIds) {
        await supabase.from('experiences').delete().eq('id', id);
      }
      for (const e of exps) {
        if (!e.role.trim() || !e.server_name.trim()) continue;
        const payload = {
          profile_id: profile.id,
          role: e.role.trim().slice(0, 80),
          server_name: e.server_name.trim().slice(0, 80),
          department: e.department?.trim().slice(0, 60) || null,
          start_date: e.start_date,
          end_date: e.is_current ? null : e.end_date,
          is_current: e.is_current,
        };
        if (newExpKeys.has(e.id)) {
          await supabase.from('experiences').insert(payload);
        } else {
          await supabase.from('experiences').update(payload).eq('id', e.id);
        }
      }

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Edit profile</h2>
          <p className="text-sm text-muted-foreground">Make it yours. Changes save when you hit Save.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="glass">
          <TabsTrigger value="general" className="gap-2"><UserIcon className="h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="customize" className="gap-2"><Palette className="h-4 w-4" />Customize</TabsTrigger>
          <TabsTrigger value="experience" className="gap-2"><Briefcase className="h-4 w-4" />Experience</TabsTrigger>
          <TabsTrigger value="socials" className="gap-2"><Link2 className="h-4 w-4" />Socials</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-4">
          <Card className="card-elevated liquid-edge">
            <CardContent className="p-5 grid md:grid-cols-2 gap-4">
              <Field label="Display name">
                <Input value={form.display_name} maxLength={60} onChange={(e) => update('display_name', e.target.value)} placeholder="How others see you" />
              </Field>
              <Field label="Pronouns">
                <Input value={form.pronouns} maxLength={30} onChange={(e) => update('pronouns', e.target.value)} placeholder="they/them" />
              </Field>
              <Field label="Status">
                <Input value={form.status} maxLength={80} onChange={(e) => update('status', e.target.value)} placeholder="Looking for a dispatch role" />
              </Field>
              <Field label="Availability">
                <Input value={form.availability} maxLength={40} onChange={(e) => update('availability', e.target.value)} placeholder="Open to work" />
              </Field>
              <Field label="Location">
                <Input value={form.location} maxLength={80} onChange={(e) => update('location', e.target.value)} placeholder="Manchester, UK" />
              </Field>
              <Field label="Timezone">
                <Input value={form.timezone} maxLength={40} onChange={(e) => update('timezone', e.target.value)} placeholder="GMT / UTC+0" />
              </Field>
              <Field label="Website" className="md:col-span-2">
                <Input value={form.website} maxLength={200} onChange={(e) => update('website', e.target.value)} placeholder="https://example.com" />
              </Field>
              <Field label="Bio" className="md:col-span-2">
                <Textarea value={form.bio} maxLength={500} rows={4} onChange={(e) => update('bio', e.target.value)} placeholder="Tell servers what you bring." />
                <p className="text-xs text-muted-foreground mt-1">{form.bio.length}/500</p>
              </Field>

              <Field label="Skills" className="md:col-span-2">
                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    maxLength={30}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="Add a skill and press Enter"
                  />
                  <Button type="button" variant="secondary" onClick={addSkill}><Plus className="h-4 w-4" /></Button>
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
          <Card className="card-elevated liquid-edge">
            <CardContent className="p-5 space-y-5">
              <Field label="Banner image URL">
                <Input value={form.banner_url} maxLength={500} onChange={(e) => update('banner_url', e.target.value)} placeholder="https://…/banner.jpg" />
                {form.banner_url && (
                  <div className="mt-3 h-28 rounded-xl overflow-hidden border border-white/10">
                    <img src={form.banner_url} alt="banner preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </Field>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Accent color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.accent_color}
                      onChange={(e) => update('accent_color', e.target.value)}
                      className="h-10 w-14 rounded-md bg-transparent border border-white/10 cursor-pointer"
                    />
                    <Input value={form.accent_color} maxLength={9} onChange={(e) => update('accent_color', e.target.value)} />
                  </div>
                </Field>
                <Field label="Theme preset">
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { update('theme_preset', p.id); update('accent_color', p.accent); }}
                        className={`px-3 py-2 rounded-lg text-sm glass glass-hover ${form.theme_preset === p.id ? 'ring-1 ring-white/40' : ''}`}
                      >
                        <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: p.accent }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPERIENCE */}
        <TabsContent value="experience" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="secondary" onClick={addExperience} className="gap-2">
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
                  <Field label="Role">
                    <Input value={e.role} maxLength={80} onChange={(ev) => updateExp(e.id, { role: ev.target.value })} placeholder="Patrol Officer" />
                  </Field>
                  <Field label="Server">
                    <Input value={e.server_name} maxLength={80} onChange={(ev) => updateExp(e.id, { server_name: ev.target.value })} placeholder="Server name" />
                  </Field>
                  <Field label="Department">
                    <Input value={e.department || ''} maxLength={60} onChange={(ev) => updateExp(e.id, { department: ev.target.value })} placeholder="LEO / Fire / EMS" />
                  </Field>
                  <Field label="Start date">
                    <Input type="date" value={e.start_date?.slice(0, 10) || ''} onChange={(ev) => updateExp(e.id, { start_date: ev.target.value })} />
                  </Field>
                  <div className="flex items-center justify-between md:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch checked={e.is_current} onCheckedChange={(c) => updateExp(e.id, { is_current: c })} />
                      <span className="text-sm">Currently here</span>
                    </div>
                    {!e.is_current && (
                      <Field label="End date" className="w-48">
                        <Input type="date" value={e.end_date?.slice(0, 10) || ''} onChange={(ev) => updateExp(e.id, { end_date: ev.target.value })} />
                      </Field>
                    )}
                  </div>
                  <div className="md:col-span-2 flex justify-end">
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
          <Card className="card-elevated liquid-edge">
            <CardContent className="p-5 grid md:grid-cols-2 gap-4">
              {['twitter', 'youtube', 'twitch', 'roblox', 'discord_server', 'github'].map((k) => (
                <Field key={k} label={k.replace('_', ' ')}>
                  <Input
                    value={socials[k] || ''}
                    maxLength={200}
                    onChange={(e) => setSocial(k, e.target.value)}
                    placeholder={`https://…`}
                  />
                </Field>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
