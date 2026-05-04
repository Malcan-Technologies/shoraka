"use client";

import * as React from "react";
import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@cashsouk/ui";
import { useOrganization } from "@cashsouk/config";
import {
  HomeIcon,
  UserCircleIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@cashsouk/ui";

function subscribeMounted() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { isOnboarded, isPendingApproval, activeOrganization } = useOrganization();
  const isOnboardingPage = pathname === "/onboarding-start";

  // Check if organization has a status that allows Account/Profile access
  const allowsAccountAccess = useMemo(() => {
    const status = activeOrganization?.onboardingStatus;
    return (
      status === "PENDING_AML" ||
      status === "PENDING_FINAL_APPROVAL" ||
      status === "COMPLETED"
    );
  }, [activeOrganization]);

  // Disable all navigation when on onboarding page (adding new organization)
  // Also disable if active org is not onboarded (except for pending approval states)
  const isDisabled = isOnboardingPage || (!isOnboarded && !isPendingApproval);
  // For pending approval: only dashboard is enabled, other features disabled
  // BUT allow Account if status is PENDING_AML, PENDING_FINAL_APPROVAL, or COMPLETED
  // EXCEPT when on onboarding page - always disable Account there
  const isFeaturesDisabled = isOnboardingPage || ((isDisabled || isPendingApproval) && !allowsAccountAccess);
  const mounted = React.useSyncExternalStore(
    subscribeMounted,
    getClientSnapshot,
    getServerSnapshot
  );

  // Show skeleton while not mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex h-16 items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0 px-3">
            <Skeleton className="h-14 w-14 rounded group-data-[collapsible=icon]:block hidden" />
            <div className="flex items-center group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="ml-2 h-4 w-16" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <div className="px-2">
            <Separator className="my-2" />
          </div>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="cursor-default">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-12 items-center justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-0 px-3">
          <div className="relative w-full">
            <Image
              src="/shoraka_favicon.svg"
              alt="CashSouk"
              width={40}
              height={40}
              className="h-10 w-10 opacity-0 group-data-[collapsible=icon]:opacity-100 transition-opacity duration-200 absolute left-1/2 -translate-x-1/2"
            />
            <div className="flex items-center opacity-100 group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
              <Logo />
              <span className="ml-2 text-xs font-medium text-muted-foreground">Investor</span>
            </div>
          </div>
        </div>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isDisabled ? (
                  <SidebarMenuButton
                    disabled
                    tooltip="Complete onboarding to access"
                    className="opacity-50 cursor-not-allowed"
                  >
                    <HomeIcon className="h-4 w-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                    <Link href="/">
                      <HomeIcon className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                {isDisabled ? (
                  <SidebarMenuButton
                    disabled
                    tooltip="Complete onboarding to access"
                    className="opacity-50 cursor-not-allowed"
                  >
                    <ClockIcon className="h-4 w-4" />
                    <span>Activity</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === "/activity"} tooltip="Activity">
                    <Link href="/activity">
                      <ClockIcon className="h-4 w-4" />
                      <span>Activity</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <SidebarMenuButton
                    disabled
                    tooltip={isPendingApproval ? "Pending approval" : "Complete onboarding to access"}
                    className="opacity-50 cursor-not-allowed"
                  >
                    <ArrowTrendingUpIcon className="h-4 w-4" />
                    <span>Investments</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/investments" || pathname.startsWith("/investments/")}
                    tooltip="Investments"
                  >
                    <Link href="/investments">
                      <ArrowTrendingUpIcon className="h-4 w-4" />
                      <span>Investments</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <SidebarMenuButton
                    disabled
                    tooltip={isPendingApproval ? "Pending approval" : "Complete onboarding to access"}
                    className="opacity-50 cursor-not-allowed"
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    <span>Profile</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === "/profile"} tooltip="Profile">
                    <Link href="/profile">
                      <UserCircleIcon className="h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/help" || pathname.startsWith("/help/")} tooltip="Help">
                  <Link href="/help">
                    <QuestionMarkCircleIcon className="h-4 w-4" />
                    <span>Help</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
