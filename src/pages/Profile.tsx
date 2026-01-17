import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import ExperienceCard from '@/components/profile/ExperienceCard';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
}

interface Experience {
  id: string;
  role: string;
  server_name: string;
  server_icon: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  is_verified: boolean;
}

const Profile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProfile();
    }
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileData) {
      setProfile(profileData);
      const { data: expData } = await supabase
        .from('experiences')
        .select('*')
        .eq('profile_id', id)
        .order('start_date', { ascending: false });
      
      if (expData) setExperiences(expData);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <Link to="/browse">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Browse
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-6">
        <Link to="/browse">
          <Button variant="ghost" size="sm" className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="card-elevated sticky top-20">
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/30">
                    <AvatarImage src={profile.discord_avatar || undefined} />
                    <AvatarFallback className="text-xl bg-secondary">{profile.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h1 className="text-lg font-bold truncate">{profile.display_name || 'Unknown'}</h1>
                      {profile.is_verified && (
                        <Badge className="badge-verified text-[10px] px-1.5 py-0">Verified</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {profile.rating > 0 && (
                  <div className="flex justify-end mb-4">
                    <RatingStars rating={profile.rating} count={profile.review_count} size="sm" />
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground mb-4">
                  {profile.bio || 'No bio provided.'}
                </p>
                
                {profile.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {profile.skills.map((skill) => (
                      <SkillBadge key={skill} skill={skill} />
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Link to="/messages" className="flex-1">
                    <Button className="w-full gap-2" size="sm">
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Tabs defaultValue="experience" className="w-full">
              <TabsList className="w-full justify-start mb-4 h-10">
                <TabsTrigger value="experience" className="gap-1.5 text-sm">
                  <Briefcase className="h-4 w-4" />
                  Experience
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="experience" className="space-y-3">
                {experiences.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {experiences.map((exp) => (
                      <ExperienceCard key={exp.id} experience={exp} />
                    ))}
                  </div>
                ) : (
                  <Card className="card-elevated">
                    <CardContent className="p-8 text-center">
                      <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-1">No experiences yet</h3>
                      <p className="text-sm text-muted-foreground">
                        This user hasn't added any experiences.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
