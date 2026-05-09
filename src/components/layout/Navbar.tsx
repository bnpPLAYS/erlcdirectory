import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Users,
  Building2,
  FileText,
  MessageSquare,
  LogOut,
  User as UserIcon,
  Settings,
  Pencil,
  Plus,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const navLinks = [
    { path: '/browse', label: 'Members', icon: Users },
    { path: '/servers', label: 'Servers', icon: Building2 },
    { path: '/posts', label: 'Posts', icon: FileText },
    { path: '/messages', label: 'Messages', icon: MessageSquare, auth: true },
  ];

  const isActive = (path: string) => location.pathname === path;
  const visibleLinks = navLinks.filter((l) => !l.auth || user);

  return (
    <>
      <div className="h-24" aria-hidden />

      <header className="fixed top-0 inset-x-0 z-50 px-4 pt-4 pointer-events-none">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-3">
          <div className="flex-1 flex justify-center min-w-0">
            <nav
              className={cn(
                'pointer-events-auto flex items-center gap-0.5 rounded-full px-2 py-1.5',
                'glass-strong liquid-edge shadow-2xl max-w-full',
              )}
            >
              <Link
                to="/"
                className="flex items-center gap-2.5 pl-3 pr-3 py-1.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
              >
                <img
                  src={logo}
                  alt=""
                  className="logo-mark w-6 h-6 object-contain"
                  width={24}
                  height={24}
                  aria-hidden
                />
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold tracking-tight">ER:LC Directory</span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Staff & community network
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-0.5 ml-1">
                {visibleLinks.map(({ path, label, icon: Icon }) => (
                  <Link key={path} to={path}>
                    <button
                      className={cn(
                        'h-9 px-3 rounded-full inline-flex items-center justify-center gap-1.5 text-sm transition-colors',
                        isActive(path)
                          ? 'bg-white/12 text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                      )}
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline">{label}</span>
                    </button>
                  </Link>
                ))}
              </div>

              {user && profile?.id && (
                <button
                  type="button"
                  className="hidden md:inline-flex h-9 w-9 rounded-full items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity ml-1"
                  aria-label="Add experience"
                  onClick={() =>
                    navigate(`/profile/${profile.id}?edit=1&tab=experience&add=1`)
                  }
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}

              <button
                className="md:hidden h-9 w-9 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </nav>
          </div>

          <div className="pointer-events-auto shrink-0">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'glass-strong liquid-edge rounded-full pl-1.5 pr-3 py-1.5 flex items-center gap-2',
                      'hover:bg-white/5 transition-colors shadow-2xl',
                    )}
                  >
                    <Avatar className="h-8 w-8 ring-1 ring-white/15">
                      <AvatarImage src={profile?.discord_avatar || undefined} loading="eager" fetchPriority="high" />
                      <AvatarFallback className="text-xs bg-secondary">
                        {profile?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start leading-none">
                      <span className="text-xs font-semibold truncate max-w-[100px]">
                        {profile?.display_name || 'Member'}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        @{profile?.discord_username || 'user'}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 glass-strong border-white/10">
                  <div className="flex items-center gap-3 p-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.discord_avatar || undefined} loading="eager" fetchPriority="high" />
                      <AvatarFallback>{profile?.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate">{profile?.display_name || 'Member'}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        @{profile?.discord_username || 'user'}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                    <Link to={`/profile/${profile?.id}`}>
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">My Profile</span>
                        <span className="text-[11px] text-muted-foreground">View your public profile</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-3 py-2.5 cursor-pointer"
                    onClick={() => navigate(`/profile/${profile?.id}?edit=1`)}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">Edit Profile</span>
                      <span className="text-[11px] text-muted-foreground">Update your information</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                    <Link to="/messages">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">Messages</span>
                        <span className="text-[11px] text-muted-foreground">Contact other members</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                    <Link to="/connections">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">Connections</span>
                        <span className="text-[11px] text-muted-foreground">Manage your network</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {isAdmin && (
                    <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                      <Link to="/staff">
                        <Shield className="h-4 w-4 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm">Staff Panel</span>
                          <span className="text-[11px] text-muted-foreground">Manage members, servers, and openings</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={signOut}
                    className="gap-3 py-2.5 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-sm">Sign Out</span>
                      <span className="text-[11px] text-muted-foreground">End your session</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <button
                  className={cn(
                    'glass-strong liquid-edge rounded-full px-4 py-2 text-sm font-medium',
                    'hover:bg-white/10 transition-colors shadow-2xl',
                  )}
                >
                  Sign in
                </button>
              </Link>
            )}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mt-3 mx-auto max-w-sm pointer-events-auto glass-strong rounded-2xl p-3 animate-in shadow-2xl border border-white/10">
            <div className="flex flex-col gap-1">
              {visibleLinks.map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={isActive(path) ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                </Link>
              ))}
              {user && profile?.id && (
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-3 mt-1"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(`/profile/${profile.id}?edit=1&tab=experience&add=1`);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add experience
                </Button>
              )}
              {!user && (
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full mt-2">Sign in</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Navbar;
