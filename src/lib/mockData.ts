// Mock data for ERLC Directory

export interface Experience {
  id: string;
  role: string;
  serverName: string;
  serverIcon?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  isPinned?: boolean;
  memberCount?: number;
}

export interface SocialLink {
  platform: 'discord' | 'youtube' | 'twitter' | 'github' | 'roblox' | 'other';
  url: string;
  username?: string;
}

export interface Profile {
  id: string;
  displayName: string;
  discordUsername: string;
  avatarUrl: string;
  bio?: string;
  isVerified: boolean;
  isFeatured?: boolean;
  rating: number;
  ratingCount: number;
  totalDaysExperience: number;
  totalMembersServed: number;
  experienceCount: number;
  skills: string[];
  experiences: Experience[];
  socialLinks: SocialLink[];
  hobbies?: string[];
  joinedAt: string;
}

export interface Server {
  id: string;
  name: string;
  iconUrl?: string;
  description: string;
  memberCount: number;
  staffCount: number;
  isVerified: boolean;
  category: string;
  inviteUrl?: string;
}

export const mockProfiles: Profile[] = [
  {
    id: '1',
    displayName: 'Pixel',
    discordUsername: '@pixelnovaa.',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    bio: 'Experienced ERLC administrator with over 5 years in community management.',
    isVerified: true,
    isFeatured: true,
    rating: 4.1,
    ratingCount: 7,
    totalDaysExperience: 2077,
    totalMembersServed: 64126,
    experienceCount: 6,
    skills: ['Moderation', 'Support', 'Leadership'],
    experiences: [
      {
        id: 'e1',
        role: 'Organizer',
        serverName: 'ERLC Events',
        startDate: 'Nov 2022',
        duration: '3 years, 2 months',
        isVerified: true,
        verifiedBy: '@pixelnovaa.',
        verifiedAt: '9/22/2025',
        isPinned: true,
        memberCount: 15000,
      },
      {
        id: 'e2',
        role: 'Former Foundation Team',
        serverName: 'Texas State Roleplay',
        startDate: 'Mar 2024',
        endDate: 'Oct 2024',
        duration: '7 months, 23 days',
        isVerified: true,
        verifiedBy: '@zieyro',
        verifiedAt: '9/23/2025',
        memberCount: 25000,
      },
      {
        id: 'e3',
        role: 'Support',
        serverName: 'ILE Customs',
        startDate: 'May 2025',
        duration: '8 months, 19 days',
        isVerified: true,
        verifiedBy: '@officialsteam',
        verifiedAt: '9/22/2025',
        memberCount: 8000,
      },
      {
        id: 'e4',
        role: 'Management',
        serverName: 'North Carolina State...',
        startDate: 'Sep 2025',
        duration: '4 months, 10 days',
        isVerified: true,
        verifiedBy: '@thatguyvibes305',
        verifiedAt: '9/22/2025',
        memberCount: 16126,
      },
    ],
    socialLinks: [
      { platform: 'roblox', url: 'https://roblox.com/users/123', username: 'Roblox' },
    ],
    hobbies: ['Gaming', 'Community Building', 'Event Planning'],
    joinedAt: '2022-11-01',
  },
  {
    id: '2',
    displayName: 'Lavoixy',
    discordUsername: '@lavoixy',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'This user hasn\'t added a description yet.',
    isVerified: true,
    isFeatured: true,
    rating: 3.6,
    ratingCount: 12,
    totalDaysExperience: 1500,
    totalMembersServed: 6241173,
    experienceCount: 8,
    skills: ['Moderation', 'Support', 'Leadership'],
    experiences: [
      {
        id: 'e5',
        role: 'Support',
        serverName: 'Circle Support',
        startDate: 'Jan 2023',
        duration: '2 years',
        isVerified: true,
        memberCount: 12757,
      },
    ],
    socialLinks: [],
    joinedAt: '2023-01-15',
  },
  {
    id: '3',
    displayName: 'CJ',
    discordUsername: '@cj_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    bio: 'I\'m retired hehe',
    isVerified: false,
    rating: 4.5,
    ratingCount: 3,
    totalDaysExperience: 890,
    totalMembersServed: 45000,
    experienceCount: 0,
    skills: ['Moderation', 'Administration', 'Design', 'Management'],
    experiences: [],
    socialLinks: [
      { platform: 'discord', url: '#', username: 'CJ#1234' },
    ],
    joinedAt: '2023-06-20',
  },
  {
    id: '4',
    displayName: 'itsbread',
    discordUsername: '@itsbread',
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face',
    bio: 'Hey! I\'m DaBreadBun and I\'ve been an ERLC Administrator for just over a year. I\'m also a long time...',
    isVerified: false,
    rating: 4.8,
    ratingCount: 5,
    totalDaysExperience: 400,
    totalMembersServed: 28000,
    experienceCount: 0,
    skills: ['Administration', 'Moderation', 'Design', 'Support'],
    experiences: [],
    socialLinks: [],
    joinedAt: '2024-01-10',
  },
  {
    id: '5',
    displayName: 'SkyRider',
    discordUsername: '@skyrider99',
    avatarUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face',
    bio: 'Dedicated staff member with experience in multiple large communities.',
    isVerified: true,
    rating: 4.2,
    ratingCount: 15,
    totalDaysExperience: 1200,
    totalMembersServed: 85000,
    experienceCount: 5,
    skills: ['Moderation', 'Training', 'Events'],
    experiences: [
      {
        id: 'e6',
        role: 'Head Moderator',
        serverName: 'ERLC Official',
        startDate: 'Jun 2023',
        duration: '1 year, 6 months',
        isVerified: true,
        memberCount: 50000,
      },
    ],
    socialLinks: [
      { platform: 'youtube', url: 'https://youtube.com/@skyrider', username: 'SkyRider' },
    ],
    joinedAt: '2023-06-01',
  },
];

export const mockServers: Server[] = [
  {
    id: '1',
    name: 'ERLC Events',
    iconUrl: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100&h=100&fit=crop',
    description: 'The official ERLC events server, hosting daily events and competitions.',
    memberCount: 15000,
    staffCount: 25,
    isVerified: true,
    category: 'Events',
  },
  {
    id: '2',
    name: 'Texas State Roleplay',
    iconUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100&h=100&fit=crop',
    description: 'Premier Texas-themed roleplay community with active staff.',
    memberCount: 25000,
    staffCount: 45,
    isVerified: true,
    category: 'Roleplay',
  },
  {
    id: '3',
    name: 'Circle Support',
    iconUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=100&h=100&fit=crop',
    description: 'Community support and resources for ERLC players.',
    memberCount: 12757,
    staffCount: 18,
    isVerified: true,
    category: 'Support',
  },
  {
    id: '4',
    name: 'North Carolina State Roleplay',
    description: 'Active roleplay community based in NC.',
    memberCount: 16126,
    staffCount: 32,
    isVerified: false,
    category: 'Roleplay',
  },
  {
    id: '5',
    name: 'ILE Customs',
    iconUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Custom vehicle and asset creation for ERLC.',
    memberCount: 8000,
    staffCount: 12,
    isVerified: true,
    category: 'Creative',
  },
];

export const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'top-rated', label: 'Top Rated' },
  { value: 'most-members', label: 'Most Members' },
  { value: 'most-experience', label: 'Most Experience' },
  { value: 'a-z', label: 'A-Z' },
] as const;
