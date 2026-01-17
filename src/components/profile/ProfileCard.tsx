import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle2 } from 'lucide-react';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';

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
  };
}

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const displayedSkills = (profile.skills || []).slice(0, 3);
  const remainingSkillsCount = (profile.skills?.length || 0) - 3;

  return (
    <Link to={`/profile/${profile.id}`}>
      <Card className="group card-interactive h-full overflow-hidden">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.display_name || 'Unknown User'}
                </h3>
                {profile.is_featured && (
                  <Crown className="h-4 w-4 text-featured flex-shrink-0" />
                )}
                {profile.is_verified && (
                  <CheckCircle2 className="h-4 w-4 text-verified flex-shrink-0" />
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {profile.is_featured && (
                  <Badge className="badge-featured text-xs px-2 py-0">
                    Featured
                  </Badge>
                )}
              </div>
            </div>
            
            <Avatar className="h-14 w-14 flex-shrink-0 ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={profile.discord_avatar || undefined} alt={profile.display_name || 'User'} />
              <AvatarFallback className="bg-secondary">{profile.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
          </div>

          {/* Stats Row */}
          {profile.rating > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <RatingStars rating={profile.rating} count={profile.review_count} size="sm" />
            </div>
          )}

          {/* Skills */}
          {displayedSkills.length > 0 && (
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
          )}

          {/* Bio */}
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {profile.bio || 'No bio provided yet.'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProfileCard;
