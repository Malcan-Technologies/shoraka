"use client";

import { format } from "date-fns";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { toTitleCase, type PaymasterDetail } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
import { ReadField } from "@/organizations/components/organization-profile-helpers";

export function PaymasterIdentityCard({ paymaster }: { paymaster: PaymasterDetail }) {
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BuildingOffice2Icon}
        title="Company Info"
        description="Legal identity on the Paymaster master"
      />
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadField label="Legal name" value={paymaster.legalName} />
          <ReadField label="Registration Number (SSM)" value={paymaster.registrationNumber} />
          <ReadField label="Country" value={paymaster.registrationCountry} />
          <ReadField label="Entity type" value={paymaster.entityType} />
          <ReadField label="Source" value={paymaster.source ? toTitleCase(paymaster.source) : null} />
          <ReadField
            label="Created"
            value={format(new Date(paymaster.createdAt), "dd MMM yyyy, h:mm a")}
          />
          <ReadField
            label="Updated"
            value={format(new Date(paymaster.updatedAt), "dd MMM yyyy, h:mm a")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
