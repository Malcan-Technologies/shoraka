"use client";

type SectionHeadingProps = {
  title: string;
};

/** Compact section title with underline for Prospectus Review groups. */
export function ProspectusSectionHeading({ title }: SectionHeadingProps) {
  return (
    <div className="mb-4 border-b border-border pb-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}
