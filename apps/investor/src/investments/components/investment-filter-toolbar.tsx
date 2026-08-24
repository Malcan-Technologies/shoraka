"use client";

import {
  MARKETPLACE_TENURE_FILTER_LABELS,
  SOUKSCORE_RISK_RATING_GRADES,
  marketplaceTenureFilterLabel,
} from "@cashsouk/types";
import { ListToolbarFilterTrigger } from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ONBOARDING_INDUSTRY_OPTIONS } from "../industry-filter-options";

export type InvestmentListFilters = {
  status: string;
  industry: string;
  risk: string;
  profit: string;
  tenor: string;
};

export const DEFAULT_INVESTMENT_LIST_FILTERS: InvestmentListFilters = {
  status: "all",
  industry: "all",
  risk: "all",
  profit: "all",
  tenor: "all",
};

const PROFIT_LABELS: Record<string, string> = {
  low: "Below 14%",
  mid: "14% – 15%",
  high: "Above 15%",
};

const TENOR_LABELS = MARKETPLACE_TENURE_FILTER_LABELS;

export function investmentFilterChipLabels(filters: InvestmentListFilters) {
  return {
    status: filters.status === "all" ? null : `Status: ${filters.status}`,
    industry: filters.industry === "all" ? null : `Industry: ${filters.industry}`,
    risk: filters.risk === "all" ? null : `Risk: ${filters.risk}`,
    profit: filters.profit === "all" ? null : `Profit: ${PROFIT_LABELS[filters.profit] ?? filters.profit}`,
    tenor:
      filters.tenor === "all"
        ? null
        : `Tenure: ${marketplaceTenureFilterLabel(filters.tenor) ?? filters.tenor}`,
  };
}

function moreFilterCount(filters: InvestmentListFilters): number {
  return [filters.risk, filters.profit, filters.tenor].filter((value) => value !== "all").length;
}

export function InvestmentFilterToolbar({
  filters,
  statusLabels,
  onChange,
}: {
  filters: InvestmentListFilters;
  statusLabels: string[];
  onChange: (next: InvestmentListFilters) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger label="Status" count={filters.status !== "all" ? 1 : 0} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-72 overflow-y-auto"
        >
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.status}
            onValueChange={(status) => onChange({ ...filters, status })}
          >
            <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
            {statusLabels.map((label) => (
              <DropdownMenuRadioItem key={label} value={label}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Industry"
            count={filters.industry !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
        >
          <DropdownMenuLabel>Industry</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.industry}
            onValueChange={(industry) => onChange({ ...filters, industry })}
          >
            <DropdownMenuRadioItem value="all">All industries</DropdownMenuRadioItem>
            {ONBOARDING_INDUSTRY_OPTIONS.map((industry) => (
              <DropdownMenuRadioItem key={industry} value={industry}>
                {industry}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger label="Filters" count={moreFilterCount(filters)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-0">
          <div className="p-1">
            <DropdownMenuLabel>Risk score</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.risk}
              onValueChange={(risk) => onChange({ ...filters, risk })}
            >
              <DropdownMenuRadioItem value="all">All risk scores</DropdownMenuRadioItem>
              {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                <DropdownMenuRadioItem key={grade} value={grade}>
                  {grade}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuLabel>Profit band</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.profit}
              onValueChange={(profit) => onChange({ ...filters, profit })}
            >
              <DropdownMenuRadioItem value="all">All profit bands</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="low">Below 14%</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mid">14% – 15%</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high">Above 15%</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuLabel>Tenure</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.tenor}
              onValueChange={(tenor) => onChange({ ...filters, tenor })}
            >
              <DropdownMenuRadioItem value="all">Any tenure</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="short">{TENOR_LABELS.short}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">{TENOR_LABELS.medium}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="long">{TENOR_LABELS.long}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
