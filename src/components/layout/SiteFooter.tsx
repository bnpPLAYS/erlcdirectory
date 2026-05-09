import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

const SiteFooter = ({ className }: { className?: string }) => (
  <footer className={cn('py-6 border-t border-border/30', className)}>
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <img
              src={logo}
              alt=""
              className="logo-mark w-6 h-6 object-contain"
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              aria-hidden
            />
          </div>
          <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} erlc.directory</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
