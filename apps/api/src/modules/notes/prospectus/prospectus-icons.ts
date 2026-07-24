/**
 * SECTION: Inline SVG icons for investor Prospectus HTML
 * WHY: Deterministic frozen HTML — no Lucide CDN or runtime JS
 */

function svg(
  paths: string,
  className = "icon",
  viewBox = "0 0 24 24"
): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const prospectusIcon = {
  calendarDays: (className?: string) =>
    svg(
      '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      className
    ),
  landmark: (className?: string) =>
    svg(
      '<path d="M3 21h18M10 21V9M14 21V9M6 21V9M18 21V9M12 3l9 6H3z"/>',
      className
    ),
  building: (className?: string) =>
    svg(
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M6 12h12M6 16h12M10 6h.01M14 6h.01M10 10h.01M14 10h.01"/>',
      className
    ),
  badgeCheck: (className?: string) =>
    svg(
      '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
      className
    ),
  clipboardCheck: (className?: string) =>
    svg(
      '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
      className
    ),
  fileCheck: (className?: string) =>
    svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
      className
    ),
  fileText: (className?: string) =>
    svg(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
      className
    ),
  chart: (className?: string) =>
    svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>', className),
  clock: (className?: string) =>
    svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', className),
  notebook: (className?: string) =>
    svg(
      '<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/>',
      className
    ),
  handCoins: (className?: string) =>
    svg(
      '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.2-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="7" r="2"/>',
      className
    ),
  badgeDollar: (className?: string) =>
    svg(
      '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M12 7v10M15 10h-4.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9"/>',
      className
    ),
  shieldCheck: (className?: string) =>
    svg(
      '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
      className
    ),
  droplets: (className?: string) =>
    svg(
      '<path d="M7 16.3c2.2 0 4-1.8 4-4.1C11 9 7 4 7 4S3 9 3 12.2c0 2.3 1.8 4.1 4 4.1z"/><path d="M12.8 15.1c1.7 0 3-1.4 3-3.1C15.8 9.7 12.8 6 12.8 6s-3 3.7-3 6c0 1.7 1.3 3.1 3 3.1z"/>',
      className
    ),
  percent: (className?: string) =>
    svg(
      '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
      className
    ),
  target: (className?: string) =>
    svg(
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
      className
    ),
  calendarClock: (className?: string) =>
    svg(
      '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4M8 2v4M3 10h5"/><circle cx="18" cy="18" r="4"/><path d="M18 16.5V18l1 1"/>',
      className
    ),
} as const;
