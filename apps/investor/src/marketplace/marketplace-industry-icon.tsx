import type { ComponentType, SVGProps } from "react";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  CakeIcon,
  CpuChipIcon,
  FilmIcon,
  HeartIcon,
  HomeModernIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SignalIcon,
  Square3Stack3DIcon,
  SunIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  marketplaceIndustryIconKey,
  marketplaceIndustryTone,
  type MarketplaceIndustryIconKey,
  type MarketplaceIndustryTone,
} from "./marketplace-industry";

const INDUSTRY_ICONS: Record<
  MarketplaceIndustryIconKey,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  agriculture: SunIcon,
  manufacturing: WrenchScrewdriverIcon,
  construction: Square3Stack3DIcon,
  retail: BuildingStorefrontIcon,
  transport: TruckIcon,
  hospitality: BuildingOfficeIcon,
  food: CakeIcon,
  communications: SignalIcon,
  technology: CpuChipIcon,
  insurance: ShieldCheckIcon,
  legal: ScaleIcon,
  education: AcademicCapIcon,
  healthcare: HeartIcon,
  realEstate: HomeModernIcon,
  publicSector: BuildingLibraryIcon,
  media: FilmIcon,
  generic: BriefcaseIcon,
};

const TONE_CLASS: Record<MarketplaceIndustryTone, string> = {
  muted: "bg-muted text-foreground",
  taupe: "bg-secondary/15 text-secondary",
  brand: "bg-primary/10 text-primary",
};

export function MarketplaceIndustryIcon({
  industry,
  size = "md",
  className,
}: {
  industry: string | null | undefined;
  size?: "md" | "lg";
  className?: string;
}) {
  const Icon = INDUSTRY_ICONS[marketplaceIndustryIconKey(industry)];
  const tone = marketplaceIndustryTone(industry);
  const label = industry?.trim() || "Industry not published";

  return (
    <span
      aria-hidden="true"
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl",
        size === "lg" ? "size-14" : "size-11",
        TONE_CLASS[tone],
        className
      )}
    >
      <Icon className={size === "lg" ? "size-7" : "size-6"} />
    </span>
  );
}
