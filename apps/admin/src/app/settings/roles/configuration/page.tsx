"use client";

import { useEffect } from "react";

import { useHeader } from "@cashsouk/ui";

import { AdminPermissionConfiguration } from "../../../../components/admin-permission-configuration";
import { RequirePermission } from "../../../../components/require-permission";

export default function RolesConfigurationPage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle("Role configuration");
    return () => setTitle("");
  }, [setTitle]);

  return (
    <>
      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <RequirePermission permission="roles.view">
          <div className="w-full px-2 md:px-4 py-8">
            <AdminPermissionConfiguration />
          </div>
        </RequirePermission>
      </div>
    </>
  );
}
