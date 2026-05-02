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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Eye className="h-3.5 w-3.5" />
        Live preview — how others see your profile
      </div>

      <Card className="card-elevated liquid-edge overflow-hidden">
        {/* Mini banner */}
        <div className="relative h-24 w-full overflow-hidden">
          {p.banner_url ? (
            <img src={p.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `radial-gradient(400px 140px at 20% 0%, ${accent}22, transparent 60%), radial-gradient(300px 120px at 90% 100%, ${accent}1a, transparent 60%), linear-gradient(180deg, hsl(0 0% 8%), hsl(0 0% 4%))`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          {!p.banner_url && (
            <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> No banner</span>
            </div>
          )}
        </div>

        <CardContent className="p-4 -mt-10 relative">
          <div className="flex items-start gap-3 mb-3">
            <Avatar className="h-16 w-16 ring-2 ring-background" style={{ boxShadow: `0 0 0 2px ${accent}55` }}>
              <AvatarImage src={p.discord_avatar || undefined} />
              <AvatarFallback className="text-lg bg-secondary">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm truncate">{p.display_name || 'Your name'}</h3>
                {p.is_verified && (
                  <Badge className="badge-verified text-[9px] px-1 py-0 h-4">Verified</Badge>
                )}
              </div>
              {p.pronouns && p.pronouns.trim() && (
                <p className="text-[11px] text-muted-foreground">{p.pronouns}</p>
              )}
              {p.status && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: accent }}>{p.status}</p>
              )}
            </div>
          </div>

          {p.availability && (
            <Badge variant="outline" className="mb-2 border-white/20 text-[10px]">
              {p.availability}
            </Badge>
          )}

          <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
            {p.bio || 'Add a bio to tell people about yourself.'}
          </p>

          <div className="space-y-1 text-[11px] text-muted-foreground mb-3">
            {p.location && (
              <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {p.location}</div>
            )}
            {p.timezone && (
              <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {p.timezone}</div>
            )}
            {p.website && (
              <div className="flex items-center gap-1.5 truncate">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{p.website.replace(/^https?:\/\//, '')}</span>
              </div>
            )}
          </div>

          {p.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {p.skills.slice(0, 8).map((s) => (
                <SkillBadge key={s} skill={s} />
              ))}
              {p.skills.length > 8 && (
                <span className="text-[10px] text-muted-foreground self-center">+{p.skills.length - 8}</span>
              )}
            </div>
          )}

          {Object.keys(p.social_links).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/10">
              {Object.entries(p.social_links).filter(([, v]) => v).map(([k]) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded glass capitalize">
                  {k.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePreviewCard;
