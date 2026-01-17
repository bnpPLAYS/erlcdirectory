import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Pin, Trash2, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Experience } from '@/lib/mockData';

interface ExperienceCardProps {
  experience: Experience;
  isEditable?: boolean;
}

const ExperienceCard = ({ experience, isEditable = false }: ExperienceCardProps) => {
  return (
    <Card className={`relative ${experience.isPinned ? 'border-primary/50' : ''}`}>
      {experience.isPinned && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Pin className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground">{experience.role}</h4>
              <Badge variant="outline" className="text-xs">
                Server
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 rounded bg-muted flex items-center justify-center text-xs">
                {experience.serverName[0]}
              </div>
              <span>{experience.serverName}</span>
            </div>
          </div>
          
          {isEditable && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Pin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {experience.startDate} - {experience.endDate || 'Present'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {experience.duration}
          </span>
          {experience.memberCount && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {experience.memberCount.toLocaleString()}
            </span>
          )}
        </div>

        {experience.isVerified && (
          <div className="flex items-center justify-between">
            <Badge className="bg-verified text-verified-foreground">verified</Badge>
            {experience.verifiedBy && (
              <span className="text-xs text-muted-foreground">
                Verified by {experience.verifiedBy} • {experience.verifiedAt}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceCard;
