import { cn } from '@/lib/utils';

interface SkillBadgeProps {
  skill: string;
  className?: string;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md';
}

const SkillBadge = ({ skill, className, variant = 'default', size = 'sm' }: SkillBadgeProps) => {
  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-colors',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variant === 'default' && 'bg-secondary/80 text-secondary-foreground border border-border/50',
        variant === 'outline' && 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/50',
        className
      )}
    >
      {skill}
    </span>
  );
};

export default SkillBadge;
