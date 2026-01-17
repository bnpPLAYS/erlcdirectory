import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Briefcase, MessageSquare, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import ExperienceCard from '@/components/profile/ExperienceCard';
import { mockProfiles, formatNumber } from '@/lib/mockData';

const socialIcons: Record<string, string> = {
  discord: '💬',
  youtube: '📺',
  twitter: '𝕏',
  github: '💻',
  roblox: '🎮',
  twitch: '📡',
  other: '🔗',
};

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
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="card-elevated sticky top-20">
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/30">
                    <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                    <AvatarFallback className="text-xl bg-secondary">{profile.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h1 className="text-lg font-bold truncate">{profile.displayName}</h1>
                      {profile.isVerified && (
                        <Badge className="badge-verified text-[10px] px-1.5 py-0">Verified</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{profile.discordUsername}</p>
                  </div>
                </div>
                
                {/* Rating */}
                <div className="flex justify-end mb-4">
                  <RatingStars rating={profile.rating} count={profile.ratingCount} size="sm" />
                </div>
                
                {/* Bio */}
                <p className="text-sm text-muted-foreground mb-4">
                  {profile.bio || 'This user hasn\'t added a description yet.'}
                </p>
                
                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      Experiences
                    </span>
                    <span className="font-semibold">{profile.experienceCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Members Served
                    </span>
                    <span className="font-semibold">{formatNumber(profile.totalMembersServed)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Days Experience
                    </span>
                    <span className="font-semibold">{formatNumber(profile.totalDaysExperience)}</span>
                  </div>
                </div>
                
                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} />
                  ))}
                </div>
                
                {/* Social */}
                {profile.socialLinks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">Social Media</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.socialLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-xs"
                        >
                          <span>{socialIcons[link.platform]}</span>
                          {link.username || link.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button className="flex-1 gap-2" size="sm">
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="experience" className="w-full">
              <TabsList className="w-full justify-start mb-4 h-10">
                <TabsTrigger value="experience" className="gap-1.5 text-sm">
                  <MapPin className="h-4 w-4" />
                  Experience
                </TabsTrigger>
                <TabsTrigger value="hobbies" className="text-sm">
                  Hobbies
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="experience" className="space-y-3">
                {profile.experiences.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {profile.experiences.map((exp) => (
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
              
              <TabsContent value="hobbies">
                <Card className="card-elevated">
                  <CardContent className="p-5">
                    {profile.hobbies && profile.hobbies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.hobbies.map((hobby, i) => (
                          <SkillBadge key={i} skill={hobby} variant="outline" />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No hobbies listed.</p>
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
