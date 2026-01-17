// Original mock data for ERLC Directory - unique fictional profiles

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

// Original avatar URLs
const avatars = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
];

// ORIGINAL fictional profiles - not from any existing site
export const mockProfiles: Profile[] = [
  {
    id: '1',
    displayName: 'Marcus_RP',
    discordUsername: '@marcus_rp',
    avatarUrl: avatars[0],
    bio: 'Senior community manager with 4+ years in ERLC. Focused on building positive roleplay environments.',
    isVerified: true,
    isFeatured: true,
    rating: 4.7,
    ratingCount: 34,
    totalDaysExperience: 1456,
    totalMembersServed: 89000,
    experienceCount: 8,
    skills: ['Administration', 'Moderation', 'Training', 'Events'],
    experiences: [
      {
        id: 'e1',
        role: 'Community Manager',
        serverName: 'Riverside County RP',
        type: 'server',
        startDate: 'Jan 2022',
        duration: '3 years',
        isVerified: true,
        verifiedBy: { username: '@serverowner', avatarUrl: avatars[2] },
        verifiedAt: '12/10/2024',
        isPinned: true,
        memberCount: 32000,
      },
      {
        id: 'e2',
        role: 'Head Admin',
        serverName: 'Metro City Roleplay',
        type: 'server',
        startDate: 'Mar 2021',
        endDate: 'Dec 2021',
        duration: '9 months',
        isVerified: true,
        memberCount: 18000,
      },
    ],
    socialLinks: [
      { platform: 'roblox', url: '#', username: 'MarcusRP' },
      { platform: 'discord', url: '#', username: 'Marcus#0001' },
    ],
    hobbies: ['Gaming', 'Streaming', 'Community Building'],
    joinedAt: '2021-01-15',
    lastActive: '2025-01-17',
  },
  {
    id: '2',
    displayName: 'Elena_Dev',
    discordUsername: '@elenadev',
    avatarUrl: avatars[1],
    bio: 'Full-stack developer specializing in Discord bots and Roblox integrations. Open for commissions!',
    isVerified: true,
    isFeatured: true,
    rating: 4.9,
    ratingCount: 52,
    totalDaysExperience: 980,
    totalMembersServed: 156000,
    experienceCount: 6,
    skills: ['Development', 'Bot Development', 'UI/UX', 'Scripting'],
    experiences: [
      {
        id: 'e3',
        role: 'Lead Developer',
        serverName: 'ERLC Tools Hub',
        type: 'development',
        startDate: 'Jun 2023',
        duration: '1 year, 7 months',
        isVerified: true,
        isPinned: true,
        memberCount: 45000,
      },
    ],
    socialLinks: [
      { platform: 'github', url: '#', username: 'elenadev' },
      { platform: 'twitter', url: '#', username: '@elena_dev' },
    ],
    joinedAt: '2023-06-01',
    lastActive: '2025-01-17',
    openToWork: true,
    lookingFor: ['Development', 'Consulting'],
  },
  {
    id: '3',
    displayName: 'Chief_Jackson',
    discordUsername: '@chiefjackson',
    avatarUrl: avatars[2],
    bio: 'Veteran ERLC player and roleplay leader. 5 years of experience running police departments.',
    isVerified: true,
    rating: 4.5,
    ratingCount: 41,
    totalDaysExperience: 1820,
    totalMembersServed: 112000,
    experienceCount: 12,
    skills: ['Leadership', 'Roleplay', 'Training', 'Management', 'Events'],
    experiences: [
      {
        id: 'e4',
        role: 'Police Chief',
        serverName: 'Oakwood County RP',
        type: 'server',
        startDate: 'Feb 2020',
        duration: '4 years, 11 months',
        isVerified: true,
        isPinned: true,
        memberCount: 52000,
        verifiedBy: { username: '@oakwoodstaff' },
        verifiedAt: '01/05/2025',
      },
      {
        id: 'e5',
        role: 'Training Director',
        serverName: 'ERLC Academy Server',
        type: 'server',
        startDate: 'Aug 2022',
        duration: '2 years, 5 months',
        isVerified: true,
        memberCount: 28000,
      },
    ],
    socialLinks: [
      { platform: 'twitch', url: '#', username: 'chiefjackson_live' },
    ],
    joinedAt: '2020-02-01',
    lastActive: '2025-01-16',
  },
  {
    id: '4',
    displayName: 'Luna_Mod',
    discordUsername: '@lunamod',
    avatarUrl: avatars[3],
    bio: 'Experienced moderator looking to help communities grow. Specializing in conflict resolution.',
    isVerified: false,
    isNew: true,
    rating: 4.2,
    ratingCount: 8,
    totalDaysExperience: 245,
    totalMembersServed: 15000,
    experienceCount: 2,
    skills: ['Moderation', 'Support', 'Community Management'],
    experiences: [
      {
        id: 'e6',
        role: 'Senior Moderator',
        serverName: 'Coastal City RP',
        type: 'server',
        startDate: 'Jul 2024',
        duration: '6 months',
        isVerified: true,
        memberCount: 12000,
      },
    ],
    socialLinks: [],
    joinedAt: '2024-07-15',
    lastActive: '2025-01-17',
    openToWork: true,
    lookingFor: ['Moderation', 'Administration'],
  },
  {
    id: '5',
    displayName: 'Tyler_Events',
    discordUsername: '@tylerevents',
    avatarUrl: avatars[4],
    bio: 'Event coordinator and host. I create memorable experiences for ERLC communities.',
    isVerified: true,
    rating: 4.6,
    ratingCount: 29,
    totalDaysExperience: 890,
    totalMembersServed: 67000,
    experienceCount: 5,
    skills: ['Events', 'Hosting', 'Organization', 'Moderation'],
    experiences: [
      {
        id: 'e7',
        role: 'Event Coordinator',
        serverName: 'ERLC Community Events',
        type: 'event',
        startDate: 'Mar 2023',
        duration: '1 year, 10 months',
        isVerified: true,
        memberCount: 38000,
      },
    ],
    socialLinks: [
      { platform: 'youtube', url: '#', username: 'TylerEvents' },
    ],
    joinedAt: '2023-03-01',
    lastActive: '2025-01-15',
  },
  {
    id: '6',
    displayName: 'Nova_Support',
    discordUsername: '@novasupport',
    avatarUrl: avatars[5],
    bio: 'Dedicated support staff. I help players and communities solve problems quickly.',
    isVerified: true,
    rating: 4.8,
    ratingCount: 63,
    totalDaysExperience: 1100,
    totalMembersServed: 95000,
    experienceCount: 7,
    skills: ['Support', 'Moderation', 'Documentation', 'Training'],
    experiences: [
      {
        id: 'e8',
        role: 'Support Lead',
        serverName: 'ERLC Help Center',
        type: 'server',
        startDate: 'Nov 2022',
        duration: '2 years, 2 months',
        isVerified: true,
        isPinned: true,
        memberCount: 55000,
      },
    ],
    socialLinks: [
      { platform: 'discord', url: '#', username: 'Nova#5555' },
    ],
    joinedAt: '2022-11-01',
    lastActive: '2025-01-17',
  },
  {
    id: '7',
    displayName: 'DesignByMax',
    discordUsername: '@designbymax',
    avatarUrl: avatars[6],
    bio: 'Graphic designer creating custom liveries, logos, and assets for ERLC servers.',
    isVerified: true,
    isFeatured: true,
    rating: 4.9,
    ratingCount: 87,
    totalDaysExperience: 750,
    totalMembersServed: 134000,
    experienceCount: 4,
    skills: ['Design', 'Graphics', 'Liveries', 'Branding'],
    experiences: [
      {
        id: 'e9',
        role: 'Lead Designer',
        serverName: 'Custom Creations Hub',
        type: 'development',
        startDate: 'Apr 2023',
        duration: '1 year, 9 months',
        isVerified: true,
        memberCount: 22000,
      },
    ],
    socialLinks: [
      { platform: 'twitter', url: '#', username: '@designbymax' },
      { platform: 'roblox', url: '#', username: 'DesignByMax' },
    ],
    joinedAt: '2023-04-01',
    lastActive: '2025-01-16',
    openToWork: true,
  },
];

// Original fictional servers
export const mockServers: Server[] = [
  {
    id: '1',
    name: 'Riverside County RP',
    iconUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=100&h=100&fit=crop',
    description: 'Premier roleplay community with daily sessions and professional staff team.',
    memberCount: 32000,
    staffCount: 45,
    isVerified: true,
    isPartner: true,
    category: 'Roleplay',
    tags: ['Serious RP', '24/7', 'Active'],
    createdAt: '2021-03-15',
    openPositions: 5,
  },
  {
    id: '2',
    name: 'Metro City Roleplay',
    iconUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=100&h=100&fit=crop',
    description: 'Urban roleplay server with realistic city scenarios and active community.',
    memberCount: 18000,
    staffCount: 28,
    isVerified: true,
    category: 'Roleplay',
    tags: ['City RP', 'Realistic'],
    createdAt: '2020-08-20',
    openPositions: 3,
  },
  {
    id: '3',
    name: 'ERLC Community Events',
    iconUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=100&h=100&fit=crop',
    description: 'Hosting daily events, competitions, and giveaways for the ERLC community.',
    memberCount: 38000,
    staffCount: 32,
    isVerified: true,
    isPartner: true,
    category: 'Events',
    tags: ['Events', 'Giveaways', 'Competitions'],
    createdAt: '2022-01-10',
    openPositions: 8,
  },
  {
    id: '4',
    name: 'Oakwood County RP',
    iconUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop',
    description: 'One of the largest ERLC communities with structured departments and training.',
    memberCount: 52000,
    staffCount: 78,
    isVerified: true,
    category: 'Roleplay',
    tags: ['Large Community', 'Training', 'Departments'],
    createdAt: '2019-11-05',
    openPositions: 12,
  },
  {
    id: '5',
    name: 'Custom Creations Hub',
    iconUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Design services and custom assets for ERLC servers. Liveries, logos, and more.',
    memberCount: 22000,
    staffCount: 15,
    isVerified: true,
    category: 'Creative',
    tags: ['Design', 'Liveries', 'Custom Assets'],
    createdAt: '2023-02-14',
  },
  {
    id: '6',
    name: 'ERLC Help Center',
    iconUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=100&h=100&fit=crop',
    description: 'Community support hub. Get help with ERLC, find resources, and connect.',
    memberCount: 55000,
    staffCount: 40,
    isVerified: true,
    category: 'Support',
    tags: ['Help', 'Resources', 'Community'],
    createdAt: '2021-06-20',
  },
];

export const mockPosts: Post[] = [
  {
    id: '1',
    author: mockProfiles[0],
    type: 'hiring',
    title: 'Looking for Experienced Moderators',
    content: 'Riverside County RP is seeking experienced moderators. Must have 6+ months experience in ERLC communities. Apply now!',
    tags: ['Hiring', 'Moderator', 'Riverside'],
    createdAt: '2025-01-16T14:30:00Z',
    likes: 45,
    comments: 12,
    isSticky: true,
  },
  {
    id: '2',
    author: mockProfiles[1],
    type: 'availability',
    title: 'Available for Bot Development',
    content: 'Open for Discord bot commissions! Moderation bots, ticket systems, custom solutions. DM for quotes.',
    tags: ['Development', 'Bots', 'Commissions'],
    createdAt: '2025-01-15T10:00:00Z',
    likes: 78,
    comments: 23,
  },
  {
    id: '3',
    author: mockProfiles[3],
    type: 'looking',
    title: 'Seeking Moderation Position',
    content: 'Experienced moderator looking for an active roleplay community. Available for interviews.',
    tags: ['Looking', 'Moderator'],
    createdAt: '2025-01-14T18:45:00Z',
    likes: 23,
    comments: 8,
  },
  {
    id: '4',
    author: mockProfiles[6],
    type: 'availability',
    title: 'Custom Livery Designs - Limited Slots',
    content: 'Taking on 5 new livery commissions this week. High quality, fast turnaround. Portfolio in bio.',
    tags: ['Design', 'Liveries', 'Commissions'],
    createdAt: '2025-01-13T09:00:00Z',
    likes: 156,
    comments: 34,
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
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
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
