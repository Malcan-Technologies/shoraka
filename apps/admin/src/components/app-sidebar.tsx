"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CashSoukSidebarFooter, Logo } from "@cashsouk/ui";
import {
  HomeIcon,
  DocumentTextIcon,
  UsersIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  ClipboardDocumentListIcon,
  CheckBadgeIcon,
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  ScaleIcon,
  DocumentDuplicateIcon,
  QuestionMarkCircleIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  CubeIcon,
  CalculatorIcon,
  BellIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { usePendingApprovalCount } from "@/hooks/use-pending-approval-count";
import { useGatewayPaymentsExceptionCount } from "@/hooks/use-gateway-payments";
import { useGatewayReconPendingCount } from "@/hooks/use-gateway-recon";
import { useProducts } from "@/hooks/use-products";
import { useApplicationNavCounts } from "@/hooks/use-application-nav-counts";
import {
  useNoteActionRequiredCount,
  usePendingInvestorWithdrawals,
  usePendingRepayments,
  usePendingIssuerPayouts,
  usePendingSettlementTrusteeLetters,
} from "@/notes/hooks/use-notes";
import {
  type ApplicationNavGroup,
  activeProductPendingActionTotal,
  applicationsSidebarProductLabel,
  buildApplicationSidebarGroups,
} from "@/applications/application-nav-groups";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

function ApplicationNavSectionHeader({
  kind,
  count,
}: {
  kind: "active" | "inactive";
  count: number;
}) {
  const isActiveSection = kind === "active";
  const label = isActiveSection ? "Active" : "Inactive";
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-baseline gap-1.5 px-2 pb-1 text-[11px] font-semibold leading-none tracking-wide",
        isActiveSection ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"
      )}
      aria-label={`${label} products, ${count} listed`}
    >
      <span className="truncate uppercase">{label}</span>
      <span className="font-medium tabular-nums text-sidebar-foreground/50 dark:text-sidebar-foreground/45">
        {count}
      </span>
    </div>
  );
}

function ApplicationInactiveNavSection({
  groups,
  pathname,
  linkClassName,
}: {
  groups: ApplicationNavGroup[];
  pathname: string;
  linkClassName: string;
}) {
  const pendingTotal = groups.reduce((sum, group) => sum + group.pendingActionCount, 0);
  const pathActive = groups.some(
    (group) => pathname === group.queuePath || pathname.startsWith(`${group.queuePath}/`)
  );
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (pathActive) setOpen(true);
  }, [pathActive, pathname]);

  if (groups.length === 0) return null;

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/inactive-apps"
    >
      <li className="list-none">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-1.5 px-2 pb-1 pt-4 text-[11px] font-semibold leading-none tracking-wide text-muted-foreground hover:text-sidebar-foreground"
            aria-label={`Inactive products, ${groups.length} listed`}
          >
            <span className="truncate uppercase">Inactive</span>
            <span className="font-medium tabular-nums text-sidebar-foreground/50 dark:text-sidebar-foreground/45">
              {groups.length}
            </span>
            {pendingTotal > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1 text-xs font-medium tabular-nums text-muted-foreground">
                {pendingTotal}
              </span>
            ) : null}
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/inactive-apps:rotate-90",
                pendingTotal > 0 ? "" : "ml-auto"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="flex min-w-0 flex-col gap-0 py-0">
            {groups.map((group) => {
              const label = applicationsSidebarProductLabel(group.productTitle);
              return (
                <SidebarMenuSubItem key={group.baseKey} className="pl-2">
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    isActive={
                      pathname === group.queuePath || pathname.startsWith(`${group.queuePath}/`)
                    }
                    className={linkClassName}
                  >
                    <Link
                      href={group.queuePath}
                      title={`${label} (inactive)`}
                      className="flex min-w-0 flex-row items-center gap-2"
                    >
                      <span
                        className="mt-px size-1.5 shrink-0 self-center rounded-full bg-muted-foreground/35"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate leading-tight text-muted-foreground">
                        {label}
                      </span>
                      {group.pendingActionCount > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-xs font-medium tabular-nums text-muted-foreground">
                          {group.pendingActionCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

type BadgeKey =
  | "onboardingApproval"
  | "noteActions"
  | "pendingRepayments"
  | "pendingSettlementTrusteeLetters"
  | "pendingIssuerPayouts"
  | "pendingInvestorWithdrawals"
  | "gatewayPaymentExceptions"
  | "gatewayReconExceptions";

type NavLinkItem = {
  title: string;
  url: string;
  badgeKey?: BadgeKey;
  canShow: boolean;
};

const navLifecycleConfig = [
  {
    title: "Onboarding Approval",
    url: "/onboarding-approval",
    icon: CheckBadgeIcon,
    badgeKey: "onboardingApproval" as const,
  },
  {
    title: "Applications",
    url: "#",
    icon: DocumentCheckIcon,
  },
  {
    title: "Facilities",
    url: "/contracts",
    icon: DocumentDuplicateIcon,
  },
  {
    title: "Notes",
    url: "/notes",
    icon: DocumentTextIcon,
    badgeKey: "noteActions" as const,
  },
  {
    title: "Investments",
    url: "/investments",
    icon: ArrowTrendingUpIcon,
  },
] as const;

const moneyMovementItems: Array<{
  title: string;
  url: string;
  badgeKey: BadgeKey;
  permission: "repayments" | "settlements" | "disbursements" | "investorWithdrawals";
}> = [
  {
    title: "Repayments",
    url: "/finance/repayments",
    badgeKey: "pendingRepayments",
    permission: "repayments",
  },
  {
    title: "Settlements",
    url: "/finance/pending-settlement-trustee-letters",
    badgeKey: "pendingSettlementTrusteeLetters",
    permission: "settlements",
  },
  {
    title: "Issuer Payouts",
    url: "/finance/issuer-payouts",
    badgeKey: "pendingIssuerPayouts",
    permission: "disbursements",
  },
  {
    title: "Investor Withdrawals",
    url: "/finance/investor-withdrawals",
    badgeKey: "pendingInvestorWithdrawals",
    permission: "investorWithdrawals",
  },
];

const gatewayItems: Array<{
  title: string;
  url: string;
  badgeKey: BadgeKey;
  permission: "gatewayPayments" | "reconciliation";
}> = [
  {
    title: "Gateway Payments",
    url: "/finance/gateway-payments",
    badgeKey: "gatewayPaymentExceptions",
    permission: "gatewayPayments",
  },
  {
    title: "Reconciliation",
    url: "/finance/reconciliation",
    badgeKey: "gatewayReconExceptions",
    permission: "reconciliation",
  },
];

const navDirectory = [
  { title: "User Accounts", url: "/accounts", icon: UsersIcon, access: "users" },
  { title: "Issuers", url: "/issuers", icon: BuildingOffice2Icon, access: "organizations" },
  { title: "Investors", url: "/investors", icon: UserGroupIcon, access: "organizations" },
  { title: "Legal Documents", url: "/legal-documents", icon: ScaleIcon, access: "documents" },
  { title: "Legal Acceptances", url: "/legal-document-acceptances", icon: ClipboardDocumentCheckIcon, access: "documents" },
] as const;

const navSettings = [
  { title: "Products", url: "/settings/products", icon: CubeIcon },
  { title: "Platform Finance", url: "/settings/platform-finance", icon: CalculatorIcon },
  { title: "Notifications", url: "/settings/notifications", icon: BellIcon },
  { title: "Roles", url: "/settings/roles", icon: ShieldCheckIcon },
] as const;

function FinanceCollapsibleGroup({
  title,
  icon: Icon,
  items,
  badges,
  pathname,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavLinkItem[];
  badges: Record<string, number>;
  pathname: string;
}) {
  const visibleItems = items.filter((item) => item.canShow);
  const parentBadge = visibleItems.reduce((sum, item) => {
    if (!item.badgeKey) return sum;
    return sum + (badges[item.badgeKey] || 0);
  }, 0);
  const pathActive = visibleItems.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`)
  );
  const forceOpen = pathActive || parentBadge > 0;
  const [open, setOpen] = React.useState(forceOpen);

  React.useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen, pathname]);

  if (visibleItems.length === 0) return null;

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={title}>
            <Icon className="h-4 w-4" />
            <span>{title}</span>
            {parentBadge > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground group-data-[collapsible=icon]:hidden">
                {parentBadge}
              </span>
            ) : null}
            <ChevronRight
              className={cn(
                "transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90",
                parentBadge > 0 ? "" : "ml-auto"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visibleItems.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                  >
                    <Link href={item.url}>
                      <span>{item.title}</span>
                      {badgeCount > 0 ? (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground">
                          {badgeCount}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const canViewDashboard = can("dashboard.view");
  const canViewOnboarding = can("onboarding.view");
  const canViewApplications = can("applications.view");
  const canViewContracts = can("contracts.view");
  const canViewNotes = can("notes.view");
  const canViewInvestments = can("investments.view");

  const canViewBucketBalances = can("bucket_balances.view");
  const canViewRepayments = can("repayments.view");
  const canViewSettlements = can("settlements.view");
  const canViewDisbursements = can("disbursements.view");
  const canViewInvestorWithdrawals = can("investor_withdrawals.view");
  const canViewGatewayPayments = can("gateway_payments.view");
  const canViewReconciliation = can("gateway_reconciliation.view");

  const canViewUsers = can("users.view");
  const canViewOrganizations = can("organizations.view");
  const canViewDocuments = can("document_management.view");

  const canViewNotifications = can("notifications.view");
  const canViewProducts = can("products.view");
  const canViewPlatformFinance = can("platform_settings.view");
  const canViewRoles = can("roles.view");

  const canViewAuditAccess = can("audit.access.view");
  const canViewAuditSecurity = can("audit.security.view");
  const canViewAuditProduct = can("audit.product.view");
  const canViewAnyAudit =
    canViewAuditAccess || canViewAuditSecurity || canViewAuditProduct;

  const { data: pendingCountData } = usePendingApprovalCount({ enabled: canViewOnboarding });
  const { data: noteActionCountData } = useNoteActionRequiredCount({ enabled: canViewNotes });
  const { data: pendingRepaymentsData } = usePendingRepayments({ enabled: canViewRepayments });
  const { data: pendingIssuerPayoutsData } = usePendingIssuerPayouts({
    enabled: canViewDisbursements,
  });
  const { data: pendingInvestorWithdrawalsData } = usePendingInvestorWithdrawals({
    enabled: canViewInvestorWithdrawals,
  });
  const { data: gatewayPaymentExceptionsData } = useGatewayPaymentsExceptionCount({
    enabled: canViewGatewayPayments,
  });
  const { data: gatewayReconData } = useGatewayReconPendingCount({
    enabled: canViewReconciliation,
  });
  const { data: pendingSettlementTrusteeLettersData } = usePendingSettlementTrusteeLetters({
    enabled: canViewSettlements,
  });

  const { data: productsData } = useProducts({
    page: 1,
    pageSize: 100,
    includeDeleted: true,
    enabled: canViewApplications,
  });

  const { data: navCountsData } = useApplicationNavCounts({
    enabled: canViewApplications,
  });

  const badges: Record<BadgeKey, number> = {
    onboardingApproval: pendingCountData?.count || 0,
    noteActions: noteActionCountData?.count || 0,
    pendingRepayments: pendingRepaymentsData?.count || 0,
    pendingSettlementTrusteeLetters: pendingSettlementTrusteeLettersData?.count || 0,
    pendingIssuerPayouts: pendingIssuerPayoutsData?.count || 0,
    pendingInvestorWithdrawals: pendingInvestorWithdrawalsData?.count || 0,
    gatewayPaymentExceptions: gatewayPaymentExceptionsData?.count || 0,
    gatewayReconExceptions: gatewayReconData?.count || 0,
  };

  const permissionFlags = {
    repayments: canViewRepayments,
    settlements: canViewSettlements,
    disbursements: canViewDisbursements,
    investorWithdrawals: canViewInvestorWithdrawals,
    gatewayPayments: canViewGatewayPayments,
    reconciliation: canViewReconciliation,
  };

  const moneyMovementNav: NavLinkItem[] = moneyMovementItems.map((item) => ({
    title: item.title,
    url: item.url,
    badgeKey: item.badgeKey,
    canShow: permissionFlags[item.permission],
  }));

  const gatewayNav: NavLinkItem[] = gatewayItems.map((item) => ({
    title: item.title,
    url: item.url,
    badgeKey: item.badgeKey,
    canShow: permissionFlags[item.permission],
  }));

  const dynamicNavLifecycle = React.useMemo(() => {
    return navLifecycleConfig.map((item) => {
      if (item.title === "Applications") {
        return {
          ...item,
          applicationNavGroups: buildApplicationSidebarGroups(
            productsData?.products ?? [],
            navCountsData?.products ?? []
          ),
        };
      }
      return item;
    });
  }, [productsData, navCountsData]);

  const hasVisibleLifecycleNav = dynamicNavLifecycle.some((item) => {
    return (
      (item.title === "Onboarding Approval" && canViewOnboarding) ||
      (item.title === "Applications" && canViewApplications) ||
      (item.title === "Facilities" && canViewContracts) ||
      (item.title === "Notes" && canViewNotes) ||
      (item.title === "Investments" && canViewInvestments)
    );
  });

  const hasVisibleFinanceNav =
    canViewBucketBalances ||
    moneyMovementNav.some((item) => item.canShow) ||
    gatewayNav.some((item) => item.canShow);

  const hasVisibleDirectoryNav = canViewUsers || canViewOrganizations || canViewDocuments;

  const settingsItems = navSettings.filter((item) => {
    if (item.url === "/settings/roles") return canViewRoles;
    if (item.url === "/settings/notifications") return canViewNotifications;
    if (item.url === "/settings/products") return canViewProducts;
    if (item.url === "/settings/platform-finance") return canViewPlatformFinance;
    return false;
  });

  const hasVisibleSettingsNav = settingsItems.length > 0;
  const hasVisibleUtilityNav = true; // Help always visible
  const showUtilityGroup = hasVisibleUtilityNav || canViewAnyAudit;

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
              <span className="ml-2 text-xs font-medium text-muted-foreground">Admin</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {canViewDashboard ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                    <Link href="/">
                      <HomeIcon className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasVisibleLifecycleNav ? (
          <SidebarGroup>
            <SidebarGroupLabel>Lifecycle</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dynamicNavLifecycle.map((item) => {
                  const canShow =
                    (item.title === "Onboarding Approval" && canViewOnboarding) ||
                    (item.title === "Applications" && canViewApplications) ||
                    (item.title === "Facilities" && canViewContracts) ||
                    (item.title === "Notes" && canViewNotes) ||
                    (item.title === "Investments" && canViewInvestments);

                  if (!canShow) return null;

                  const Icon = item.icon;
                  const badgeCount = "badgeKey" in item && item.badgeKey ? badges[item.badgeKey] : 0;

                  if (item.title === "Applications" && "applicationNavGroups" in item) {
                    const groups = item.applicationNavGroups ?? [];
                    const applicationBadgeCount = activeProductPendingActionTotal(groups);
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={pathname.startsWith("/applications")}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              <Icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              {applicationBadgeCount > 0 && (
                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground group-data-[collapsible=icon]:hidden">
                                  {applicationBadgeCount}
                                </span>
                              )}
                              <ChevronRight
                                className={cn(
                                  "transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90",
                                  applicationBadgeCount > 0 ? "" : "ml-auto"
                                )}
                              />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {(() => {
                              const activeGroups = groups.filter((g) => !g.isInactive);
                              const inactiveGroups = groups.filter((g) => g.isInactive);
                              const applicationSubLinkClass =
                                "h-auto min-h-7 flex-row items-center gap-2 py-1 font-normal whitespace-normal";

                              return (
                                <SidebarMenuSub className="gap-0 py-0">
                                  <li className="list-none px-0 pt-3">
                                    <ApplicationNavSectionHeader
                                      kind="active"
                                      count={activeGroups.length}
                                    />
                                  </li>

                                  {activeGroups.map((g) => {
                                    const label = applicationsSidebarProductLabel(g.productTitle);
                                    return (
                                      <SidebarMenuSubItem key={g.baseKey} className="pl-2">
                                        <SidebarMenuSubButton
                                          asChild
                                          size="sm"
                                          isActive={
                                            pathname === g.queuePath ||
                                            pathname.startsWith(`${g.queuePath}/`)
                                          }
                                          className={applicationSubLinkClass}
                                        >
                                          <Link
                                            href={g.queuePath}
                                            title={`${label} (active)`}
                                            className="flex min-w-0 flex-row items-center gap-2"
                                          >
                                            <span
                                              className="mt-px size-1.5 shrink-0 self-center rounded-full bg-emerald-500/80 dark:bg-emerald-400/80"
                                              aria-hidden
                                            />
                                            <span className="min-w-0 flex-1 truncate leading-tight text-sidebar-foreground">
                                              {label}
                                            </span>
                                            {g.pendingActionCount > 0 && (
                                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-primary px-1 text-xs font-medium tabular-nums text-primary-foreground">
                                                {g.pendingActionCount}
                                              </span>
                                            )}
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}

                                  {activeGroups.length === 0 && (
                                    <li className="list-none px-2 py-0.5 pl-4 text-xs text-muted-foreground">
                                      No active products
                                    </li>
                                  )}

                                  <ApplicationInactiveNavSection
                                    groups={inactiveGroups}
                                    pathname={pathname}
                                    linkClassName={applicationSubLinkClass}
                                  />
                                </SidebarMenuSub>
                              );
                            })()}
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badgeCount > 0 && (
                        <SidebarMenuBadge className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground">
                          {badgeCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {hasVisibleFinanceNav ? (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {canViewBucketBalances ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === "/finance/buckets" ||
                        pathname.startsWith("/finance/buckets/")
                      }
                      tooltip="Bucket Balances"
                    >
                      <Link href="/finance/buckets">
                        <BanknotesIcon className="h-4 w-4" />
                        <span>Bucket Balances</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}

                <FinanceCollapsibleGroup
                  title="Money movement"
                  icon={ArrowsRightLeftIcon}
                  items={moneyMovementNav}
                  badges={badges}
                  pathname={pathname}
                />
                <FinanceCollapsibleGroup
                  title="Payments"
                  icon={CreditCardIcon}
                  items={gatewayNav}
                  badges={badges}
                  pathname={pathname}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {hasVisibleDirectoryNav ? (
          <SidebarGroup>
            <SidebarGroupLabel>Directory</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navDirectory.map((item) => {
                  const canShow =
                    (item.access === "users" && canViewUsers) ||
                    (item.access === "organizations" && canViewOrganizations) ||
                    (item.access === "documents" && canViewDocuments);
                  if (!canShow) return null;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {hasVisibleSettingsNav ? (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {showUtilityGroup ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
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
                {canViewAnyAudit ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/audit" || pathname.startsWith("/audit/")}
                      tooltip="Audit"
                    >
                      <Link href="/audit">
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                        <span>Audit</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-sidebar-border pt-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <CashSoukSidebarFooter variant="admin" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
