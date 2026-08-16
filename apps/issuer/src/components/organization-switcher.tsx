"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/solid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@cashsouk/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization, type Organization, type OnboardingStatus, getOnboardingRouteForOrg, isAddingNewOrganizationRoute, isOrganizationActionRequired, isOrganizationInYourOrganizationsSection, sortYourOrganizations } from "@cashsouk/config";

function getOrgDisplayName(org: Organization): string {
  // Use firstName + lastName if available (from RegTank onboarding)
  if (org.firstName && org.lastName) {
    return `${org.firstName} ${org.lastName}`;
  }
  
  // Fallback to company name or default
  return org.name || "Company Account";
}

function sortOrganizations(orgs: Organization[]): Organization[] {
  // Maintain original order (by creation date)
  return [...orgs];
}

function getOrgIcon(org: Organization) {
  if (org.type === "PERSONAL") {
    return <UserIcon className="h-4 w-4" />;
  }
  return <BuildingOffice2Icon className="h-4 w-4" />;
}

function getActionRequiredIconClass(org: Organization): string {
  const status = org.onboardingStatus;
  const regtankStatus = String(org.regtankOnboardingStatus ?? "").toUpperCase();

  if (regtankStatus === "EXPIRED" || regtankStatus === "REJECTED" || status === "REJECTED") {
    return "bg-red-100 text-red-700";
  }
  if (
    status === "PENDING_AML" ||
    status === "PENDING_FINAL_APPROVAL" ||
    status === "IN_PROGRESS"
  ) {
    return "bg-blue-100 text-blue-700";
  }
  if (status === "PENDING_AMENDMENT") {
    return "bg-amber-100 text-amber-700";
  }
  if (regtankStatus === "PENDING_APPROVAL" || status === "PENDING_APPROVAL") {
    return "bg-purple-100 text-purple-700";
  }
  return "bg-amber-100 text-amber-700";
}

function OnboardingStatusBadge({ 
  status, 
  regtankStatus, 
  size = "default" 
}: { 
  status: OnboardingStatus; 
  regtankStatus?: string | null;
  size?: "default" | "sm" 
}) {
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  
  // Determine badge based on org status first, then regtank status
  if (status === "COMPLETED") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-emerald-700`}>
        <CheckCircleIcon className={iconSize} />
        Verified
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-red-700`}>
        <ClockIcon className={iconSize} />
        Rejected
      </span>
    );
  }
  
  if (status === "PENDING_AML") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        Pending AML Approval
      </span>
    );
  }

  if (status === "PENDING_AMENDMENT") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-amber-700`}>
        <ClockIcon className={iconSize} />
        Amendment in Progress
      </span>
    );
  }
  
  if (status === "PENDING_FINAL_APPROVAL") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        Pending Final Approval
      </span>
    );
  }
  
  // Check regtank status for in-progress statuses
  const inProgressStatuses = ["IN_PROGRESS", "FORM_FILLING", "LIVENESS_STARTED"];
  if (regtankStatus && inProgressStatuses.includes(regtankStatus)) {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        In Progress
      </span>
    );
  }
  
  // Check REJECTED and EXPIRED first (these take priority over PENDING_APPROVAL)
  if (regtankStatus === "REJECTED") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-red-700`}>
        <ClockIcon className={iconSize} />
        Rejected
      </span>
    );
  }
  
  if (regtankStatus === "EXPIRED") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-orange-700`}>
        <ClockIcon className={iconSize} />
        Expired
      </span>
    );
  }
  
  if (regtankStatus === "PENDING_APPROVAL" || status === "PENDING_APPROVAL") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-purple-700`}>
        <ClockIcon className={iconSize} />
        Pending Approval
      </span>
    );
  }
  
  if (status === "IN_PROGRESS" || status === "PENDING") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        In Progress
      </span>
    );
  }
  
  // PENDING_SSM_REVIEW and any unmapped status
  return (
    <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-amber-700`}>
      <ClockIcon className={iconSize} />
      Pending
    </span>
  );
}

type OrganizationSwitcherProps = {
  /** sidebar: full-width sidebar control. header: compact control for the main header. */
  variant?: "sidebar" | "header";
};

export function OrganizationSwitcher({ variant = "sidebar" }: OrganizationSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const {
    activeOrganization,
    organizations,
    isLoading,
    switchOrganization,
    portalType
  } = useOrganization();
  const isHeader = variant === "header";

  const isOnboardingPage = isAddingNewOrganizationRoute(pathname);

  const isExpired = (org: Organization) =>
    String(org.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";
  const isExpiredCompany = (org: Organization) => org.type === "COMPANY" && isExpired(org);

  const yourOrganizations = sortYourOrganizations(
    organizations.filter((org) => isOrganizationInYourOrganizationsSection(org) && !isExpiredCompany(org))
  );
  const hasYourOrganizations = yourOrganizations.length > 0;

  const actionRequiredOrganizations = sortOrganizations(
    organizations.filter((org) => isExpiredCompany(org) || isOrganizationActionRequired(org))
  );
  const hasActionRequiredOrganizations = actionRequiredOrganizations.length > 0;

  const handleAddOrganization = () => {
    router.push("/onboarding/account");
  };

  const handleSelectOrganization = async (org: Organization) => {
    switchOrganization(org.id);
    const destination = getOnboardingRouteForOrg(org, portalType);
    if (destination === "/") {
      router.replace("/");
    } else {
      router.push(destination);
    }
  };

  const renderSwitcherDropdownContent = (showAddOrganization: boolean) => (
    <>
      <div className="max-h-96 overflow-y-auto -mx-1 px-1">
        {hasYourOrganizations && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Organizations
            </DropdownMenuLabel>
            {yourOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => void handleSelectOrganization(org)}
                className="flex items-center gap-3 rounded-lg p-2.5 cursor-pointer focus:bg-accent/10"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                  {getOrgIcon(org)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getOrgDisplayName(org)}
                  </div>
                  <OnboardingStatusBadge
                    status={org.onboardingStatus}
                    regtankStatus={org.regtankOnboardingStatus || undefined}
                    size="sm"
                  />
                  {isExpiredCompany(org) ? (
                    <p className="mt-1 text-[11px] font-medium text-orange-700">
                      Start again to restart onboarding.
                    </p>
                  ) : null}
                </div>
                {activeOrganization?.id === org.id && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {hasActionRequiredOrganizations && (
          <>
            {hasYourOrganizations && <DropdownMenuSeparator className="my-2" />}
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Needs Attention
            </DropdownMenuLabel>
            {actionRequiredOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => void handleSelectOrganization(org)}
                className="flex items-center gap-3 rounded-lg p-2.5 cursor-pointer focus:bg-accent/10"
              >
                <div className={`flex size-8 items-center justify-center rounded-lg ${getActionRequiredIconClass(org)}`}>
                  {getOrgIcon(org)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getOrgDisplayName(org)}
                  </div>
                  <OnboardingStatusBadge
                    status={org.onboardingStatus}
                    regtankStatus={org.regtankOnboardingStatus || undefined}
                    size="sm"
                  />
                </div>
                {activeOrganization?.id === org.id && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </div>
      {showAddOrganization && (
        <>
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            onClick={handleAddOrganization}
            className="flex items-center gap-3 rounded-lg p-2.5 cursor-pointer focus:bg-accent/10"
          >
            <div className="flex size-8 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-background">
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Add Organization</span>
          </DropdownMenuItem>
        </>
      )}
    </>
  );

  const dropdownSide = isHeader ? "bottom" : isMobile ? "bottom" : "right";
  const dropdownAlign = isHeader ? "end" : "start";

  const wrapTrigger = (trigger: React.ReactNode, menu: React.ReactNode) => {
    if (isHeader) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64 rounded-xl p-2"
            side={dropdownSide}
            align={dropdownAlign}
            sideOffset={8}
          >
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl p-2"
              side={dropdownSide}
              align={dropdownAlign}
              sideOffset={4}
            >
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  };

  if (isLoading) {
    if (isHeader) {
      return (
        <div className="flex h-10 max-w-[14rem] items-center gap-2 rounded-lg border border-border bg-card px-2 shadow-sm">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </div>
      );
    }
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1 text-left group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // On onboarding page - show "Adding organisation". Dropdown is only useful
  // when the user already has organizations they can switch back to.
  if (isOnboardingPage) {
    if (organizations.length === 0) {
      if (isHeader) {
        return (
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-testid="organization-switcher"
            className="flex h-10 max-w-[16rem] cursor-default items-center gap-2 rounded-lg border border-border bg-muted px-2 text-left text-muted-foreground disabled:pointer-events-none disabled:cursor-default disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted-foreground/10 text-muted-foreground">
              <Plus className="size-3.5" />
            </div>
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">
              Adding organisation
            </span>
          </button>
        );
      }
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              disabled
              aria-disabled="true"
              data-testid="organization-switcher"
              className="cursor-default border border-border bg-muted text-muted-foreground opacity-100 hover:bg-muted hover:text-muted-foreground disabled:opacity-100"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted-foreground/10 text-muted-foreground">
                <Plus className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold text-muted-foreground">
                  Adding New Organization
                </span>
                <span className="truncate text-xs text-muted-foreground">Complete onboarding</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    const trigger = isHeader ? (
      <button
        type="button"
        data-testid="organization-switcher"
        className="flex h-10 max-w-[16rem] items-center gap-2 rounded-lg border border-border bg-card px-2 text-left shadow-sm hover:bg-accent/50"
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Plus className="size-3.5" />
        </div>
        <span className="hidden min-w-0 truncate text-sm font-medium sm:block">
          Adding organisation
        </span>
        <ChevronsUpDown className="ml-auto hidden size-4 shrink-0 text-muted-foreground sm:block" />
      </button>
    ) : (
      <SidebarMenuButton
        size="lg"
        data-testid="organization-switcher"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Plus className="size-4" />
        </div>
        <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-semibold text-foreground">
            Adding New Organization
          </span>
          <span className="truncate text-xs text-muted-foreground">Complete onboarding</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </SidebarMenuButton>
    );
    return wrapTrigger(trigger, renderSwitcherDropdownContent(false));
  }

  // No organizations - show create prompt
  if (organizations.length === 0) {
    if (isHeader) {
      return (
        <button
          type="button"
          onClick={handleAddOrganization}
          className="flex h-10 max-w-[16rem] items-center gap-2 rounded-lg border border-dashed border-border bg-card px-2 text-left shadow-sm hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Plus className="size-3.5" />
          </div>
          <span className="hidden truncate text-sm font-medium sm:block">Create account</span>
        </button>
      );
    }
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={handleAddOrganization}
            className="border border-dashed border-sidebar-border hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold text-foreground">Create Account</span>
              <span className="truncate text-xs text-muted-foreground">
                Set up your first account
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const trigger = isHeader ? (
    <button
      type="button"
      data-testid="organization-switcher"
      className="flex h-auto min-h-10 max-w-[18rem] items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left shadow-sm hover:bg-accent/50"
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        {activeOrganization ? getOrgIcon(activeOrganization) : <Plus className="size-3.5" />}
      </div>
      <div className="hidden min-w-0 flex-1 sm:grid">
        <span className="truncate text-sm font-medium leading-5">
          {activeOrganization ? getOrgDisplayName(activeOrganization) : "Select account"}
        </span>
        {activeOrganization ? (
          <OnboardingStatusBadge
            status={activeOrganization.onboardingStatus}
            regtankStatus={activeOrganization.regtankOnboardingStatus || undefined}
            size="sm"
          />
        ) : null}
      </div>
      <ChevronsUpDown className="ml-auto hidden size-4 shrink-0 text-muted-foreground sm:block" />
    </button>
  ) : (
    <SidebarMenuButton
      size="lg"
      data-testid="organization-switcher"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
    >
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {activeOrganization ? getOrgIcon(activeOrganization) : <Plus className="size-4" />}
      </div>
      <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-semibold text-foreground">
          {activeOrganization ? getOrgDisplayName(activeOrganization) : "Select Account"}
        </span>
        {activeOrganization && (
          <OnboardingStatusBadge
            status={activeOrganization.onboardingStatus}
            regtankStatus={activeOrganization.regtankOnboardingStatus || undefined}
            size="sm"
          />
        )}
      </div>
      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
    </SidebarMenuButton>
  );

  return wrapTrigger(trigger, renderSwitcherDropdownContent(true));
}
