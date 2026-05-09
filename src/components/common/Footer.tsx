import { Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm py-6 px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs text-center md:text-right text-muted-foreground">
          Built with <Heart className="w-3 h-3 inline text-accent fill-accent mx-0.5" /> using{' '}
          <span className="font-medium text-accent">MeDo</span> •{' '}
          <a 
            href="https://forgefly.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Forgefly.io
          </a>
          <br className="md:hidden" />
          <span className="hidden md:inline"> </span>
          By <span className="font-medium">Sourav Nayak</span> &{' '}
          <span className="font-medium">Grok</span>
        </p>
      </div>
    </footer>
  );
}
