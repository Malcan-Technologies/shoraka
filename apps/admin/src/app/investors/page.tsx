"use client";

import { OrganizationsPortalListPage } from "../../components/organizations-portal-list-page";
import { RequirePermission } from "../../components/require-permission";

export default function InvestorsPage() {
  return (
    <RequirePermission permission="organizations.view">
      <OrganizationsPortalListPage portal="investor" />
    </RequirePermission>
  );
}
