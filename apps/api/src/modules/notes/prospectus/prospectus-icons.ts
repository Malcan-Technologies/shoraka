/**
 * SECTION: Official Heroicons for investor Prospectus HTML (Pages 1–3)
 * WHY: Deterministic frozen HTML — render 24/outline Heroicons to inline SVG (no CDN/runtime JS)
 */

import { createElement, type ComponentType, type SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BeakerIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  CalculatorIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChartPieIcon,
  CheckBadgeIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  MinusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

type HeroiconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Semantic Prospectus icon keys — each maps to one official Heroicon. */
export type ProspectusIconName =
  | "issuer"
  | "listing-date"
  | "closing-date"
  | "maturity-date"
  | "paymaster"
  | "invoice-amount"
  | "invoice-date"
  | "paymaster-name"
  | "paymaster-type"
  | "assignment"
  | "rating"
  | "confidence"
  | "financing"
  | "profit-rate"
  | "expected-return"
  | "tenure"
  | "minimum-investment"
  | "notes-funded"
  | "amount-funded"
  | "repayment"
  | "on-time-payment"
  | "credit-score"
  | "payment-behaviour"
  | "credit-utilisation"
  | "litigation"
  | "ccris"
  | "work-performed"
  | "work-certification"
  | "work-trust-account"
  | "work-assignment"
  | "sector"
  | "risk-rating"
  | "liquidity"
  | "leverage"
  | "debt-servicing"
  | "receivables"
  | "overall-profile"
  | "revenue-profitability"
  | "highlight-check"
  | "disclaimer"
  | "trend-up"
  | "trend-down"
  | "trend-neutral"
  | "income-trend-insight";

/**
 * Official Heroicon component map. Do not add custom SVG paths here.
 * Credit Insights rows intentionally keep CSS square markers (Canva reference).
 */
export const PROSPECTUS_HEROICON_MAP: Record<ProspectusIconName, HeroiconComponent> = {
  issuer: BuildingOffice2Icon,
  "listing-date": CalendarDaysIcon,
  "closing-date": CalendarDaysIcon,
  "maturity-date": CalendarDaysIcon,
  paymaster: BuildingLibraryIcon,
  "invoice-amount": BanknotesIcon,
  "invoice-date": CalendarDaysIcon,
  "paymaster-name": CheckBadgeIcon,
  "paymaster-type": BuildingLibraryIcon,
  assignment: DocumentCheckIcon,
  rating: ClipboardDocumentCheckIcon,
  confidence: CheckBadgeIcon,
  financing: BanknotesIcon,
  "profit-rate": ChartBarIcon,
  "expected-return": CurrencyDollarIcon,
  tenure: ClockIcon,
  "minimum-investment": BanknotesIcon,
  "notes-funded": DocumentTextIcon,
  "amount-funded": BanknotesIcon,
  repayment: CheckBadgeIcon,
  "on-time-payment": ClockIcon,
  "credit-score": ChartBarIcon,
  "payment-behaviour": ClockIcon,
  "credit-utilisation": ChartPieIcon,
  litigation: ShieldCheckIcon,
  ccris: DocumentTextIcon,
  "work-performed": DocumentTextIcon,
  "work-certification": CheckBadgeIcon,
  "work-trust-account": BanknotesIcon,
  "work-assignment": DocumentArrowDownIcon,
  sector: BuildingOffice2Icon,
  "risk-rating": ShieldCheckIcon,
  "revenue-profitability": ChartBarIcon,
  liquidity: BeakerIcon,
  leverage: ArrowTrendingDownIcon,
  "debt-servicing": CalculatorIcon,
  receivables: CalendarDaysIcon,
  "overall-profile": ChartPieIcon,
  "highlight-check": CheckIcon,
  disclaimer: ShieldCheckIcon,
  "trend-up": ArrowTrendingUpIcon,
  "trend-down": ArrowTrendingDownIcon,
  "trend-neutral": MinusIcon,
  "income-trend-insight": ChartBarIcon,
};

/** Distinctive path fragment from BuildingOffice2Icon — used in tests. */
export const PROSPECTUS_BUILDING_OFFICE_2_PATH_MARKER = "M2.25 21h19.5m-18-18v18";

/** Distinctive path fragment from CheckIcon — Investor Highlights. */
export const PROSPECTUS_CHECK_ICON_PATH_MARKER = "m4.5 12.75 6 6 9-13.5";

/** Old bespoke “ladder/server” building path — must not appear in Prospectus HTML. */
export const PROSPECTUS_LEGACY_BUILDING_PATH_MARKER =
  "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18";

export type RenderProspectusHeroiconOptions = {
  className?: string;
  title?: string;
};

/**
 * Renders an official Heroicons 24/outline icon to static inline SVG for frozen HTML/PDF.
 */
export function renderProspectusHeroicon(
  name: ProspectusIconName,
  options: RenderProspectusHeroiconOptions = {}
): string {
  const Icon = PROSPECTUS_HEROICON_MAP[name];
  const className = options.className?.trim() || "icon";
  return renderToStaticMarkup(
    createElement(
      Icon,
      {
        className,
        "aria-hidden": true,
        "data-prospectus-icon": name,
      } as SVGProps<SVGSVGElement> & { "data-prospectus-icon": string },
      options.title
        ? createElement("title", null, options.title)
        : null
    )
  );
}

/**
 * @deprecated Prefer renderProspectusHeroicon(name). Kept as thin aliases for gradual call-site clarity.
 */
export const prospectusIcon = {
  calendarDays: (className?: string) =>
    renderProspectusHeroicon("listing-date", { className }),
  landmark: (className?: string) =>
    renderProspectusHeroicon("paymaster", { className }),
  building: (className?: string) =>
    renderProspectusHeroicon("issuer", { className }),
  badgeCheck: (className?: string) =>
    renderProspectusHeroicon("repayment", { className }),
  clipboardCheck: (className?: string) =>
    renderProspectusHeroicon("rating", { className }),
  fileCheck: (className?: string) =>
    renderProspectusHeroicon("assignment", { className }),
  fileText: (className?: string) =>
    renderProspectusHeroicon("work-performed", { className }),
  chart: (className?: string) =>
    renderProspectusHeroicon("profit-rate", { className }),
  clock: (className?: string) =>
    renderProspectusHeroicon("on-time-payment", { className }),
  notebook: (className?: string) =>
    renderProspectusHeroicon("notes-funded", { className }),
  handCoins: (className?: string) =>
    renderProspectusHeroicon("expected-return", { className }),
  badgeDollar: (className?: string) =>
    renderProspectusHeroicon("financing", { className }),
  shieldCheck: (className?: string) =>
    renderProspectusHeroicon("disclaimer", { className }),
  calendarClock: (className?: string) =>
    renderProspectusHeroicon("closing-date", { className }),
} as const;
