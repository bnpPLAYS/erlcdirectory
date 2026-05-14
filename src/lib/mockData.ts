// Utility functions - mock data removed, using database

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  return `${months}mo ago`;
};

export const sortOptions = [
  { value: 'newest', label: 'Newest', icon: 'Clock' },
  { value: 'top-rated', label: 'Top Rated', icon: 'Star' },
  { value: 'most-members', label: 'Most Members', icon: 'Users' },
  { value: 'most-experience', label: 'Most Experience', icon: 'Clock' },
  { value: 'a-z', label: 'A-Z', icon: 'ArrowUpDown' },
] as const;
