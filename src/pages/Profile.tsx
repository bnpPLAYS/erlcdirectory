import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Briefcase, MessageSquare, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import VerifiedBadge from '@/components/ui/verified-badge';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import ExperienceCard from '@/components/profile/ExperienceCard';
import { mockProfiles } from '@/lib/mockData';

const Profile = () => {
  const { id } = useParams();
  const profile = mockProfiles.find(p => p.id === id);

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

  const socialPlatformIcons: Record<string, string> = {
    discord: '💬',
    youtube: '▶️',
    twitter: '𝕏',
    github: '🐙',
    roblox: '🎮',
    other: '🔗',
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link to="/browse">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </Button>
        </Link>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                {/* Avatar and Name */}
                <div className="flex items-start gap-4 mb-6">
                  <Avatar className="h-20 w-20 ring-2 ring-primary/50">
                    <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                    <AvatarFallback className="text-2xl">{profile.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-xl font-bold">{profile.displayName}</h1>
                      {profile.isVerified && <VerifiedBadge />}
                    </div>
                    <p className="text-muted-foreground text-sm">{profile.discordUsername}</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {profile.bio || 'This user hasn\'t added a description yet.'}
                    </p>
                  </div>
                </div>
                
                {/* Rating */}
                <div className="flex justify-end mb-6">
                  <RatingStars rating={profile.rating} count={profile.ratingCount} />
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-1 gap-3 mb-6">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      experiences
                    </div>
                    <span className="font-semibold">{profile.experienceCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      members served
                    </div>
                    <span className="font-semibold">{profile.totalMembersServed.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      days experience
                    </div>
                    <span className="font-semibold">{profile.totalDaysExperience.toLocaleString()}</span>
                  </div>
                </div>
                
                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {profile.skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} />
                  ))}
                </div>
                
                {/* Social Links */}
                {profile.socialLinks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Social Media</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.socialLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
                        >
                          <span>{socialPlatformIcons[link.platform]}</span>
                          {link.username || link.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-6 pt-6 border-t border-border">
                  <Button className="flex-1 gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                  <Button variant="outline" size="icon">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="experience" className="w-full">
              <TabsList className="w-full justify-start mb-6">
                <TabsTrigger value="experience" className="gap-2">
                  <MapPin className="h-4 w-4" />
                  Experience & Work
                </TabsTrigger>
                <TabsTrigger value="servers" className="gap-2">
                  <Users className="h-4 w-4" />
                  Servers
                </TabsTrigger>
                <TabsTrigger value="hobbies">Hobbies</TabsTrigger>
              </TabsList>
              
              <TabsContent value="experience" className="space-y-4">
                {profile.experiences.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {profile.experiences.map((exp) => (
                      <ExperienceCard key={exp.id} experience={exp} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No experiences yet</h3>
                      <p className="text-sm text-muted-foreground">
                        This user hasn't added any experiences.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="servers">
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Servers Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">
                      Server connections will be displayed here.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="hobbies">
                <Card>
                  <CardContent className="p-6">
                    {profile.hobbies && profile.hobbies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.hobbies.map((hobby, i) => (
                          <SkillBadge key={i} skill={hobby} variant="outline" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No hobbies listed yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
