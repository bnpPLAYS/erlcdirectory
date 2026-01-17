import { cn } from '@/lib/utils';

interface SkillBadgeProps {
  skill: string;
  className?: string;
  variant?: 'default' | 'outline';
}

const SkillBadge = ({ skill, className, variant = 'default' }: SkillBadgeProps) => {
  return (
    <span 
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors',
        variant === 'default' && 'bg-secondary text-secondary-foreground',
        variant === 'outline' && 'border border-border text-muted-foreground',
        className
      )}
    >
      {skill}
    </span>
  );
};

export default SkillBadge;
