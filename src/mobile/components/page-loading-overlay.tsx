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
      className="mobile-loading-overlay"
      role="status"
      aria-label={title}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="mobile-loading-layout" aria-hidden="true">
        <div className="mobile-skeleton mobile-loading-label" />
        <div className="mobile-skeleton mobile-loading-value" />
        <div className="mobile-skeleton mobile-loading-chart" />
        <div className="mobile-skeleton mobile-loading-card" />
        <div className="mobile-skeleton mobile-loading-card" />
      </div>
      <div className="mobile-loading-message glass-subtle">
        <div className="mobile-loading-progress-track">
          <div className="mobile-loading-progress" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
