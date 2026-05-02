import { MapPin, Globe, Clock, Eye, ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import SkillBadge from '@/components/ui/skill-badge';

interface PreviewProps {
  discord_avatar: string | null;
  discord_username: string | null;
  is_verified?: boolean;
  display_name: string;
  bio: string;
  location: string;
  timezone: string;
  pronouns: string;
  status: string;
  availability: string;
  website: string;
  banner_url: string;
  accent_color: string;
  skills: string[];
  social_links: Record<string, string>;
}

const ProfilePreviewCard = (p: PreviewProps) => {
  const accent = p.accent_color || '#ffffff';
  const initial = (p.display_name || p.discord_username || 'U').charAt(0).toUpperCase();
  const socials = Object.entries(p.social_links).filter(([, v]) => v);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Eye className="h-3.5 w-3.5" />
        Live preview — how others see your profile
      </div>

      <Card className="card-elevated liquid-edge overflow-hidden">
        {/* Banner */}
        <div className="relative h-28 w-full overflow-hidden">
          {p.banner_url ? (
            <img src={p.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `radial-gradient(400px 160px at 18% 0%, ${accent}33, transparent 60%), radial-gradient(300px 140px at 92% 100%, ${accent}22, transparent 60%), linear-gradient(180deg, hsl(0 0% 9%), hsl(0 0% 4%))`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          {!p.banner_url && (
            <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> No banner</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
        </div>

        <CardContent className="p-4 -mt-12 relative space-y-3">
          {/* Avatar + name */}
          <div className="flex items-end gap-3">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1 rounded-full blur-md opacity-60"
                style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
                aria-hidden
              />
              <Avatar className="relative h-16 w-16 ring-2 ring-background" style={{ boxShadow: `0 0 0 2px ${accent}66` }}>
                <AvatarImage src={p.discord_avatar || undefined} />
                <AvatarFallback className="text-lg bg-secondary">{initial}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm truncate">{p.display_name || 'Your name'}</h3>
                {p.is_verified && (
                  <Badge className="badge-verified text-[9px] px-1 py-0 h-4">Verified</Badge>
                )}
              </div>
              {p.pronouns && p.pronouns.trim() && (
                <span className="inline-block text-[10px] text-muted-foreground mt-0.5 px-1.5 py-0.5 rounded-full glass">
                  {p.pronouns}
                </span>
              )}
            </div>
          </div>

          {p.status && (
            <p className="text-xs italic line-clamp-2" style={{ color: accent }}>
              "{p.status}"
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {p.availability && (
              <Badge variant="outline" className="border-white/20 text-[10px] gap-1">
                <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
                {p.availability}
              </Badge>
            )}
            {p.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</span>
            )}
            {p.timezone && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.timezone}</span>
            )}
            {p.website && (
              <span className="flex items-center gap-1 truncate max-w-full">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{p.website.replace(/^https?:\/\//, '')}</span>
              </span>
            )}
          </div>

          {/* Bio */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">About</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {p.bio || 'Add a bio to tell people about yourself.'}
            </p>
          </div>

          {p.skills.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1">
                {p.skills.slice(0, 8).map((s) => (
                  <SkillBadge key={s} skill={s} />
                ))}
                {p.skills.length > 8 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{p.skills.length - 8}</span>
                )}
              </div>
            </div>
          )}

          {socials.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Connect</p>
              <div className="flex flex-wrap gap-1.5">
                {socials.map(([k]) => (
                  <span
                    key={k}
                    className="text-[10px] px-1.5 py-0.5 rounded glass capitalize"
                    style={{ borderLeft: `2px solid ${accent}80` }}
                  >
                    {k.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePreviewCard;
