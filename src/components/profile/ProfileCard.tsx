import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle2, Star, Users, Briefcase } from 'lucide-react';
import SkillBadge from '@/components/ui/skill-badge';

interface ExperiencePreview {
  id: string;
  role: string;
  server_name: string;
  server_icon: string | null;
  is_verified: boolean;
  member_count?: number | null;
}

interface ProfileCardProps {
  profile: {
    id: string;
    display_name: string | null;
    discord_avatar: string | null;
    bio: string | null;
    is_verified: boolean;
    is_featured: boolean;
    rating: number;
    review_count: number;
    skills: string[];
    experiences?: ExperiencePreview[];
    total_members?: number;
  };
}

const formatNumber = (n: number) => {
  if (!n) return '0';
  return n.toLocaleString('en-US');
};

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const traits = (profile.skills || []).slice(0, 3);
  const experiences = (profile.experiences || []).slice(0, 2);
  const remainingExp = Math.max(0, (profile.experiences?.length || 0) - experiences.length);
  const initial = (profile.display_name || 'U').charAt(0).toUpperCase();

  return (
    <Link to={`/profile/${profile.id}`}>
      <Card className="group card-interactive h-full overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.display_name || 'Discord member'}
                </h3>
                {profile.is_featured && <Crown className="h-4 w-4 text-featured" />}
                {profile.is_verified && <CheckCircle2 className="h-4 w-4 text-verified" />}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {profile.is_featured && (
                  <Badge className="badge-featured text-[10px] px-2 py-0">Featured</Badge>
                )}
                {profile.is_verified && (
                  <Badge className="badge-verified text-[10px] px-2 py-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>

              {/* Rating + total members */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {profile.rating > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                    <Star className="h-3 w-3 fill-current" />
                    {profile.rating.toFixed(1)}
                  </span>
                )}
                {(profile.total_members ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full glass">
                    <Users className="h-3 w-3" />
                    {formatNumber(profile.total_members!)}
                  </span>
                )}
              </div>
            </div>

            <Avatar className="h-14 w-14 flex-shrink-0 ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={profile.discord_avatar || undefined} />
              <AvatarFallback className="bg-secondary">{initial}</AvatarFallback>
            </Avatar>
          </div>

          {/* Traits */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((s) => (
                <SkillBadge key={s} skill={s} />
              ))}
            </div>
          )}

          {/* Bio */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {profile.bio || "This user hasn't added a description yet."}
          </p>

          {/* Recent work */}
          {experiences.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Recent work
              </p>
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center gap-2.5 p-2 rounded-md bg-secondary/40 border border-white/5"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={exp.server_icon || undefined} />
                    <AvatarFallback className="text-xs bg-secondary">
                      {exp.server_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-medium truncate">
                      <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                      {exp.role}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                      <span className="truncate">{exp.server_name}</span>
                      {(exp.member_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 shrink-0">
                          <Users className="h-2.5 w-2.5" />
                          {formatNumber(exp.member_count!)}
                        </span>
                      )}
                    </div>
                  </div>
                  {exp.is_verified && (
                    <Badge className="badge-verified text-[9px] px-1.5 py-0 h-5">verified</Badge>
                  )}
                </div>
              ))}
              {remainingExp > 0 && (
                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  +{remainingExp} more experience{remainingExp === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProfileCard;
