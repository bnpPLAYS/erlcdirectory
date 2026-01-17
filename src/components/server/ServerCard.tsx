import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck } from 'lucide-react';
import VerifiedBadge from '@/components/ui/verified-badge';
import type { Server } from '@/lib/mockData';

interface ServerCardProps {
  server: Server;
}

const ServerCard = ({ server }: ServerCardProps) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <Link to={`/server/${server.id}`}>
      <Card className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 h-full">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 rounded-xl ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={server.iconUrl} alt={server.name} />
              <AvatarFallback className="rounded-xl text-lg">{server.name[0]}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                  {server.name}
                </h3>
                {server.isVerified && <VerifiedBadge size="sm" />}
              </div>
              
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="text-xs">
                  {server.category}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {server.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {formatNumber(server.memberCount)} members
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck className="h-4 w-4" />
                  {server.staffCount} staff
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ServerCard;
