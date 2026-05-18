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
  const { data: pendingCountData } = usePendingApprovalCount();
  const { data: noteActionCountData } = useNoteActionRequiredCount();
  const { data: pendingRepaymentsData } = usePendingRepayments();
  const { data: pendingIssuerPayoutsData } = usePendingIssuerPayouts();
  const { data: pendingServiceFeeLettersData } = usePendingServiceFeeTrusteeLetters();
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, includeDeleted: true });
  const { data: applicationsForSidebar = [] } = useAdminApplicationsForSidebar();

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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                  <Link href="/">
                    <HomeIcon className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Lifecycle</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dynamicNavLifecycle.map((item) => {
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
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navFinance.map((item) => {
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
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navPlatform.map((item) => {
                const Icon = item.icon;

                if (item.items) {
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
                            {item.items.map((subItem) => (
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
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Audit</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAudit.map((item) => {
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
