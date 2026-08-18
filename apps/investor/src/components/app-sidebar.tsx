"use client";

import * as React from "react";
import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@cashsouk/ui";
import {
  formatCurrency,
  useOrganization,
  isAddingNewOrganizationRoute,
  canAccessApplicantAccount,
  getOnboardingStep,
  type OnboardingFlowStep,
} from "@cashsouk/config";
import {
  HomeIcon,
  UserCircleIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ArrowTrendingUpIcon,
  ChartBarSquareIcon,
  BanknotesIcon,
  LockClosedIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@cashsouk/ui";
import { useInvestorPortfolio } from "@/investments/hooks/use-marketplace-notes";
import { cn } from "@/lib/utils";

function subscribeMounted() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function unlockTooltipForStep(step: OnboardingFlowStep | null): string {
  switch (step) {
    case "account":
      return "Create your organisation account to unlock this";
    case "terms":
      return "Accept the user agreement to unlock this";
    case "fee":
      return "Pay the onboarding fee to unlock this";
    case "verify":
      return "Complete identity verification to unlock this";
    case "deposit":
      return "Complete your first deposit to unlock this";
    case "approval":
      return "Available after your organisation is approved";
    default:
      return "Complete onboarding to unlock this";
  }
}

function LockedNavButton({
  icon: Icon,
  label,
  tooltip,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-full">
          <SidebarMenuButton disabled className="w-full cursor-not-allowed">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <LockClosedIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </SidebarMenuButton>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function InvestNowCard({
  locked,
  lockedTooltip,
}: {
  locked: boolean;
  lockedTooltip: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { activeOrganization } = useOrganization();
  const { data: portfolio } = useInvestorPortfolio(
    locked ? undefined : activeOrganization?.id
  );
  const availableBalance = Number(portfolio?.availableBalance ?? 0);

  if (locked) {
    return (
      <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/40 p-3",
                "group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
              )}
            >
              <div className="space-y-1 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-semibold text-sidebar-foreground">Available balance</p>
                <p className="text-ui leading-5 text-muted-foreground">
                  Available after onboarding is complete.
                </p>
              </div>
              <LockClosedIcon className="hidden h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:block" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            {lockedTooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const button = (
    <Button
      asChild
      className={cn(
        "h-10 w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95",
        "group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:p-0"
      )}
    >
      <Link href="/marketplace" aria-label="Invest now">
        <ArrowTrendingUpIcon className="h-4 w-4 shrink-0" />
        <span className="group-data-[collapsible=icon]:hidden">Invest now</span>
      </Link>
    </Button>
  );

  return (
    <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
      <div
        className={cn(
          "rounded-xl border border-primary/15 bg-primary/5 p-3 shadow-sm",
          "group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none"
        )}
      >
        <div className="mb-3 space-y-1 group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-semibold text-sidebar-foreground">Available balance</p>
          <p className="text-lg font-semibold tabular-nums leading-tight text-sidebar-foreground">
            {formatCurrency(availableBalance)}
          </p>
          <p className="text-ui leading-5 text-muted-foreground">
            Browse notes and commit capital from the marketplace.
          </p>
        </div>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" align="center">
              Invest now · {formatCurrency(availableBalance)}
            </TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { isOnboarded, isPendingApproval, activeOrganization } = useOrganization();
  const isOnboardingPage = isAddingNewOrganizationRoute(pathname);

  const allowsAccountAccess = useMemo(
    () => canAccessApplicantAccount(activeOrganization?.onboardingStatus),
    [activeOrganization?.onboardingStatus]
  );

  const isDisabled = isOnboardingPage || (!isOnboarded && !isPendingApproval);
  const isFeaturesDisabled =
    isOnboardingPage || ((isDisabled || isPendingApproval) && !allowsAccountAccess);

  const lockedTooltip = useMemo(() => {
    if (isOnboardingPage) {
      return "Finish adding your organisation to unlock this";
    }
    if (isPendingApproval) {
      return "Available after your organisation is approved";
    }
    const step = getOnboardingStep(activeOrganization, "investor");
    return unlockTooltipForStep(step);
  }, [activeOrganization, isOnboardingPage, isPendingApproval]);

  const settingsLockedTooltip = useMemo(() => {
    if (isOnboardingPage) {
      return "Finish adding your organisation to unlock this";
    }
    if (isPendingApproval && !allowsAccountAccess) {
      return "Available after your organisation is approved";
    }
    const step = getOnboardingStep(activeOrganization, "investor");
    return unlockTooltipForStep(step);
  }, [activeOrganization, allowsAccountAccess, isOnboardingPage, isPendingApproval]);

  const mounted = React.useSyncExternalStore(
    subscribeMounted,
    getClientSnapshot,
    getServerSnapshot
  );

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
        <SidebarFooter className="mt-auto border-t border-sidebar-border pt-2">
          <Skeleton className="h-24 w-full rounded-xl group-data-[collapsible=icon]:size-10" />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  }

  const investLocked = isDisabled || isPendingApproval;

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
              className="absolute left-1/2 h-10 w-10 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-100"
            />
            <div className="flex items-center opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
              <Logo />
              <span className="ml-2 text-xs font-medium text-muted-foreground">Investor</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isDisabled ? (
                  <LockedNavButton icon={HomeIcon} label="Dashboard" tooltip={lockedTooltip} />
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
                  <LockedNavButton icon={ClockIcon} label="Activity" tooltip={lockedTooltip} />
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
                  <LockedNavButton
                    icon={ArrowTrendingUpIcon}
                    label="Marketplace"
                    tooltip={lockedTooltip}
                  />
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/marketplace"}
                    tooltip="Marketplace"
                  >
                    <Link href="/marketplace">
                      <ArrowTrendingUpIcon className="h-4 w-4" />
                      <span>Marketplace</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <LockedNavButton
                    icon={ChartBarSquareIcon}
                    label="Investments"
                    tooltip={lockedTooltip}
                  />
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/investments" || pathname.startsWith("/investments/")}
                    tooltip="Investments"
                  >
                    <Link href="/investments">
                      <ChartBarSquareIcon className="h-4 w-4" />
                      <span>Investments</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <LockedNavButton
                    icon={BanknotesIcon}
                    label="Transactions"
                    tooltip={lockedTooltip}
                  />
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/transactions"}
                    tooltip="Transactions"
                  >
                    <Link href="/transactions">
                      <BanknotesIcon className="h-4 w-4" />
                      <span>Transactions</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-2">
          <Separator className="my-2" />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <LockedNavButton
                    icon={BuildingOffice2Icon}
                    label="Organisation"
                    tooltip={settingsLockedTooltip}
                  />
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/profile" || pathname.startsWith("/profile/")}
                    tooltip="Organisation"
                  >
                    <Link href="/profile">
                      <BuildingOffice2Icon className="h-4 w-4" />
                      <span>Organisation</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                {isFeaturesDisabled ? (
                  <LockedNavButton
                    icon={UserCircleIcon}
                    label="My account"
                    tooltip={settingsLockedTooltip}
                  />
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/account" || pathname.startsWith("/account/")}
                    tooltip="My account"
                  >
                    <Link href="/account">
                      <UserCircleIcon className="h-4 w-4" />
                      <span>My account</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/help" || pathname.startsWith("/help/")}
                  tooltip="Help"
                >
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


      <SidebarFooter className="mt-auto border-t border-sidebar-border pt-2">
        <InvestNowCard locked={investLocked} lockedTooltip={lockedTooltip} />

      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
