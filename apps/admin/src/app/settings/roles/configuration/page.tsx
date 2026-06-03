"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../../components/ui/breadcrumb";
import { Separator } from "../../../../components/ui/separator";
import { SidebarTrigger } from "../../../../components/ui/sidebar";
import { SystemHealthIndicator } from "../../../../components/system-health-indicator";
import { AdminPermissionConfiguration } from "../../../../components/admin-permission-configuration";
import { RequirePermission } from "../../../../components/require-permission";

export default function RolesConfigurationPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Roles</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Configuration</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <RequirePermission permission="roles.manage">
          <div className="w-full px-2 md:px-4 py-8">
            <AdminPermissionConfiguration />
          </div>
        </RequirePermission>
      </div>
    </>
  );
}
