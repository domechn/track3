type PageLoadingOverlayProps = {
  title: string;
  description: string;
};

export default function PageLoadingOverlay({
  title,
  description,
}: PageLoadingOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/65 px-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="glass-subtle flex max-w-sm flex-col items-center gap-3 rounded-xl px-5 py-4 text-center">
        <div className="h-2 w-24 rounded-full bg-primary/20">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70 motion-reduce:animate-none" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
