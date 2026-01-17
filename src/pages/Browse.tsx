import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, CheckCircle2, Clock, Star, Users, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import { mockProfiles, sortOptions } from '@/lib/mockData';

const Browse = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filteredProfiles = useMemo(() => {
    let result = [...mockProfiles];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.displayName.toLowerCase().includes(query) ||
          p.skills.some(s => s.toLowerCase().includes(query)) ||
          p.bio?.toLowerCase().includes(query)
      );
    }
    
    // Verified filter
    if (verifiedOnly) {
      result = result.filter(p => p.isVerified);
    }
    
    // Sort
    switch (activeSort) {
      case 'top-rated':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'most-members':
        result.sort((a, b) => b.totalMembersServed - a.totalMembersServed);
        break;
      case 'most-experience':
        result.sort((a, b) => b.totalDaysExperience - a.totalDaysExperience);
        break;
      case 'a-z':
        result.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    }
    
    return result;
  }, [searchQuery, activeSort, verifiedOnly]);

  const sortIcons: Record<string, React.ReactNode> = {
    newest: <Clock className="h-4 w-4" />,
    'top-rated': <Star className="h-4 w-4" />,
    'most-members': <Users className="h-4 w-4" />,
    'most-experience': <Clock className="h-4 w-4" />,
    'a-z': <ArrowUpDown className="h-4 w-4" />,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">E</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Browse Professionals</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Discover talented staff, developers, and designers in the ER:LC community
            </p>
          </div>
          
          {/* Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, or experience..."
                className="pl-12 pr-12 h-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Sort Options */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                variant={activeSort === option.value ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
                onClick={() => setActiveSort(option.value)}
              >
                {sortIcons[option.value]}
                {option.label}
              </Button>
            ))}
          </div>
          
          {/* Verified Filter */}
          <div className="flex justify-center mb-8">
            <Button
              variant={verifiedOnly ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Verified Only
            </Button>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              Showing {filteredProfiles.length} professional{filteredProfiles.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {filteredProfiles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No professionals found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Browse;
