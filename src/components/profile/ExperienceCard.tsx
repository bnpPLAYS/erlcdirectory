import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Pin, Trash2, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, type Experience } from '@/lib/mockData';

interface ExperienceCardProps {
  experience: Experience;
  isEditable?: boolean;
}

const ExperienceCard = ({ experience, isEditable = false }: ExperienceCardProps) => {
  return (
    <Card className={`relative card-interactive ${experience.isPinned ? 'border-primary/50' : ''}`}>
      {experience.isPinned && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Pin className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-foreground">{experience.role}</h4>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {experience.type === 'server' ? 'Server' : experience.type === 'event' ? 'Event' : 'Dev'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[10px] font-semibold">
                {experience.serverName[0]}
              </div>
              <span className="truncate">{experience.serverName}</span>
            </div>
          </div>
          
          {isEditable && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pin className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {experience.startDate} - {experience.endDate || 'Present'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {experience.duration}
          </span>
          {experience.memberCount && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {formatNumber(experience.memberCount)}
            </span>
          )}
        </div>

        {experience.isVerified && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <Badge className="badge-verified text-[10px]">verified</Badge>
            {experience.verifiedBy && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Verified by</span>
                {experience.verifiedBy.avatarUrl && (
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={experience.verifiedBy.avatarUrl} />
                    <AvatarFallback className="text-[8px]">{experience.verifiedBy.username[1]}</AvatarFallback>
                  </Avatar>
                )}
                <span className="text-primary">{experience.verifiedBy.username}</span>
                {experience.verifiedAt && <span>• {experience.verifiedAt}</span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceCard;
