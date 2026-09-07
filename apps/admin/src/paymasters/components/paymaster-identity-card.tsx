"use client";

import * as React from "react";
import { format } from "date-fns";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { isPaymasterVerified, toTitleCase, type PaymasterDetail } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { ReadField } from "@/organizations/components/organization-profile-helpers";
import { PaymasterOfficialIdentityDialog } from "@/paymasters/components/paymaster-official-identity-dialog";

export function PaymasterIdentityCard({
  paymaster,
  canManage,
}: {
  paymaster: PaymasterDetail;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const verified = isPaymasterVerified(paymaster.verificationStatus);
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BuildingOffice2Icon}
        title="Company Info"
        description={
          verified
            ? "Official verified identity for this SSM. This is the Paymaster master, not an application submission."
            : "Admin-managed official identity for this SSM. This identity is not yet verified."
        }
        actions={
          canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-ui"
              onClick={() => setEditOpen(true)}
            >
              Edit Paymaster Details
            </Button>
          ) : null
        }
      />
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadField label="Legal name" value={paymaster.legalName} />
          <ReadField label="Registration Number (SSM)" value={paymaster.registrationNumber} />
          <ReadField label="Country" value={paymaster.registrationCountry} />
          <ReadField label="Entity type" value={paymaster.entityType} />
          <ReadField
            label="Verification status"
            value={
              <StatusBadge
                label={verified ? "Verified" : "Unverified"}
                status={getAdminStatusToken(paymaster.verificationStatus)}
              />
            }
          />
          <ReadField label="Verified by" value={verified ? paymaster.verifiedByName : null} />
          <ReadField
            label="Verified at"
            value={
              verified && paymaster.verifiedAt
                ? format(new Date(paymaster.verifiedAt), "dd MMM yyyy, h:mm a")
                : null
            }
          />
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
      <PaymasterOfficialIdentityDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        paymaster={paymaster}
      />
    </Card>
  );
}
