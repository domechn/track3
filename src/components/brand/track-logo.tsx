import { trackLogoPeaks } from "./track-logo-paths";

export function TrackLogo({ size = 24, title = "Track3", decorative = false }: {
  size?: number;
  title?: string;
  decorative?: boolean;
}) {
  return <svg viewBox="0 0 28 28" width={size} height={size} role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : title} aria-hidden={decorative ? "true" : undefined}>
    {!decorative && <title>{title}</title>}
    <polygon points={trackLogoPeaks[0]} fill="hsl(var(--accent-data))" />
    <polygon points={trackLogoPeaks[1]} fill="hsl(var(--foreground))" />
  </svg>;
}
