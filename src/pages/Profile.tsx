import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, MessageSquare, MapPin, Globe, Pencil, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import ExperienceCard from '@/components/profile/ExperienceCard';
import ProfileEditor from '@/components/profile/ProfileEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ProfileData {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
  location: string | null;
  timezone: string | null;
  pronouns: string | null;
  status: string | null;
  availability: string | null;
  website: string | null;
  banner_url: string | null;
  accent_color: string | null;
  theme_preset: string | null;
  social_links: Record<string, string> | null;
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
  const { profile: meProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const isOwner = !!(meProfile && profile && meProfile.id === profile.id);

  useEffect(() => {
    if (id) fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileData) {
      setProfile(profileData as any);
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
          <div className="animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
          <Link to="/browse">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to members
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const accent = profile.accent_color || '#ffffff';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Banner */}
      <div className="relative h-48 md:h-60 w-full overflow-hidden border-b border-white/10">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(900px 300px at 20% 0%, ${accent}22, transparent 60%), radial-gradient(700px 250px at 90% 100%, ${accent}1a, transparent 60%), linear-gradient(180deg, hsl(0 0% 8%), hsl(0 0% 4%))`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative">
        <div className="flex items-center justify-between mb-4">
          <Link to="/browse">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          {isOwner && !editMode && (
            <Button size="sm" onClick={() => setEditMode(true)} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit profile
            </Button>
          )}
        </div>

        {editMode && isOwner ? (
          <ProfileEditor
            profile={profile as any}
            experiences={experiences}
            onSaved={() => { setEditMode(false); fetchProfile(); }}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card className="card-elevated liquid-edge sticky top-20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-20 w-20 ring-2" style={{ boxShadow: `0 0 0 2px ${accent}55` }}>
                      <AvatarImage src={profile.discord_avatar || undefined} />
                      <AvatarFallback className="text-xl bg-secondary">
                        {profile.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold truncate">{profile.display_name || 'Discord member'}</h1>
                        {profile.is_verified && (
                          <Badge className="badge-verified text-[10px] px-1.5 py-0">Verified</Badge>
                        )}
                      </div>
                      {profile.pronouns && (
                        <p className="text-xs text-muted-foreground mt-0.5">{profile.pronouns}</p>
                      )}
                      {profile.status && (
                        <p className="text-sm mt-1.5" style={{ color: accent }}>{profile.status}</p>
                      )}
                    </div>
                  </div>

                  {profile.availability && (
                    <Badge variant="outline" className="mb-3 border-white/20">
                      {profile.availability}
                    </Badge>
                  )}

                  {profile.rating > 0 && (
                    <div className="flex justify-end mb-4">
                      <RatingStars rating={profile.rating} count={profile.review_count} size="sm" />
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground mb-4">
                    {profile.bio || 'This member has not added profile details yet.'}
                  </p>

                  <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                    {profile.location && (
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {profile.location}</div>
                    )}
                    {profile.timezone && (
                      <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {profile.timezone}</div>
                    )}
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                        <Globe className="h-3.5 w-3.5" /> {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>

                  {profile.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {profile.skills.map((skill) => (
                        <SkillBadge key={skill} skill={skill} />
                      ))}
                    </div>
                  )}

                  {profile.social_links && Object.keys(profile.social_links).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {Object.entries(profile.social_links).map(([k, v]) => (
                        <a key={k} href={v} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-md glass glass-hover capitalize">
                          {k.replace('_', ' ')}
                        </a>
                      ))}
                    </div>
                  )}

                  {!isOwner && (
                    <div className="flex gap-2 pt-4 border-t border-white/10">
                      <Link to="/messages" className="flex-1">
                        <Button className="w-full gap-2" size="sm">
                          <MessageSquare className="h-4 w-4" /> Message
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Tabs defaultValue="experience" className="w-full">
                <TabsList className="glass mb-4">
                  <TabsTrigger value="experience" className="gap-1.5 text-sm">
                    <Briefcase className="h-4 w-4" /> Experience
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
                        <h3 className="font-semibold mb-1">No experience yet</h3>
                        <p className="text-sm text-muted-foreground">
                          {isOwner ? 'Hit Edit profile to add your first role.' : 'This member has not added experience yet.'}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
