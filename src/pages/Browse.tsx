import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, CheckCircle2, Clock, Star, Users, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import ProfileCard from '@/components/profile/ProfileCard';
import { mockProfiles, sortOptions } from '@/lib/mockData';
import logo from '@/assets/logo.png';

const Browse = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filteredProfiles = useMemo(() => {
    let result = [...mockProfiles];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.displayName.toLowerCase().includes(query) ||
          p.skills.some(s => s.toLowerCase().includes(query)) ||
          p.bio?.toLowerCase().includes(query)
      );
    }
    
    if (verifiedOnly) {
      result = result.filter(p => p.isVerified);
    }
    
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
      
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl overflow-hidden">
              <img src={logo} alt="ERLC Directory" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Browse Professionals</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Discover talented staff, developers, and designers in the ER:LC community
            </p>
          </div>
          
          {/* Search */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, skills, or experience..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Sort Options */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                variant={activeSort === option.value ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 text-xs"
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
            Showing {filteredProfiles.length} professional{filteredProfiles.length !== 1 ? 's' : ''}
          </p>
          
          {filteredProfiles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold mb-1">No professionals found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Browse;
