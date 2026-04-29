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
import { useNoteActionRequiredCount } from "@/notes/hooks/use-notes";
import { productName } from "@/app/settings/products/product-utils";
import type { ApplicationListItem, Product } from "@cashsouk/types";

type ApplicationNavGroup = {
  baseKey: string;
  productTitle: string;
  queuePath: string;
  isInactive: boolean;
};

function buildApplicationSidebarGroups(
  products: Product[],
  applications: ApplicationListItem[]
): ApplicationNavGroup[] {
  const byBase = new Map<string, Product[]>();
  for (const p of products) {
    const key = (p.base_id ?? p.id) as string;
    const list = byBase.get(key) ?? [];
    list.push(p);
    byBase.set(key, list);
  }

  const groups: ApplicationNavGroup[] = [];

  for (const [, versions] of byBase) {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const display =
      [...sorted].reverse().find((p) => (p.status ?? "ACTIVE") === "ACTIVE") ?? sorted[sorted.length - 1];
    if (!display) continue;
    const baseKey = (display.base_id ?? display.id) as string;
    const appsFor = applications.filter((a) => (a.baseProductId ?? "") === baseKey);
    const isLive = (display.status ?? "ACTIVE") === "ACTIVE";
    if (!isLive && appsFor.length === 0) continue;

    groups.push({
      baseKey,
      productTitle: productName(display),
      queuePath: `/applications/${baseKey}`,
      isInactive: !isLive,
    });
  }

  const basesBuilt = new Set(groups.map((g) => g.baseKey));
  for (const baseKey of new Set(
    applications.map((a) => a.baseProductId).filter((x): x is string => Boolean(x))
  )) {
    if (basesBuilt.has(baseKey)) continue;
    const appsFor = applications.filter((a) => a.baseProductId === baseKey);
    if (appsFor.length === 0) continue;
    groups.push({
      baseKey,
      productTitle: appsFor[0]?.financingTypeLabel ?? "Product",
      queuePath: `/applications/${baseKey}`,
      isInactive: true,
    });
  }

  return groups.sort((a, b) => a.productTitle.localeCompare(b.productTitle));
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
    title: "Bucket Balances",
    url: "/finance/buckets",
    icon: BanknotesIcon,
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
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, includeDeleted: true });
  const { data: applicationsForSidebar = [] } = useAdminApplicationsForSidebar();

  // Build badges dynamically
  const badges: Record<string, number> = {
    onboardingApproval: pendingCountData?.count || 0,
    noteActions: noteActionCountData?.count || 0,
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
                const badgeCount =
                  "badgeKey" in item && item.badgeKey ? badges[item.badgeKey] : 0;

                if (item.title === "Applications" && "applicationNavGroups" in item) {
                  const groups = item.applicationNavGroups ?? [];
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
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {groups.map((g) => (
                              <SidebarMenuSubItem key={g.baseKey}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={
                                    pathname === g.queuePath || pathname.startsWith(`${g.queuePath}/`)
                                  }
                                  className="font-medium h-auto min-h-7 flex-col items-stretch gap-0.5 py-1.5 whitespace-normal"
                                >
                                  <Link
                                    href={g.queuePath}
                                    title={
                                      g.isInactive
                                        ? `${g.productTitle} (Inactive)`
                                        : g.productTitle
                                    }
                                    className="flex min-w-0 flex-col gap-0.5"
                                  >
                                    <span className="truncate text-sm leading-tight">{g.productTitle}</span>
                                    {g.isInactive ? (
                                      <span className="text-xs font-normal leading-none text-muted-foreground">
                                        Inactive
                                      </span>
                                    ) : null}
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
