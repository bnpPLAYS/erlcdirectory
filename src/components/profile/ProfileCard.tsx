import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Briefcase, Crown, CheckCircle2, Bot } from 'lucide-react';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import { formatNumber, type Profile } from '@/lib/mockData';

interface ProfileCardProps {
  profile: Profile;
}

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const displayedSkills = profile.skills.slice(0, 3);
  const remainingSkillsCount = profile.skills.length - 3;

  return (
    <Link to={`/profile/${profile.id}`}>
      <Card className="group card-interactive h-full overflow-hidden">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.displayName}
                </h3>
                {profile.isFeatured && (
                  <Crown className="h-4 w-4 text-featured flex-shrink-0" />
                )}
                {profile.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-verified flex-shrink-0" />
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {profile.isFeatured && (
                  <Badge className="badge-featured text-xs px-2 py-0">
                    Featured
                  </Badge>
                )}
                {profile.isBot && (
                  <Badge variant="secondary" className="text-xs px-2 py-0 gap-1">
                    <Bot className="h-3 w-3" />
                    BOT
                  </Badge>
                )}
                {profile.isNew && !profile.isFeatured && (
                  <span className="text-xs text-muted-foreground">New profile</span>
                )}
              </div>
            </div>
            
            <Avatar className="h-14 w-14 flex-shrink-0 ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              <AvatarFallback className="bg-secondary">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
          </div>

          {/* Stats Row */}
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
              <SkillBadge key={skill} skill={skill} />
            ))}
            {remainingSkillsCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-secondary/50 rounded-full">
                +{remainingSkillsCount}
              </span>
            )}
          </div>

          {/* Bio */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
            {profile.bio || 'This user hasn\'t added a description yet.'}
          </p>

          {/* Recent Experience */}
          {profile.experiences.length > 0 ? (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Recent Work</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {profile.experiences[0].serverName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{profile.experiences[0].role}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.experiences[0].serverName}
                      {profile.experiences[0].memberCount && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          {formatNumber(profile.experiences[0].memberCount)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {profile.experiences[0].isVerified && (
                  <Badge className="badge-verified text-[10px] px-1.5 py-0 flex-shrink-0">
                    verified
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/30 text-center">
              <Briefcase className="h-4 w-4 mx-auto mb-1 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No experiences yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProfileCard;
