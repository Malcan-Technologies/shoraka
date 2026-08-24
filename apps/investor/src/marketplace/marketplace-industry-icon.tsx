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
  muted: "text-muted-foreground",
  taupe: "text-secondary",
  brand: "text-primary",
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
    <span title={label} className="inline-flex shrink-0">
      <Icon
        aria-hidden="true"
        className={cn(
          "shrink-0",
          size === "lg" ? "size-14" : "size-11",
          TONE_CLASS[tone],
          className
        )}
      />
    </span>
  );
}
