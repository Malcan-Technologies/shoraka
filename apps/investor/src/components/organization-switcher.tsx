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
import {
  useOrganization,
  type Organization,
  type OnboardingStatus,
  createApiClient,
  getOnboardingRouteForOrg,
  isAddingNewOrganizationRoute,
  isOrganizationActionRequired,
  isOrganizationInYourOrganizationsSection,
  sortYourOrganizations,
} from "@cashsouk/config";
import { useAuthToken } from "@cashsouk/config";

function getOrgDisplayName(org: Organization): string {
  if (org.type === "PERSONAL") {
    return "Personal Account";
  }

  if (org.firstName && org.lastName) {
    return `${org.firstName} ${org.lastName}`;
  }

  return org.name || "Company Account";
}

function sortOrganizations(orgs: Organization[]): Organization[] {
  return [...orgs].sort((a, b) => {
    if (a.type === "PERSONAL" && b.type !== "PERSONAL") return -1;
    if (a.type !== "PERSONAL" && b.type === "PERSONAL") return 1;
    return 0;
  });
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
  if (status === "PENDING_AML" || status === "PENDING_FINAL_APPROVAL" || status === "IN_PROGRESS") {
    return "bg-blue-100 text-blue-700";
  }
  if (regtankStatus === "PENDING_APPROVAL" || status === "PENDING_APPROVAL") {
    return "bg-purple-100 text-purple-700";
  }
  return "bg-amber-100 text-amber-700";
}

function OnboardingStatusBadge({
  status,
  regtankStatus,
  size = "default",
}: {
  status: OnboardingStatus;
  regtankStatus?: string | null;
  size?: "default" | "sm";
}) {
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  if (status === "COMPLETED") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-emerald-700`}>
        <CheckCircleIcon className={iconSize} />
        Verified
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

  if (status === "PENDING_FINAL_APPROVAL") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        Pending Final Approval
      </span>
    );
  }

  const inProgressStatuses = ["IN_PROGRESS", "FORM_FILLING", "LIVENESS_STARTED"];
  if (regtankStatus && inProgressStatuses.includes(regtankStatus)) {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-amber-700`}>
        <ClockIcon className={iconSize} />
        Pending
      </span>
    );
  }

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

  if (status === "IN_PROGRESS") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        In Progress
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-amber-700`}>
      <ClockIcon className={iconSize} />
      Pending
    </span>
  );
}

export function OrganizationSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { getAccessToken } = useAuthToken();
  const {
    activeOrganization,
    organizations,
    isLoading,
    switchOrganization,
    portalType,
  } = useOrganization();

  const isOnboardingPage = isAddingNewOrganizationRoute(pathname);

  const isExpired = (org: Organization) =>
    String(org.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";
  const visibleOrganizations = organizations.filter((org) => {
    if (org.type === "PERSONAL") return true;
    return !isExpired(org);
  });

  React.useEffect(() => {
    if (!activeOrganization || visibleOrganizations.length === 0) return;
    if (activeOrganization.type === "PERSONAL") return;
    const status = String(activeOrganization.regtankOnboardingStatus ?? "").toUpperCase();
    if (status !== "EXPIRED") return;
    const target =
      visibleOrganizations.find((o) => o.onboardingStatus === "COMPLETED") ??
      visibleOrganizations[0];
    if (target && target.id !== activeOrganization.id) {
      switchOrganization(target.id);
    }
  }, [activeOrganization, visibleOrganizations, switchOrganization]);

  const yourOrganizations = sortYourOrganizations(
    visibleOrganizations.filter(isOrganizationInYourOrganizationsSection)
  );
  const hasYourOrganizations = yourOrganizations.length > 0;

  const actionRequiredOrganizations = sortOrganizations(
    visibleOrganizations.filter(isOrganizationActionRequired)
  );
  const hasActionRequiredOrganizations = actionRequiredOrganizations.length > 0;

  const handleAddOrganization = () => {
    router.push("/onboarding/account");
  };

  const handleSelectOrganization = async (org: Organization) => {
    if (org.regtankOnboardingStatus === "EXPIRED") {
      try {
        const apiClient = createApiClient(
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
          getAccessToken
        );
        await apiClient.post(`/v1/regtank/retry/${org.id}?portalType=${portalType}`);
      } catch (error) {
        console.error("[OrganizationSwitcher] Failed to restart expired onboarding:", error);
      }
    }

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
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ${getActionRequiredIconClass(org)}`}
                >
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

  if (isLoading) {
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

  if (isOnboardingPage) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
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
                  <span className="truncate text-xs text-muted-foreground">
                    Complete onboarding
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl p-2"
              side={isMobile ? "bottom" : "right"}
              align="start"
              sideOffset={4}
            >
              {renderSwitcherDropdownContent(false)}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (organizations.length === 0) {
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-testid="organization-switcher"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {activeOrganization ? (
                  getOrgIcon(activeOrganization)
                ) : (
                  <UserIcon className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold text-foreground">
                  {activeOrganization
                    ? getOrgDisplayName(activeOrganization)
                    : "Select Account"}
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
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl p-2"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            {renderSwitcherDropdownContent(true)}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
