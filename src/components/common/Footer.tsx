export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm py-6 px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 text-xs text-muted-foreground">
          <span>• Forgefly.io</span>
          <span>• Built with ❤️ by Sourav Nayak •</span>
          <a 
            href="https://medo.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50 transition-colors font-medium"
          >
            Made by MeDo
          </a>
        </div>
      </div>
    </footer>
  );
}
