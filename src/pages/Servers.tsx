import { useState } from 'react';
import { Search, Building2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import ServerCard from '@/components/server/ServerCard';
import { mockServers } from '@/lib/mockData';

const Servers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [...new Set(mockServers.map(s => s.category))];

  const filteredServers = mockServers.filter(server => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!server.name.toLowerCase().includes(query) &&
          !server.description.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (verifiedOnly && !server.isVerified) return false;
    if (activeCategory && server.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Server Directory</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Discover verified ERLC communities looking for staff
            </p>
          </div>
          
          {/* Search */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search servers..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <Button
              variant={activeCategory === null ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs"
              onClick={() => setActiveCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs"
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
          
          <div className="flex justify-center mb-8">
            <Button
              variant={verifiedOnly ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified Only
            </Button>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filteredServers.length} server{filteredServers.length !== 1 ? 's' : ''}
          </p>
          
          {filteredServers.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold mb-1">No servers found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Servers;
