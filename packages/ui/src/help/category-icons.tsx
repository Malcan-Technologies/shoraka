import type { ComponentType, SVGProps } from "react";
import {
  BanknotesIcon,
  BookOpenIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  IdentificationIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICONS: Record<string, Icon> = {
  Onboarding: IdentificationIcon,
  "Application Review": ClipboardDocumentCheckIcon,
  "Note Operations": DocumentTextIcon,
  "Platform Operations": Cog6ToothIcon,
  Finance: BanknotesIcon,
  "Getting Started": RocketLaunchIcon,
  Applications: DocumentTextIcon,
  "Notes and Financing": BanknotesIcon,
  Investing: ChartBarIcon,
};

export function helpCategoryIcon(category: string): Icon {
  return CATEGORY_ICONS[category] ?? BookOpenIcon;
}
