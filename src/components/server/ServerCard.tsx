import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Briefcase, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, type Server } from '@/lib/mockData';

interface ServerCardProps {
  server: Server;
}

const ServerCard = ({ server }: ServerCardProps) => {
  return (
    <Card className="group card-interactive h-full">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 rounded-xl ring-2 ring-border group-hover:ring-primary/50 transition-all flex-shrink-0">
            <AvatarImage src={server.iconUrl} alt={server.name} className="object-cover" />
            <AvatarFallback className="rounded-xl text-lg bg-secondary">{server.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                {server.name}
              </h3>
              {server.isVerified && (
                <CheckCircle2 className="h-4 w-4 text-verified flex-shrink-0" />
              )}
              {server.isPartner && (
                <Badge className="badge-featured text-[10px] px-1.5 py-0">Partner</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {server.category}
              </Badge>
              {server.openPositions && server.openPositions > 0 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                  {server.openPositions} open positions
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {server.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {formatNumber(server.memberCount)}
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  {server.staffCount} staff
                </span>
              </div>
              
              <Link to={`/server/${server.id}`}>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                  View
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerCard;
