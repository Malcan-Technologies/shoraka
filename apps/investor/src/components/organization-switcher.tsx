"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { UserIcon } from "@heroicons/react/24/outline";
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
  OrganizationSwitcherAvatar,
  OrganizationSwitcherCaption,
} from "@cashsouk/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrganization,
  type Organization,
  getOnboardingRouteForOrg,
  isAddingNewOrganizationRoute,
  isOrganizationActionRequired,
  isOrganizationInYourOrganizationsSection,
  sortYourOrganizations,
} from "@cashsouk/config";

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

const switcherButtonClass =
  "bg-card data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground";

export function OrganizationSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
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
      <div className="-mx-1 max-h-96 overflow-y-auto px-1">
        {hasYourOrganizations && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Organizations
            </DropdownMenuLabel>
            {yourOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => void handleSelectOrganization(org)}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 focus:bg-accent/10"
              >
                <OrganizationSwitcherAvatar
                  status={org.onboardingStatus}
                  regtankStatus={org.regtankOnboardingStatus}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getOrgDisplayName(org)}
                  </div>
                  <OrganizationSwitcherCaption type={org.type} />
                  {isExpiredCompany(org) ? (
                    <p className="mt-1 text-meta font-medium text-status-rejected-text">
                      Start again to restart onboarding.
                    </p>
                  ) : null}
                </div>
                {activeOrganization?.id === org.id && (
                  <Check className="size-4 shrink-0 text-primary" />
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
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 focus:bg-accent/10"
              >
                <OrganizationSwitcherAvatar
                  status={org.onboardingStatus}
                  regtankStatus={org.regtankOnboardingStatus}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getOrgDisplayName(org)}
                  </div>
                  <OrganizationSwitcherCaption type={org.type} />
                </div>
                {activeOrganization?.id === org.id && (
                  <Check className="size-4 shrink-0 text-primary" />
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
            className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 focus:bg-accent/10"
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

  const wrapTrigger = (trigger: React.ReactNode, menu: React.ReactNode) => (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl p-2"
            side="right"
            align="start"
            sideOffset={8}
          >
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" variant="outline" className="cursor-default bg-card">
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
    return wrapTrigger(
      <SidebarMenuButton
        size="lg"
        variant="outline"
        data-testid="organization-switcher"
        className={switcherButtonClass}
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
      </SidebarMenuButton>,
      renderSwitcherDropdownContent(false)
    );
  }

  if (organizations.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            variant="outline"
            onClick={handleAddOrganization}
            className="border-dashed bg-card hover:border-primary/50 hover:bg-primary/5"
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

  const activeName = activeOrganization
    ? getOrgDisplayName(activeOrganization)
    : "Select Account";

  return wrapTrigger(
    <SidebarMenuButton
      size="lg"
      variant="outline"
      data-testid="organization-switcher"
      className={switcherButtonClass}
    >
      {activeOrganization ? (
        <OrganizationSwitcherAvatar
          status={activeOrganization.onboardingStatus}
          regtankStatus={activeOrganization.regtankOnboardingStatus}
        />
      ) : (
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <UserIcon className="size-4" />
        </div>
      )}
      <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-semibold text-foreground">{activeName}</span>
        {activeOrganization ? (
          <OrganizationSwitcherCaption type={activeOrganization.type} />
        ) : null}
      </div>
      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
    </SidebarMenuButton>,
    renderSwitcherDropdownContent(true)
  );
}
