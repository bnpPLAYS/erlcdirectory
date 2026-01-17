import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Briefcase, Crown } from 'lucide-react';
import VerifiedBadge from '@/components/ui/verified-badge';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import type { Profile } from '@/lib/mockData';

interface ProfileCardProps {
  profile: Profile;
}

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const displayedSkills = profile.skills.slice(0, 3);
  const remainingSkillsCount = profile.skills.length - 3;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <Link to={`/profile/${profile.id}`}>
      <Card className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 h-full">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.displayName}
                </h3>
                {profile.isFeatured && (
                  <Crown className="h-4 w-4 text-featured flex-shrink-0" />
                )}
                {profile.isVerified && <VerifiedBadge size="sm" />}
              </div>
              
              {profile.isFeatured && (
                <Badge variant="outline" className="text-featured border-featured/50 text-xs mb-2">
                  Featured
                </Badge>
              )}
              
              {!profile.isFeatured && profile.experienceCount === 0 && (
                <span className="text-xs text-muted-foreground">New profile</span>
              )}
            </div>
            
            <Avatar className="h-14 w-14 flex-shrink-0 ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
            </Avatar>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mb-3">
            <RatingStars rating={profile.rating} count={profile.ratingCount} size="sm" />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {formatNumber(profile.totalMembersServed)}
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {displayedSkills.map((skill) => (
              <SkillBadge key={skill} skill={skill} variant="outline" />
            ))}
            {remainingSkillsCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground">
                +{remainingSkillsCount}
              </span>
            )}
          </div>

          {/* Bio */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {profile.bio || 'This user hasn\'t added a description yet.'}
          </p>

          {/* Recent Experience */}
          {profile.experiences.length > 0 ? (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Recent Work</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                    {profile.experiences[0].serverName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{profile.experiences[0].role}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.experiences[0].serverName}
                      {profile.experiences[0].memberCount && (
                        <span className="ml-1">
                          <Users className="h-2.5 w-2.5 inline mr-0.5" />
                          {formatNumber(profile.experiences[0].memberCount)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {profile.experiences[0].isVerified && (
                  <Badge variant="default" className="bg-verified text-verified-foreground text-xs">
                    verified
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 text-center">
              <Briefcase className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No experiences yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProfileCard;
