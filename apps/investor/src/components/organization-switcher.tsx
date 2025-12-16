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
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization, type Organization } from "@cashsouk/config";

function getOrgDisplayName(org: Organization): string {
  if (org.type === "PERSONAL") {
    return "Personal Account";
  }
  return org.name || "Company Account";
}

function sortOrganizations(orgs: Organization[]): Organization[] {
  return [...orgs].sort((a, b) => {
    // Personal accounts always come first
    if (a.type === "PERSONAL" && b.type !== "PERSONAL") return -1;
    if (a.type !== "PERSONAL" && b.type === "PERSONAL") return 1;
    // Otherwise maintain original order (by creation date)
    return 0;
  });
}

function getOrgIcon(org: Organization) {
  if (org.type === "PERSONAL") {
    return <UserIcon className="h-4 w-4" />;
  }
  return <BuildingOffice2Icon className="h-4 w-4" />;
}

function OnboardingStatusBadge({ status, size = "default" }: { status: "PENDING" | "COMPLETED"; size?: "default" | "sm" }) {
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
  const {
    activeOrganization,
    organizations,
    isLoading,
    switchOrganization,
  } = useOrganization();

  const isOnboardingPage = pathname === "/onboarding-start";
  
  // Sort organizations with personal account first
  const sortedOrganizations = sortOrganizations(organizations);
  
  // Get onboarded organizations for showing in switcher (also sorted)
  const onboardedOrganizations = sortOrganizations(
    organizations.filter((org) => org.onboardingStatus === "COMPLETED")
  );
  
  // Check if there are any onboarded organizations to go back to
  const hasOnboardedOrganizations = onboardedOrganizations.length > 0;

  const handleAddOrganization = () => {
    router.push("/onboarding-start");
  };

  const handleSelectOrganization = (org: Organization) => {
    switchOrganization(org.id);
    // If selecting an onboarded organization, redirect to dashboard
    // Use replace to avoid adding to history stack and setTimeout to ensure state propagates
    if (org.onboardingStatus === "COMPLETED") {
      setTimeout(() => {
        router.replace("/");
      }, 50);
    }
  };

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

  // No organizations - show create prompt
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

  // On onboarding page - show simplified view
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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plus className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold text-foreground">
                    Adding New Account
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
              {hasOnboardedOrganizations && (
                <>
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Switch to Existing Account
                  </DropdownMenuLabel>
                  {onboardedOrganizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleSelectOrganization(org)}
                      className="flex items-center gap-3 rounded-lg p-2.5 cursor-pointer focus:bg-accent/10"
                    >
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                        {getOrgIcon(org)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {getOrgDisplayName(org)}
                        </div>
                        <OnboardingStatusBadge status={org.onboardingStatus} size="sm" />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="my-2" />
                </>
              )}
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current Action
              </DropdownMenuLabel>
              <DropdownMenuItem
                disabled
                className="flex items-center gap-3 rounded-lg p-2.5 bg-primary/5 border border-primary/20"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plus className="size-4" />
                </div>
                <span className="text-sm font-medium text-foreground">Adding New Account...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <OnboardingStatusBadge status={activeOrganization.onboardingStatus} size="sm" />
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
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Accounts
            </DropdownMenuLabel>
            {sortedOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelectOrganization(org)}
                className="flex items-center gap-3 rounded-lg p-2.5 cursor-pointer focus:bg-accent/10"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                  {getOrgIcon(org)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getOrgDisplayName(org)}
                  </div>
                  <OnboardingStatusBadge status={org.onboardingStatus} size="sm" />
                </div>
                {activeOrganization?.id === org.id && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
