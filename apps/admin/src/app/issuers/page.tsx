"use client";

import { OrganizationsPortalListPage } from "../../components/organizations-portal-list-page";
import { RequirePermission } from "../../components/require-permission";

export default function IssuersPage() {
  return (
    <RequirePermission permission="organizations.view">
      <OrganizationsPortalListPage portal="issuer" />
    </RequirePermission>
  );
}
