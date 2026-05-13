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
  Sparkles,
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
import { useState, useMemo, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { profilePath, profileEditorPath } from '@/lib/profilePath';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { getDiscordSessionDisplay } from '@/lib/syncDiscordProfile';
import { safeAvatarUrl, avatarReferrerPolicy } from '@/lib/safeAvatarUrl';
import { NotificationsBell } from '@/components/layout/NotificationsBell';

const NAV_FLOAT_TOP_PX = 12;
const NAV_BAR_H_PX = 56;
const NAV_FLOAT_BOTTOM_PX = 12;
const SCROLL_COMPACT_THRESHOLD = 48;
const SCROLL_DELTA_TRIGGER = 8;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navCompact, setNavCompact] = useState(false);
  const lastScrollY = useRef(0);
  const { user, profile, signOut } = useAuth();
  const { isStaff } = useStaffAccess();
  const discordUi = useMemo(() => getDiscordSessionDisplay(user), [user]);
  const navDisplayName = profile?.display_name ?? discordUi?.displayName ?? 'Member';
  const navDiscordUsername = profile?.discord_username ?? discordUi?.discordUsername ?? 'user';
  const navAvatarUrl = safeAvatarUrl(profile?.discord_avatar ?? discordUi?.avatarUrl ?? null);
  const navInitial = (navDisplayName || 'U').charAt(0).toUpperCase();

  const navLinks = useMemo(() => {
    const out: Array<{ path: string; label: string; icon: LucideIcon; auth?: boolean }> = [
      { path: '/browse', label: 'Members', icon: Users },
      { path: '/servers', label: 'Servers', icon: Building2 },
      { path: '/posts', label: 'Posts', icon: FileText },
    ];
    if (!profile?.is_pro) {
      out.push({ path: '/pro', label: 'Pro', icon: Sparkles });
    }
    out.push({ path: '/messages', label: 'Messages', icon: MessageSquare, auth: true });
    return out;
  }, [profile?.is_pro]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    if (window.scrollY < SCROLL_COMPACT_THRESHOLD) setNavCompact(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setNavCompact(false);
      return;
    }
    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const prev = lastScrollY.current;
      const delta = y - prev;
      lastScrollY.current = y;

      if (y < SCROLL_COMPACT_THRESHOLD) {
        setNavCompact(false);
        return;
      }
      if (delta > SCROLL_DELTA_TRIGGER) setNavCompact(true);
      else if (delta < -SCROLL_DELTA_TRIGGER) setNavCompact(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;
  const visibleLinks = navLinks.filter((l) => !l.auth || user);
  const layoutTopSpacer = NAV_FLOAT_TOP_PX + NAV_BAR_H_PX + NAV_FLOAT_BOTTOM_PX;

  return (
    <>
      <div style={{ height: layoutTopSpacer }} aria-hidden />

      <header
        className="fixed left-0 right-0 z-50 flex justify-center px-3 sm:px-5 pointer-events-none"
        style={{ top: NAV_FLOAT_TOP_PX }}
      >
        <div
          className={cn(
            'pointer-events-auto w-full max-w-5xl overflow-hidden border border-white/[0.09]',
            'bg-zinc-950/90 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/75',
            'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_40px_-10px_rgba(0,0,0,0.65),0_0_28px_-12px_rgba(255,255,255,0.12)]',
            'transition-[border-radius,box-shadow] duration-300 ease-out',
            navCompact ? 'rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_28px_-8px_rgba(0,0,0,0.55)]' : 'rounded-2xl',
          )}
        >
          <div
            className={cn(
              'flex items-center transition-[height,padding,gap] duration-300 ease-out',
              navCompact ? 'h-11 gap-2 px-2.5 sm:gap-2.5 sm:px-3' : 'h-14 gap-2 px-3 sm:gap-4 sm:px-4',
            )}
          >
          <Link
            to="/"
            className={cn(
              'flex items-center shrink-0 group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/35 transition-[gap] duration-300',
              navCompact ? 'gap-2' : 'gap-2.5',
            )}
          >
            <img
              src={logo}
              alt=""
              className={cn(
                'logo-mark object-contain transition-all duration-300 ease-out group-hover:opacity-90',
                navCompact ? 'h-6 w-6' : 'h-7 w-7',
              )}
              width={28}
              height={28}
              aria-hidden
            />
            <span
              className={cn(
                'font-semibold tracking-tight text-white truncate min-w-0 transition-[font-size,line-height] duration-300 ease-out',
                navCompact ? 'text-xs' : 'text-sm',
              )}
            >
              ERLC Directory
            </span>
          </Link>

          <nav
            id="tutorial-main-nav"
            className="hidden md:flex flex-1 items-center justify-center gap-0.5 min-w-0"
            aria-label="Main"
          >
            {visibleLinks.map(({ path, label, icon: Icon }) => {
              const active = isActive(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'relative rounded-md font-medium transition-all duration-300 ease-out inline-flex items-center gap-1.5',
                    navCompact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm gap-2',
                    active
                      ? 'text-white bg-white/[0.09]'
                      : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.05]',
                  )}
                >
                  <Icon
                    className={cn(
                      'shrink-0 transition-[width,height] duration-300 ease-out',
                      navCompact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                      active ? 'text-white' : 'opacity-80',
                    )}
                  />
                  <span className="hidden lg:inline">{label}</span>
                  {active ? (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-px rounded-full bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-90"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {user && profile?.id && (
              <>
                <button
                  id="tutorial-nav-add-experience"
                  type="button"
                  className={cn(
                    'hidden md:inline-flex rounded-lg items-center justify-center border border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.13] transition-all duration-300 ease-out shadow-lg shadow-white/12',
                    navCompact ? 'h-8 w-8' : 'h-9 w-9',
                  )}
                  aria-label="Add experience"
                  onClick={() =>
                    navigate(profileEditorPath(profile, { tab: 'experience', addExperience: true }))
                  }
                >
                  <Plus className={cn('transition-[width,height] duration-300', navCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                </button>
                <NotificationsBell />
              </>
            )}

            <button
              type="button"
              className={cn(
                'md:hidden rounded-md inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-300 ease-out border border-transparent hover:border-white/10',
                navCompact ? 'h-9 w-9' : 'h-10 w-10',
              )}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="tutorial-nav-account-trigger"
                    className={cn(
                      'rounded-lg pl-1 flex items-center border border-white/10 bg-white/[0.04]',
                      'hover:bg-white/[0.07] hover:border-white/15 transition-all duration-300 ease-out',
                      navCompact ? 'pr-2 py-0.5 gap-1.5' : 'pr-2.5 py-1 gap-2',
                    )}
                  >
                    <Avatar
                      className={cn(
                        'ring-1 ring-white/10 transition-[width,height] duration-300 ease-out',
                        navCompact ? 'h-7 w-7' : 'h-8 w-8',
                      )}
                    >
                      <AvatarImage
                        src={navAvatarUrl}
                        loading="eager"
                        fetchPriority="high"
                        referrerPolicy={avatarReferrerPolicy(navAvatarUrl)}
                      />
                      <AvatarFallback className="text-xs bg-zinc-800">{navInitial}</AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        'hidden sm:flex flex-col items-start leading-none max-w-[7rem] transition-opacity duration-300',
                        navCompact && 'max-w-[5.5rem]',
                      )}
                    >
                      <span
                        className={cn(
                          'font-semibold truncate text-zinc-100 w-full transition-[font-size] duration-300',
                          navCompact ? 'text-[11px]' : 'text-xs',
                        )}
                      >
                        {navDisplayName}
                      </span>
                      {!navCompact && (
                        <span className="text-[10px] text-zinc-500 truncate w-full">@{navDiscordUsername}</span>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'text-zinc-500 hidden sm:block shrink-0 transition-[width,height] duration-300',
                        navCompact ? 'h-3 w-3' : 'h-3.5 w-3.5',
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-zinc-950 border-white/10">
                  <div className="flex items-center gap-3 p-3">
                    <Avatar className="h-10 w-10 ring-1 ring-white/10">
                      <AvatarImage
                        src={navAvatarUrl}
                        loading="eager"
                        fetchPriority="high"
                        referrerPolicy={avatarReferrerPolicy(navAvatarUrl)}
                      />
                      <AvatarFallback>{navInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate">{navDisplayName}</span>
                      <span className="text-xs text-muted-foreground truncate">@{navDiscordUsername}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                    <Link to={profile ? profilePath(profile) : '/browse'}>
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">My Profile</span>
                        <span className="text-[11px] text-muted-foreground">View your public profile</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-3 py-2.5 cursor-pointer"
                    onClick={() => profile && navigate(profileEditorPath(profile))}
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
                  {user && isStaff && (
                    <DropdownMenuItem asChild className="gap-3 py-2.5 cursor-pointer">
                      <Link to="/staff">
                        <Shield className="h-4 w-4 text-zinc-400" />
                        <div className="flex flex-col">
                          <span className="text-sm">Staff Panel</span>
                          <span className="text-[11px] text-muted-foreground">Moderation and site tools</span>
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
                    'rounded-lg font-medium border border-white/12 bg-white/[0.06]',
                    'hover:bg-white/[0.1] transition-all duration-300 ease-out',
                    navCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                  )}
                >
                  Sign in
                </button>
              </Link>
            )}
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-white/[0.07] bg-zinc-950/98 backdrop-blur-md px-4 py-3 rounded-b-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1 max-w-lg mx-auto">
              {visibleLinks.map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={isActive(path) ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 h-11 rounded-lg',
                      isActive(path) && 'bg-white/10 text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                </Link>
              ))}
              {user && profile?.id && (
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-3 mt-1 h-11 rounded-lg border border-white/15 bg-white/[0.1] hover:bg-white/[0.15] text-white shadow-md shadow-white/10"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(profileEditorPath(profile, { tab: 'experience', addExperience: true }));
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add experience
                </Button>
              )}
              {!user && (
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full mt-2 h-11 rounded-lg">Sign in</Button>
                </Link>
              )}
            </div>
          </div>
        ) : null}
        </div>
      </header>
    </>
  );
};

export default Navbar;
