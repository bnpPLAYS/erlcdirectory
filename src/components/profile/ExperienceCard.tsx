import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink, Shield, Star } from 'lucide-react';
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
  verifier_stated_position?: string | null;
  verifier_review_text?: string | null;
  verifier_review_rating?: number | null;
  verified_by_discord_username?: string | null;
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
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="badge-verified text-[10px]">Verified</Badge>
              {experience.verified_by_discord_username && (
                <span className="text-[10px] text-muted-foreground">
                  by @{experience.verified_by_discord_username}
                </span>
              )}
            </div>
            {experience.verifier_stated_position && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-80" />
                <span>
                  <span className="text-foreground/90 font-medium">Verifier position: </span>
                  {experience.verifier_stated_position}
                </span>
              </p>
            )}
            {(experience.verifier_review_rating || experience.verifier_review_text) && (
              <div className="rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2 text-xs">
                {experience.verifier_review_rating ? (
                  <div className="flex items-center gap-1 mb-1 text-amber-200/90">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < experience.verifier_review_rating! ? 'fill-current' : 'opacity-25'}`}
                      />
                    ))}
                  </div>
                ) : null}
                {experience.verifier_review_text ? (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {experience.verifier_review_text}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExperienceCard;
