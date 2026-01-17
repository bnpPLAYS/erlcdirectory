// Comprehensive mock data for ERLC Directory

export interface Experience {
  id: string;
  role: string;
  serverName: string;
  serverIcon?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  isVerified: boolean;
  verifiedBy?: {
    username: string;
    avatarUrl?: string;
  };
  verifiedAt?: string;
  isPinned?: boolean;
  memberCount?: number;
  type: 'server' | 'event' | 'development';
}

export interface SocialLink {
  platform: 'discord' | 'youtube' | 'twitter' | 'github' | 'roblox' | 'twitch' | 'other';
  url: string;
  username?: string;
}

export interface Profile {
  id: string;
  displayName: string;
  discordUsername: string;
  discordId?: string;
  avatarUrl: string;
  bannerUrl?: string;
  bio?: string;
  isVerified: boolean;
  isFeatured?: boolean;
  isBot?: boolean;
  isNew?: boolean;
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
  lastActive?: string;
  openToWork?: boolean;
  lookingFor?: string[];
}

export interface Server {
  id: string;
  name: string;
  iconUrl?: string;
  bannerUrl?: string;
  description: string;
  memberCount: number;
  staffCount: number;
  isVerified: boolean;
  isPartner?: boolean;
  category: string;
  tags?: string[];
  inviteUrl?: string;
  createdAt: string;
  openPositions?: number;
}

export interface Post {
  id: string;
  author: Profile;
  type: 'announcement' | 'availability' | 'hiring' | 'looking';
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  likes: number;
  comments: number;
  isSticky?: boolean;
}

// Avatar URLs using placeholder service for consistent look
const avatars = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
];

export const mockProfiles: Profile[] = [
  {
    id: '1',
    displayName: 'Pixel',
    discordUsername: '@pixelnovaa.',
    discordId: '123456789012345678',
    avatarUrl: avatars[4],
    bio: 'This user hasn\'t added a description yet.',
    isVerified: true,
    isFeatured: false,
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
        type: 'server',
        startDate: 'Nov 2022',
        duration: '3 years, 2 months',
        isVerified: true,
        verifiedBy: { username: '@pixelnovaa.', avatarUrl: avatars[4] },
        verifiedAt: '9/22/2025',
        isPinned: true,
        memberCount: 15000,
      },
      {
        id: 'e2',
        role: 'Former Foundation Team',
        serverName: 'Texas State Roleplay',
        type: 'server',
        startDate: 'Mar 2024',
        endDate: 'Oct 2024',
        duration: '7 months, 23 days',
        isVerified: true,
        verifiedBy: { username: '@zieyro', avatarUrl: avatars[1] },
        verifiedAt: '9/23/2025',
        memberCount: 25000,
      },
      {
        id: 'e3',
        role: 'Support',
        serverName: 'ILE Customs',
        type: 'server',
        startDate: 'May 2025',
        duration: '8 months, 19 days',
        isVerified: true,
        verifiedBy: { username: '@officialsteam', avatarUrl: avatars[2] },
        verifiedAt: '9/22/2025',
        memberCount: 8000,
      },
      {
        id: 'e4',
        role: 'Management',
        serverName: 'North Carolina State...',
        type: 'server',
        startDate: 'Sep 2025',
        duration: '4 months, 10 days',
        isVerified: true,
        verifiedBy: { username: '@thatguyvibes305', avatarUrl: avatars[3] },
        verifiedAt: '9/22/2025',
        memberCount: 16126,
      },
    ],
    socialLinks: [
      { platform: 'roblox', url: 'https://roblox.com/users/123', username: 'Roblox' },
    ],
    hobbies: ['Gaming', 'Community Building', 'Event Planning'],
    joinedAt: '2022-11-01',
    lastActive: '2025-01-17',
  },
  {
    id: '2',
    displayName: 'Lavoixy',
    discordUsername: '@lavoixy',
    avatarUrl: avatars[0],
    bio: 'This user hasn\'t added a description yet.',
    isVerified: true,
    isFeatured: true,
    isBot: true,
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
        type: 'server',
        startDate: 'Jan 2023',
        duration: '2 years',
        isVerified: true,
        memberCount: 12757,
      },
    ],
    socialLinks: [],
    joinedAt: '2023-01-15',
    lastActive: '2025-01-16',
  },
  {
    id: '3',
    displayName: 'CJ',
    discordUsername: '@cj_admin',
    avatarUrl: avatars[3],
    bio: 'I\'m retired hehe',
    isVerified: false,
    isNew: true,
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
    lastActive: '2025-01-10',
    openToWork: true,
    lookingFor: ['Moderation', 'Administration'],
  },
  {
    id: '4',
    displayName: 'itsbread',
    discordUsername: '@itsbread',
    avatarUrl: avatars[1],
    bio: 'Hey! I\'m DaBreadBun and I\'ve been an ERLC Administrator for just over a year. I\'m also a long time community member and love helping others.',
    isVerified: false,
    isNew: true,
    rating: 4.8,
    ratingCount: 5,
    totalDaysExperience: 400,
    totalMembersServed: 28000,
    experienceCount: 0,
    skills: ['Administration', 'Moderation', 'Design', 'Support'],
    experiences: [],
    socialLinks: [],
    joinedAt: '2024-01-10',
    lastActive: '2025-01-15',
  },
  {
    id: '5',
    displayName: 'SkyRider',
    discordUsername: '@skyrider99',
    avatarUrl: avatars[5],
    bio: 'Dedicated staff member with experience in multiple large communities. Specializing in moderation training and event coordination.',
    isVerified: true,
    isFeatured: true,
    rating: 4.2,
    ratingCount: 15,
    totalDaysExperience: 1200,
    totalMembersServed: 85000,
    experienceCount: 5,
    skills: ['Moderation', 'Training', 'Events', 'Leadership'],
    experiences: [
      {
        id: 'e6',
        role: 'Head Moderator',
        serverName: 'ERLC Official',
        type: 'server',
        startDate: 'Jun 2023',
        duration: '1 year, 6 months',
        isVerified: true,
        memberCount: 50000,
        verifiedBy: { username: '@erlcstaff', avatarUrl: avatars[0] },
        verifiedAt: '8/15/2024',
      },
      {
        id: 'e7',
        role: 'Event Coordinator',
        serverName: 'ERLC Events',
        type: 'event',
        startDate: 'Jan 2024',
        duration: '1 year',
        isVerified: true,
        memberCount: 15000,
      },
    ],
    socialLinks: [
      { platform: 'youtube', url: 'https://youtube.com/@skyrider', username: 'SkyRider' },
      { platform: 'twitter', url: 'https://twitter.com/skyrider99', username: '@skyrider99' },
    ],
    joinedAt: '2023-06-01',
    lastActive: '2025-01-17',
    openToWork: true,
  },
  {
    id: '6',
    displayName: 'TechWiz',
    discordUsername: '@techwiz_dev',
    avatarUrl: avatars[6],
    bio: 'Full-stack developer specializing in Discord bots and Roblox game development. Open for commissions.',
    isVerified: true,
    rating: 4.9,
    ratingCount: 23,
    totalDaysExperience: 950,
    totalMembersServed: 120000,
    experienceCount: 4,
    skills: ['Development', 'Bot Development', 'Scripting', 'UI/UX'],
    experiences: [
      {
        id: 'e8',
        role: 'Lead Developer',
        serverName: 'ERLC Utilities',
        type: 'development',
        startDate: 'Mar 2023',
        duration: '1 year, 10 months',
        isVerified: true,
        memberCount: 35000,
      },
    ],
    socialLinks: [
      { platform: 'github', url: 'https://github.com/techwiz', username: 'techwiz' },
      { platform: 'discord', url: '#', username: 'TechWiz#0001' },
    ],
    joinedAt: '2023-03-01',
    lastActive: '2025-01-17',
    openToWork: true,
    lookingFor: ['Development', 'Consulting'],
  },
  {
    id: '7',
    displayName: 'Officer_Blake',
    discordUsername: '@officerblake',
    avatarUrl: avatars[7],
    bio: 'Veteran ERLC player and community leader. Focused on roleplay quality and realistic scenarios.',
    isVerified: true,
    rating: 4.4,
    ratingCount: 18,
    totalDaysExperience: 1800,
    totalMembersServed: 95000,
    experienceCount: 7,
    skills: ['Roleplay', 'Leadership', 'Training', 'Moderation', 'Events'],
    experiences: [
      {
        id: 'e9',
        role: 'Chief of Police',
        serverName: 'Liberty County RP',
        type: 'server',
        startDate: 'Jan 2022',
        duration: '3 years',
        isVerified: true,
        memberCount: 45000,
        isPinned: true,
      },
      {
        id: 'e10',
        role: 'Training Director',
        serverName: 'ERLC Academy',
        type: 'server',
        startDate: 'Jun 2023',
        duration: '1 year, 6 months',
        isVerified: true,
        memberCount: 22000,
      },
    ],
    socialLinks: [
      { platform: 'twitch', url: 'https://twitch.tv/officerblake', username: 'officerblake' },
    ],
    joinedAt: '2022-01-15',
    lastActive: '2025-01-16',
  },
];

export const mockServers: Server[] = [
  {
    id: '1',
    name: 'ERLC Events',
    iconUrl: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100&h=100&fit=crop',
    description: 'The official ERLC events server, hosting daily events and competitions for the community.',
    memberCount: 15000,
    staffCount: 25,
    isVerified: true,
    isPartner: true,
    category: 'Events',
    tags: ['Events', 'Competitions', 'Giveaways'],
    createdAt: '2021-06-15',
    openPositions: 3,
  },
  {
    id: '2',
    name: 'Texas State Roleplay',
    iconUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100&h=100&fit=crop',
    description: 'Premier Texas-themed roleplay community with active staff and realistic scenarios.',
    memberCount: 25000,
    staffCount: 45,
    isVerified: true,
    category: 'Roleplay',
    tags: ['Roleplay', 'Serious RP', 'Texas'],
    createdAt: '2020-11-20',
    openPositions: 5,
  },
  {
    id: '3',
    name: 'Circle Support',
    iconUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=100&h=100&fit=crop',
    description: 'Community support and resources for ERLC players. Get help with anything!',
    memberCount: 12757,
    staffCount: 18,
    isVerified: true,
    category: 'Support',
    tags: ['Support', 'Help', 'Resources'],
    createdAt: '2022-03-10',
  },
  {
    id: '4',
    name: 'North Carolina State Roleplay',
    description: 'Active roleplay community based in NC with regular sessions and dedicated staff.',
    memberCount: 16126,
    staffCount: 32,
    isVerified: false,
    category: 'Roleplay',
    tags: ['Roleplay', 'North Carolina'],
    createdAt: '2023-01-05',
    openPositions: 2,
  },
  {
    id: '5',
    name: 'ILE Customs',
    iconUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Custom vehicle and asset creation for ERLC. High quality liveries and modifications.',
    memberCount: 8000,
    staffCount: 12,
    isVerified: true,
    category: 'Creative',
    tags: ['Customs', 'Liveries', 'Design'],
    createdAt: '2022-08-22',
  },
  {
    id: '6',
    name: 'Liberty County RP',
    iconUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=100&h=100&fit=crop',
    description: 'One of the largest ERLC roleplay servers with 24/7 active sessions.',
    memberCount: 45000,
    staffCount: 65,
    isVerified: true,
    isPartner: true,
    category: 'Roleplay',
    tags: ['Roleplay', '24/7', 'Large Community'],
    createdAt: '2020-05-12',
    openPositions: 8,
  },
];

export const mockPosts: Post[] = [
  {
    id: '1',
    author: mockProfiles[4],
    type: 'hiring',
    title: 'Looking for Experienced Moderators',
    content: 'ERLC Events is seeking experienced moderators to join our growing team. Must have at least 6 months of moderation experience in ERLC-related servers.',
    tags: ['Moderator', 'Staff', 'ERLC Events'],
    createdAt: '2025-01-16T14:30:00Z',
    likes: 24,
    comments: 8,
    isSticky: true,
  },
  {
    id: '2',
    author: mockProfiles[5],
    type: 'availability',
    title: 'Available for Bot Development',
    content: 'Open for Discord bot commissions! Specializing in moderation bots, ticket systems, and custom solutions for ERLC communities.',
    tags: ['Development', 'Bots', 'Commissions'],
    createdAt: '2025-01-15T10:00:00Z',
    likes: 45,
    comments: 12,
  },
  {
    id: '3',
    author: mockProfiles[2],
    type: 'looking',
    title: 'Seeking Admin Position',
    content: 'Experienced administrator looking for a new community to call home. Open to moderator or admin roles in active roleplay servers.',
    tags: ['Admin', 'Looking for Work'],
    createdAt: '2025-01-14T18:45:00Z',
    likes: 15,
    comments: 6,
  },
];

export const sortOptions = [
  { value: 'newest', label: 'Newest', icon: 'Clock' },
  { value: 'top-rated', label: 'Top Rated', icon: 'Star' },
  { value: 'most-members', label: 'Most Members', icon: 'Users' },
  { value: 'most-experience', label: 'Most Experience', icon: 'Clock' },
  { value: 'a-z', label: 'A-Z', icon: 'ArrowUpDown' },
] as const;

export const skillCategories = [
  'Moderation',
  'Administration',
  'Leadership',
  'Support',
  'Development',
  'Design',
  'Events',
  'Training',
  'Roleplay',
  'Management',
] as const;

export const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};
