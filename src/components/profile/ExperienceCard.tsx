import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
  guild_id?: string | null;
}

const ExperienceCard = ({ experience }: { experience: Experience }) => {
  const [serverId, setServerId] = useState<string | null>(null);

  useEffect(() => {
    if (!experience.guild_id) return;
    supabase
      .from('servers')
      .select('id')
      .eq('guild_id', experience.guild_id)
      .maybeSingle()
      .then(({ data }) => setServerId(data?.id || null));
  }, [experience.guild_id]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const ServerHeader = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
      {experience.server_icon ? (
        <img
          src={experience.server_icon}
          alt=""
          className="w-6 h-6 rounded object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-[10px] font-semibold">
          {experience.server_name[0]}
        </div>
      )}
      <span className="truncate">{experience.server_name}</span>
      {serverId && <ExternalLink className="h-3 w-3 opacity-50" />}
    </div>
  );

  return (
    <Card className="card-interactive">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-foreground">{experience.role}</h4>
              {experience.department && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {experience.department}
                </Badge>
              )}
            </div>
            {serverId ? (
              <Link to={`/server/${serverId}`} className="hover:text-foreground transition-colors block">
                {ServerHeader}
              </Link>
            ) : (
              ServerHeader
            )}
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
