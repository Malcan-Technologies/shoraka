"use client";

import * as React from "react";
import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@cashsouk/ui";
import {
  useOrganization,
  isAddingNewOrganizationRoute,
  canAccessApplicantAccount,
} from "@cashsouk/config";
import {
  HomeIcon,
  BuildingOffice2Icon,
  UserCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  QuestionMarkCircleIcon,
  LockClosedIcon,
  PlusIcon,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@cashsouk/ui";
import { useIssuerPendingOfferReviewCount } from "@/hooks/use-issuer-pending-offer-review-count";
import { useIssuerFinancingActionableCount } from "@/hooks/use-issuer-financing-actionable-count";
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

const ADDING_ORGANISATION_TOOLTIP = "Finish adding your organisation to unlock this.";
const REJECTED_ONBOARDING_TOOLTIP = "Onboarding was not approved.";
const WORK_NAV_UNLOCK_TOOLTIP = "Available after verification is complete.";
const ACCOUNT_ACCESS_UNLOCK_TOOLTIP =
  "Available after verification is complete and your account is approved to continue.";
const COMPLETED_ONBOARDING_UNLOCK_TOOLTIP = "Available after onboarding is complete.";
const LOCKED_TOOLTIP_CONTENT_CLASSNAME =
  "max-w-[260px] whitespace-normal break-words text-left leading-5";

function sidebarLockTooltip(params: {
  addingOrganisation: boolean;
  rejected: boolean;
  unlockCopy: string;
}): string {
  if (params.addingOrganisation) return ADDING_ORGANISATION_TOOLTIP;
  if (params.rejected) return REJECTED_ONBOARDING_TOOLTIP;
  return params.unlockCopy;
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
        {/* span wrapper so hover works on disabled buttons */}
        <span className="flex w-full">
          <SidebarMenuButton disabled className="w-full cursor-not-allowed">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <LockClosedIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </SidebarMenuButton>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center" className={LOCKED_TOOLTIP_CONTENT_CLASSNAME}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ApplyForFinancingCard({
  locked,
  lockedTooltip,
}: {
  locked: boolean;
  lockedTooltip: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Apply for financing
                </p>
                <p className="text-[13px] leading-5 text-muted-foreground">
                  Available after onboarding is complete.
                </p>
              </div>
              <LockClosedIcon className="hidden h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:block" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className={LOCKED_TOOLTIP_CONTENT_CLASSNAME}>
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
      <Link href="/applications/new" aria-label="Apply for financing">
        <PlusIcon className="h-4 w-4 shrink-0" />
        <span className="group-data-[collapsible=icon]:hidden">Apply for financing</span>
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
          <p className="text-sm font-semibold text-sidebar-foreground">Ready to get funded?</p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Start a new financing application in a few steps.
          </p>
        </div>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" align="center">
              Apply for financing
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
  const applicationsActionableCount = useIssuerPendingOfferReviewCount(activeOrganization?.id);
  const financingActionable = useIssuerFinancingActionableCount(activeOrganization?.id);
  const isOnboardingPage = isAddingNewOrganizationRoute(pathname);

  const allowsAccountAccess = useMemo(
    () => canAccessApplicantAccount(activeOrganization?.onboardingStatus),
    [activeOrganization?.onboardingStatus]
  );

  // Disable all navigation when on onboarding page (adding new organization)
  // Also disable if active org is not onboarded (except for pending approval states)
  const isDisabled = isOnboardingPage || (!isOnboarded && !isPendingApproval);
  // For pending approval: only dashboard is enabled, other features disabled
  // BUT allow Organisation/My account if status is PENDING_AML, PENDING_FINAL_APPROVAL, or COMPLETED
  // EXCEPT when on onboarding page - always disable Account there
  const isFeaturesDisabled =
    isOnboardingPage || ((isDisabled || isPendingApproval) && !allowsAccountAccess);

  const isRejected = activeOrganization?.onboardingStatus === "REJECTED";
  const tooltipContext = {
    addingOrganisation: isOnboardingPage,
    rejected: Boolean(isRejected),
  };
  const workNavLockedTooltip = sidebarLockTooltip({
    ...tooltipContext,
    unlockCopy: WORK_NAV_UNLOCK_TOOLTIP,
  });
  const accountAccessLockedTooltip = sidebarLockTooltip({
    ...tooltipContext,
    unlockCopy: ACCOUNT_ACCESS_UNLOCK_TOOLTIP,
  });
  const completedOnboardingLockedTooltip = sidebarLockTooltip({
    ...tooltipContext,
    unlockCopy: COMPLETED_ONBOARDING_UNLOCK_TOOLTIP,
  });

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
              <span className="ml-2 text-xs font-medium text-muted-foreground">Issuer</span>
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
                  <LockedNavButton
                    icon={HomeIcon}
                    label="Dashboard"
                    tooltip={workNavLockedTooltip}
                  />
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
                  <LockedNavButton
                    icon={DocumentTextIcon}
                    label="Applications"
                    tooltip={workNavLockedTooltip}
                  />
                ) : (
                  <>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === "/applications" || pathname.startsWith("/applications/")
                      }
                      tooltip="Applications"
                    >
                      <Link
                        href="/applications"
                        aria-label={
                          applicationsActionableCount > 0
                            ? `Applications, ${applicationsActionableCount} need${applicationsActionableCount === 1 ? "s" : ""} action`
                            : "Applications"
                        }
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        <span>Applications</span>
                      </Link>
                    </SidebarMenuButton>
                    {applicationsActionableCount > 0 ? (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground">
                        {applicationsActionableCount}
                      </SidebarMenuBadge>
                    ) : null}
                  </>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                {isDisabled ? (
                  <LockedNavButton
                    icon={BanknotesIcon}
                    label="Financing"
                    tooltip={workNavLockedTooltip}
                  />
                ) : (
                  <>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/financing" || pathname.startsWith("/financing/")}
                      tooltip="Financing"
                    >
                      <Link
                        href="/financing"
                        aria-label={
                          financingActionable.total > 0
                            ? `Financing, ${financingActionable.total} item${financingActionable.total === 1 ? "" : "s"} need action`
                            : "Financing"
                        }
                      >
                        <BanknotesIcon className="h-4 w-4" />
                        <span>Financing</span>
                      </Link>
                    </SidebarMenuButton>
                    {financingActionable.total > 0 ? (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground">
                        {financingActionable.total}
                      </SidebarMenuBadge>
                    ) : null}
                  </>
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
                    tooltip={accountAccessLockedTooltip}
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
                    tooltip={accountAccessLockedTooltip}
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
        <ApplyForFinancingCard
          locked={isDisabled || isPendingApproval}
          lockedTooltip={completedOnboardingLockedTooltip}
        />

      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
