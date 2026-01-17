import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users } from 'lucide-react';
import { formatNumber } from '@/lib/mockData';

interface Experience {
  id: string;
  role: string;
  server_name: string;
  server_icon?: string | null;
  department?: string | null;
  start_date: string;
  end_date?: string | null;
  is_current: boolean;
  is_verified: boolean;
}

interface ExperienceCardProps {
  experience: Experience;
}

const ExperienceCard = ({ experience }: ExperienceCardProps) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <Card className="card-interactive">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-foreground">{experience.role}</h4>
              {experience.department && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {experience.department}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[10px] font-semibold">
                {experience.server_name[0]}
              </div>
              <span className="truncate">{experience.server_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(experience.start_date)} - {experience.end_date ? formatDate(experience.end_date) : 'Present'}
          </span>
        </div>

        {experience.is_verified && (
          <div className="pt-2 border-t border-border/50">
            <Badge className="badge-verified text-[10px]">verified</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceCard;
