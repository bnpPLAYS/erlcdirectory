import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle2, Star, Users, Gem } from 'lucide-react';
import SkillBadge from '@/components/ui/skill-badge';
import { profilePath } from '@/lib/profilePath';
import { experienceRoleDisplay } from '@/lib/experienceConstants';
import { cn } from '@/lib/utils';
import { DIRECTORY_STAFF_VERIFIED_TITLE } from '@/lib/directoryVerified';
import { safeAvatarUrl, avatarReferrerPolicy } from '@/lib/safeAvatarUrl';

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
    discord_username?: string | null;
    display_name: string | null;
    discord_avatar: string | null;
    bio: string | null;
    is_verified: boolean;
    is_featured: boolean;
    is_pro?: boolean;
    pro_badge_label?: string | null;
    rating: number;
    review_count: number;
    skills: string[];
    created_at?: string;
    experiences?: ExperiencePreview[];
    total_members?: number;
  };
}

const formatNumber = (n: number) => {
  if (!n && n !== 0) return '0';
  return n.toLocaleString('en-US');
};

const MS_DAY = 86400000;
const isNewProfile = (created_at?: string) => {
  if (!created_at) return false;
  return Date.now() - new Date(created_at).getTime() < 14 * MS_DAY;
};

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const traits = (profile.skills || []).slice(0, 4);
  const experiences = (profile.experiences || []).slice(0, 2);
  const remainingExp = Math.max(0, (profile.experiences?.length || 0) - experiences.length);
  const initial = (profile.display_name || 'U').charAt(0).toUpperCase();
  const showNewBadge = isNewProfile(profile.created_at);
  const cardAvatarSrc = safeAvatarUrl(profile.discord_avatar);

  return (
    <Link to={profilePath(profile)} className="block h-full">
      <Card
        className={cn(
          'hover-lift group h-full overflow-hidden rounded-2xl border border-white/10 bg-[hsl(240_6%_8%/0.85)] shadow-lg transition-colors duration-300 hover:border-white/14 hover:bg-[hsl(240_6%_10%/0.9)]',
          profile.is_pro && 'ring-1 ring-white/12 border-white/14',
        )}
      >
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.display_name || 'Discord member'}
                </h3>
                {profile.is_featured && (
                  <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-2">
                {profile.is_featured && (
                  <Badge className="rounded-md border border-white/25 bg-white/[0.08] text-[10px] px-2 py-0 font-medium text-zinc-100">
                    Featured
                  </Badge>
                )}
                {showNewBadge && (
                  <Badge
                    variant="outline"
                    className="rounded-md border-white/15 bg-white/[0.06] text-[10px] px-2 py-0 text-muted-foreground"
                  >
                    New profile
                  </Badge>
                )}
                {profile.is_verified && (
                  <Badge
                    className="badge-verified text-[10px] px-2 py-0 gap-1 rounded-md"
                    title={DIRECTORY_STAFF_VERIFIED_TITLE}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
                {profile.is_pro && (
                  <Badge className="text-[10px] px-2 py-0 gap-1 rounded-md border border-white/22 bg-white/[0.08] text-zinc-100">
                    <Gem className="h-3 w-3 text-white/85" aria-hidden />
                    Pro
                  </Badge>
                )}
                {profile.is_pro && profile.pro_badge_label ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0 rounded-md border-white/15 text-muted-foreground max-w-[8rem] truncate"
                    title={profile.pro_badge_label}
                  >
                    {profile.pro_badge_label}
                  </Badge>
                ) : null}
              </div>

              {/* Rating + aggregated reach */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {profile.rating > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {profile.rating.toFixed(1)}
                  </span>
                )}
                {(profile.total_members ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="tabular-nums">{formatNumber(profile.total_members!)}</span>
                  </span>
                )}
              </div>
            </div>

            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 ring-2 ring-white/10 group-hover:ring-primary/40 transition-all rounded-full">
              <AvatarImage src={cardAvatarSrc} referrerPolicy={avatarReferrerPolicy(cardAvatarSrc)} />
              <AvatarFallback className="bg-secondary text-base font-semibold">{initial}</AvatarFallback>
            </Avatar>
          </div>

          {/* Skills */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((s) => (
                <SkillBadge key={s} skill={s} />
              ))}
            </div>
          )}

          {/* Bio */}
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {profile.bio || "This user hasn't added a description yet."}
          </p>

          {/* Recent work — matches directory-style rows */}
          {experiences.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">
                Recent work
              </p>
              <div className="space-y-2">
                {experiences.map((exp) => {
                  const roleHeadline = experienceRoleDisplay(exp.role, exp.is_verified);
                  const expIconSrc = safeAvatarUrl(exp.server_icon);
                  return (
                  <div
                    key={exp.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5"
                  >
                    <Avatar className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10">
                      <AvatarImage
                        src={expIconSrc}
                        className="object-cover"
                        referrerPolicy={avatarReferrerPolicy(expIconSrc)}
                      />
                      <AvatarFallback className="text-xs font-semibold bg-white/10">
                        {exp.server_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          roleHeadline.mode === 'pending'
                            ? 'text-muted-foreground font-medium'
                            : 'text-foreground',
                        )}
                      >
                        {roleHeadline.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="truncate">{exp.server_name}</span>
                        <span className="inline-flex items-center gap-0.5 shrink-0 tabular-nums">
                          <Users className="h-3 w-3 opacity-70" aria-hidden />
                          {formatNumber(exp.member_count ?? 0)}
                        </span>
                      </div>
                    </div>
                    {exp.is_verified && (
                      <Badge className="shrink-0 rounded border border-emerald-500/45 bg-emerald-500/15 text-[10px] px-2 py-0 font-medium text-emerald-300">
                        verified
                      </Badge>
                    )}
                  </div>
                );
                })}
              </div>
              {remainingExp > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-3 font-medium">
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
