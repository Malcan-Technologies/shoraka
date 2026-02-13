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
import { useOrganization, type Organization, type OnboardingStatus, createApiClient } from "@cashsouk/config";
import { useAuthToken } from "@cashsouk/config";

function getOrgDisplayName(org: Organization): string {
  // Personal accounts always show as "Personal Account" in sidebar
  if (org.type === "PERSONAL") {
    return "Personal Account";
  }
  
  // For company accounts, use firstName + lastName if available
  if (org.firstName && org.lastName) {
    return `${org.firstName} ${org.lastName}`;
  }
  
  // Fallback to company name or default
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
  
  // Determine badge based on regtank status or org status
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
  
  // Check regtank status for in-progress statuses
  const inProgressStatuses = ["IN_PROGRESS", "FORM_FILLING", "LIVENESS_STARTED"];
  if (regtankStatus && inProgressStatuses.includes(regtankStatus)) {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-amber-700`}>
        <ClockIcon className={iconSize} />
        Pending
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
  
  if (status === "IN_PROGRESS") {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-medium text-blue-700`}>
        <ClockIcon className={iconSize} />
        In Progress
      </span>
    );
  }
  
  // PENDING
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

  const isOnboardingPage = pathname === "/onboarding-start";

  // Hide corporate accounts with Expired status (regtank_onboarding.status = EXPIRED)
  const isExpired = (org: Organization) =>
    String(org.regtankOnboardingStatus ?? "").toUpperCase() === "EXPIRED";
  const visibleOrganizations = organizations.filter((org) => {
    if (org.type === "PERSONAL") return true;
    return !isExpired(org);
  });

  // Sort organizations with personal account first
  const sortedOrganizations = sortOrganizations(visibleOrganizations);

  // If current org is an expired corporate account, switch to first non-expired so user never sees "Expired" in sidebar
  React.useEffect(() => {
    if (!activeOrganization || visibleOrganizations.length === 0) return;
    if (activeOrganization.type === "PERSONAL") return;
    const status = String(activeOrganization.regtankOnboardingStatus ?? "").toUpperCase();
    if (status !== "EXPIRED") return;
    const target = visibleOrganizations.find((o) => o.onboardingStatus === "COMPLETED") ?? visibleOrganizations[0];
    if (target && target.id !== activeOrganization.id) {
      switchOrganization(target.id);
    }
  }, [activeOrganization, visibleOrganizations, switchOrganization]);

  // Get onboarded organizations for showing in switcher (also sorted)
  const onboardedOrganizations = sortOrganizations(
    organizations.filter((org) => org.onboardingStatus === "COMPLETED")
  );
  
  // Check if there are any onboarded organizations to go back to
  const hasOnboardedOrganizations = onboardedOrganizations.length > 0;

  // Get pending organizations (only PENDING status, not admin-handled statuses) for Current Action section
  const pendingOrganizations = sortOrganizations(
    organizations.filter((org) => {
      // Only show PENDING status - other pending statuses are handled by admin
      const isPending = org.onboardingStatus === "PENDING" ||
        org.regtankOnboardingStatus === "PENDING";
      // Only include if it has a verifyLink
      return isPending && org.regtankVerifyLink;
    })
  );
  
  // Check if there are any pending organizations
  const hasPendingOrganizations = pendingOrganizations.length > 0;

  // Get organizations in admin-handled pending states (for showing in dropdown when on onboarding page)
  const adminPendingOrganizations = sortOrganizations(
    organizations.filter((org) => {
      const adminHandledStatuses = ["PENDING_APPROVAL", "PENDING_AML", "PENDING_SSM_REVIEW", "PENDING_FINAL_APPROVAL"];
      return adminHandledStatuses.includes(org.onboardingStatus) ||
        (org.regtankOnboardingStatus && adminHandledStatuses.includes(org.regtankOnboardingStatus));
    })
  );
  
  // Check if there are any admin-pending organizations
  const hasAdminPendingOrganizations = adminPendingOrganizations.length > 0;

  const handleAddOrganization = () => {
    router.push("/onboarding-start");
  };

  const handleSelectOrganization = async (org: Organization) => {
    // If status is admin-handled pending statuses, redirect to dashboard (for terms & conditions)
    // Check this FIRST before any popup/redirect logic
    const adminHandledStatuses = ["PENDING_APPROVAL", "PENDING_AML", "PENDING_SSM_REVIEW", "PENDING_FINAL_APPROVAL"];
    const hasAdminHandledStatus = adminHandledStatuses.includes(org.onboardingStatus) ||
      (org.regtankOnboardingStatus && adminHandledStatuses.includes(org.regtankOnboardingStatus));
    
    if (hasAdminHandledStatus) {
      switchOrganization(org.id);
      setTimeout(() => {
        router.replace("/");
      }, 50);
      return;
    }

    // For company accounts with incomplete onboarding, redirect to onboarding-start page which will show modal
    if (org.type === "COMPANY" && org.regtankVerifyLink && org.onboardingStatus !== "COMPLETED") {
      switchOrganization(org.id);
      // Open RegTank in popup
      window.open(org.regtankVerifyLink, "_blank");
      // Redirect to onboarding-start which will check status and show modal
      router.push("/onboarding-start");
      return;
    }

    // Check if this org has an in-progress regtank onboarding and redirect to verify_link (for personal accounts)
    const inProgressStatuses = ["IN_PROGRESS", "FORM_FILLING", "LIVENESS_STARTED"];
    if (org.regtankOnboardingStatus && inProgressStatuses.includes(org.regtankOnboardingStatus) && org.regtankVerifyLink) {
      window.location.href = org.regtankVerifyLink;
      return;
    }
    
    // If status is PENDING, redirect to RegTank portal (verifyLink) (for personal accounts)
    if ((org.onboardingStatus === "PENDING" || org.regtankOnboardingStatus === "PENDING") && org.regtankVerifyLink) {
      window.location.href = org.regtankVerifyLink;
      return;
    }
    
    // If status is REJECTED, redirect to dashboard (will show rejection message)
    if (org.onboardingStatus === "REJECTED" || org.regtankOnboardingStatus === "REJECTED") {
      switchOrganization(org.id);
      setTimeout(() => {
        router.replace("/");
      }, 50);
      return;
    }
    
    // Check if status is EXPIRED and auto-restart
    if (org.regtankOnboardingStatus === "EXPIRED") {
      try {
        const apiClient = createApiClient(
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
          getAccessToken
        );
        const result = await apiClient.post<{
          verifyLink: string;
          requestId: string;
          expiresIn: number;
        }>(`/v1/regtank/retry/${org.id}?portalType=${portalType}`);
        
        if (result.success && result.data?.verifyLink) {
          window.location.href = result.data.verifyLink;
          return;
        }
      } catch (error) {
        console.error("[OrganizationSwitcher] Failed to restart expired onboarding:", error);
      }
    }
    
    // If we're on onboarding page or current org is pending, and switching to a different org, cancel onboarding
    const currentOrgPending = activeOrganization?.onboardingStatus === "PENDING";
    const switchingToDifferentOrg = org.id !== activeOrganization?.id;
    
    if ((isOnboardingPage || currentOrgPending) && switchingToDifferentOrg) {
      try {
        const apiClient = createApiClient(
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
          getAccessToken
        );
        const role = portalType === "investor" ? "INVESTOR" : "ISSUER";
        await apiClient.post("/v1/auth/cancel-onboarding", {
          role,
          reason: "User switched to a different organization during onboarding",
        });
      } catch (error) {
        // Log error but don't block the organization switch
        console.error("[OrganizationSwitcher] Failed to cancel onboarding:", error);
      }
    }

    switchOrganization(org.id);
    
    // Redirect to dashboard for COMPLETED status
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

  // On onboarding page - always show "Adding New Organization" with dropdown to switch back
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
              {(hasOnboardedOrganizations || hasAdminPendingOrganizations) && (
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
                        <OnboardingStatusBadge 
                          status={org.onboardingStatus} 
                          regtankStatus={org.regtankOnboardingStatus || undefined}
                          size="sm" 
                        />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {adminPendingOrganizations.map((org) => (
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
                        <OnboardingStatusBadge 
                          status={org.onboardingStatus} 
                          regtankStatus={org.regtankOnboardingStatus || undefined}
                          size="sm" 
                        />
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="my-2" />
                </>
              )}
              {/* Show Current Action section with pending accounts */}
              {hasPendingOrganizations && (
                <>
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current Action
                  </DropdownMenuLabel>
                  {pendingOrganizations.map((org) => {
                    // Check for admin-handled statuses (including PENDING_APPROVAL) first
                    const adminHandledStatuses = ["PENDING_APPROVAL", "PENDING_AML", "PENDING_SSM_REVIEW", "PENDING_FINAL_APPROVAL"];
                    const hasAdminHandledStatus = adminHandledStatuses.includes(org.onboardingStatus) ||
                      (org.regtankOnboardingStatus && adminHandledStatuses.includes(org.regtankOnboardingStatus));
                    
                    return (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => {
                          if (hasAdminHandledStatus) {
                            // For admin-handled statuses, just switch and redirect to dashboard
                            switchOrganization(org.id);
                            setTimeout(() => {
                              router.replace("/");
                            }, 50);
                            return;
                          }
                          
                          if (org.type === "COMPANY" && org.regtankVerifyLink && org.onboardingStatus !== "COMPLETED") {
                            // For company accounts, use popup and redirect to onboarding-start
                            switchOrganization(org.id);
                            window.open(org.regtankVerifyLink, "_blank");
                            router.push("/onboarding-start");
                          } else if (org.regtankVerifyLink) {
                            // For personal accounts, redirect normally
                            window.location.href = org.regtankVerifyLink;
                          }
                        }}
                      className="flex items-center gap-3 rounded-lg p-2.5 bg-primary/5 border border-primary/20 cursor-pointer hover:bg-accent/10"
                    >
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
                    </DropdownMenuItem>
                    );
                  })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
