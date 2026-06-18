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
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
  DocumentCheckIcon,
  FolderOpenIcon,
  DocumentDuplicateIcon,
  CubeIcon,
  QuestionMarkCircleIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

import { NavUser } from "@/components/nav-user";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
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
import { useProducts } from "@/hooks/use-products";
import { useAdminApplicationsForSidebar } from "@/hooks/use-admin-applications-for-sidebar";
import {
  useNoteActionRequiredCount,
  usePendingRepayments,
  usePendingIssuerPayouts,
  usePendingServiceFeeTrusteeLetters,
} from "@/notes/hooks/use-notes";
import {
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
    title: "Contracts",
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

const navFinance = [
  {
    title: "Bucket Balances",
    url: "/finance/buckets",
    icon: BanknotesIcon,
  },
  {
    title: "Repayments",
    url: "/finance/repayments",
    icon: ArrowDownTrayIcon,
    badgeKey: "pendingRepayments" as const,
  },
  {
    title: "Service Fee",
    url: "/finance/service-fee-trustee-letters",
    icon: ArrowsRightLeftIcon,
    badgeKey: "pendingServiceFeeTrusteeLetters" as const,
  },
  {
    title: "Issuer Payouts",
    url: "/finance/issuer-payouts",
    icon: ArrowUpTrayIcon,
    badgeKey: "pendingIssuerPayouts" as const,
  },
] as const;

const navPlatform = [
  {
    title: "Users",
    url: "/users",
    icon: UsersIcon,
  },
  {
    title: "Organizations",
    url: "/organizations",
    icon: BuildingOffice2Icon,
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FolderOpenIcon,
  },
  {
    title: "Help",
    url: "/help",
    icon: QuestionMarkCircleIcon,
  },
  {
    title: "Settings",
    url: "#",
    icon: Cog6ToothIcon,
    items: [
      { title: "General", url: "/settings/general" },
      { title: "Security", url: "/settings/security" },
      { title: "Notifications", url: "/settings/notifications" },
      { title: "Products", url: "/settings/products" },
      { title: "Platform Finance", url: "/settings/platform-finance" },
      { title: "Roles", url: "/settings/roles" },
    ],
  },
];

const navAudit = [
  { title: "Access Logs", url: "/audit/access-logs", icon: ClipboardDocumentListIcon },
  { title: "Security Logs", url: "/audit/security-logs", icon: ShieldCheckIcon },
  { title: "Document Logs", url: "/audit/document-logs", icon: DocumentDuplicateIcon },
  { title: "Product Logs", url: "/audit/product-logs", icon: CubeIcon },
];

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
  const canViewServiceFee = can("service_fee.view");
  const canViewDisbursements = can("disbursements.view");

  const canViewUsers = can("users.view");
  const canViewOrganizations = can("organizations.view");
  const canViewDocuments = can("document_management.view");

  const canViewNotifications = can("notifications.view");
  const canViewProducts = can("products.view");
  const canViewPlatformFinance = can("platform_settings.view");
  const canViewRoles = can("roles.view");

  const canViewAuditAccess = can("audit.access.view");
  const canViewAuditSecurity = can("audit.security.view");
  const canViewAuditDocument = can("audit.document.view");
  const canViewAuditProduct = can("audit.product.view");

  const { data: pendingCountData } = usePendingApprovalCount({ enabled: canViewOnboarding });
  const { data: noteActionCountData } = useNoteActionRequiredCount({ enabled: canViewNotes });
  const { data: pendingRepaymentsData } = usePendingRepayments({ enabled: canViewRepayments });
  const { data: pendingIssuerPayoutsData } = usePendingIssuerPayouts({ enabled: canViewDisbursements });
  const { data: pendingServiceFeeLettersData } = usePendingServiceFeeTrusteeLetters({
    enabled: canViewServiceFee,
  });

  const { data: productsData } = useProducts({
    page: 1,
    pageSize: 100,
    includeDeleted: true,
    enabled: canViewApplications,
  });

  const { data: applicationsForSidebar = [] } = useAdminApplicationsForSidebar({
    enabled: canViewApplications,
  });

  const badges: Record<string, number> = {
    onboardingApproval: pendingCountData?.count || 0,
    noteActions: noteActionCountData?.count || 0,
    pendingRepayments: pendingRepaymentsData?.count || 0,
    pendingServiceFeeTrusteeLetters: pendingServiceFeeLettersData?.count || 0,
    pendingIssuerPayouts: pendingIssuerPayoutsData?.count || 0,
  };

  const dynamicNavLifecycle = React.useMemo(() => {
    return navLifecycleConfig.map((item) => {
      if (item.title === "Applications") {
        return {
          ...item,
          applicationNavGroups: buildApplicationSidebarGroups(
            productsData?.products ?? [],
            applicationsForSidebar
          ),
        };
      }
      return item;
    });
  }, [productsData, applicationsForSidebar]);

  const hasVisibleLifecycleNav = dynamicNavLifecycle.some((item) => {
    return (
      (item.title === "Onboarding Approval" && canViewOnboarding) ||
      (item.title === "Applications" && canViewApplications) ||
      (item.title === "Contracts" && canViewContracts) ||
      (item.title === "Notes" && canViewNotes) ||
      (item.title === "Investments" && canViewInvestments)
    );
  });

  const hasVisibleFinanceNav = navFinance.some((item) => {
    return (
      (item.title === "Bucket Balances" && canViewBucketBalances) ||
      (item.title === "Repayments" && canViewRepayments) ||
      (item.title === "Service Fee" && canViewServiceFee) ||
      (item.title === "Issuer Payouts" && canViewDisbursements)
    );
  });

  const hasVisibleAuditNav = navAudit.some((item) => {
    return (
      (item.url === "/audit/access-logs" && canViewAuditAccess) ||
      (item.url === "/audit/security-logs" && canViewAuditSecurity) ||
      (item.url === "/audit/document-logs" && canViewAuditDocument) ||
      (item.url === "/audit/product-logs" && canViewAuditProduct)
    );
  });

  const settingsItem = navPlatform.find((i) => i.title === "Settings" && "items" in i);
  const settingsSubItems =
    settingsItem && "items" in settingsItem && Array.isArray((settingsItem as any).items)
      ? (settingsItem as any).items.filter(
          (subItem: { url: string }) =>
            (subItem.url !== "/settings/roles" || canViewRoles) &&
            (subItem.url !== "/settings/notifications" || canViewNotifications) &&
            (subItem.url !== "/settings/products" || canViewProducts) &&
            (subItem.url !== "/settings/platform-finance" || canViewPlatformFinance) &&
            (subItem.url !== "/settings/general" || canViewPlatformFinance) &&
            (subItem.url !== "/settings/security" || canViewPlatformFinance)
        )
      : undefined;

  const hasVisiblePlatformNav = navPlatform.some((item) => {
    if ("items" in item) {
      return (item.items?.length ?? 0) > 0 && (settingsSubItems?.length ?? 0) > 0;
    }

    if (item.title === "Help") return true;
    if (item.title === "Users") return canViewUsers;
    if (item.title === "Organizations") return canViewOrganizations;
    if (item.title === "Documents") return canViewDocuments;
    return false;
  });

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

        <SidebarGroup>
          {hasVisibleLifecycleNav ? (
            <>
              <SidebarGroupLabel>Lifecycle</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {dynamicNavLifecycle.map((item) => {
                    const canShow =
                      (item.title === "Onboarding Approval" && canViewOnboarding) ||
                      (item.title === "Applications" && canViewApplications) ||
                      (item.title === "Contracts" && canViewContracts) ||
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

                                    {inactiveGroups.length > 0 && (
                                      <>
                                        <li className="list-none px-0 pt-4">
                                          <ApplicationNavSectionHeader
                                            kind="inactive"
                                            count={inactiveGroups.length}
                                          />
                                        </li>
                                        {inactiveGroups.map((g) => {
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
                                                  {g.pendingActionCount > 0 && (
                                                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-xs font-medium tabular-nums text-muted-foreground">
                                                      {g.pendingActionCount}
                                                    </span>
                                                  )}
                                                </Link>
                                              </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                          );
                                        })}
                                      </>
                                    )}
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
            </>
          ) : null}
        </SidebarGroup>

        <SidebarGroup>
          {hasVisibleFinanceNav ? (
            <>
              <SidebarGroupLabel>Finance</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navFinance.map((item) => {
                    const canShow =
                      (item.title === "Bucket Balances" && canViewBucketBalances) ||
                      (item.title === "Repayments" && canViewRepayments) ||
                      (item.title === "Service Fee" && canViewServiceFee) ||
                      (item.title === "Issuer Payouts" && canViewDisbursements);

                    if (!canShow) return null;

                    const Icon = item.icon;
                    const badgeCount = "badgeKey" in item && item.badgeKey ? badges[item.badgeKey] : 0;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
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
            </>
          ) : null}
        </SidebarGroup>

        <SidebarGroup>
          {hasVisiblePlatformNav ? (
            <>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navPlatform.map((item) => {
                    const Icon = item.icon;

                    if (item.items) {
                      const filteredSettingsItems = item.items.filter(
                        (subItem) =>
                          (subItem.url !== "/settings/roles" || canViewRoles) &&
                          (subItem.url !== "/settings/notifications" || canViewNotifications) &&
                          (subItem.url !== "/settings/products" || canViewProducts) &&
                          (subItem.url !== "/settings/platform-finance" || canViewPlatformFinance) &&
                          (subItem.url !== "/settings/general" || canViewPlatformFinance) &&
                          (subItem.url !== "/settings/security" || canViewPlatformFinance)
                      );

                      if (filteredSettingsItems.length === 0) return null;

                      return (
                        <Collapsible
                          key={item.title}
                          asChild
                          defaultOpen={pathname.startsWith("/settings")}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton tooltip={item.title}>
                                <Icon className="h-4 w-4" />
                                <span>{item.title}</span>
                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {filteredSettingsItems.map((subItem) => (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                      <Link href={subItem.url}>
                                        <span>{subItem.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    const canShow =
                      (item.title === "Users" && canViewUsers) ||
                      (item.title === "Organizations" && canViewOrganizations) ||
                      (item.title === "Documents" && canViewDocuments);

                    if (!canShow && item.title !== "Help") return null;

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
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
            </>
          ) : null}
        </SidebarGroup>

        <SidebarGroup>
          {hasVisibleAuditNav ? (
            <>
              <SidebarGroupLabel>Audit</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navAudit.map((item) => {
                    const canShow =
                      (item.url === "/audit/access-logs" && canViewAuditAccess) ||
                      (item.url === "/audit/security-logs" && canViewAuditSecurity) ||
                      (item.url === "/audit/document-logs" && canViewAuditDocument) ||
                      (item.url === "/audit/product-logs" && canViewAuditProduct);

                    if (!canShow) return null;

                    const Icon = item.icon;
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
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          ) : null}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        <div className="group-data-[collapsible=icon]:hidden">
          <Separator className="my-2" />
          <CashSoukSidebarFooter variant="admin" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
