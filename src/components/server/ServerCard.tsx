import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/mockData';

interface ServerCardProps {
  server: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    member_count: number;
    staff_count: number;
    is_verified: boolean;
    is_featured: boolean;
    is_hiring: boolean;
    tags: string[];
    discord_invite?: string | null;
  };
}

const ServerCard = ({ server }: ServerCardProps) => {
  return (
    <Card className="group card-interactive h-full">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 rounded-xl ring-2 ring-border group-hover:ring-primary/50 transition-all flex-shrink-0">
            <AvatarImage src={server.icon || undefined} alt={server.name} className="object-cover" />
            <AvatarFallback className="rounded-xl text-lg bg-secondary">{server.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                {server.name}
              </h3>
              {server.is_verified && (
                <CheckCircle2 className="h-4 w-4 text-verified flex-shrink-0" />
              )}
              {server.is_featured && (
                <Badge className="badge-featured text-[10px] px-1.5 py-0">Featured</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              {server.is_hiring && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-300 bg-emerald-500/5">
                  Hiring
                </Badge>
              )}
              {server.tags?.slice(0, 2).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {server.description || 'No description'}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {formatNumber(server.member_count)}
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  {server.staff_count} staff
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {server.discord_invite && (
                  <a href={server.discord_invite} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" className="h-7 px-2.5 text-xs gap-1.5">
                      <ExternalLink className="h-3 w-3" /> Discord
                    </Button>
                  </a>
                )}
                <Link to={`/server/${server.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    View
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerCard;
