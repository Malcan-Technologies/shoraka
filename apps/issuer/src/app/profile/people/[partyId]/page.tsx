"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { PersonDetailView } from "@cashsouk/ui";
import type { ApplicationPersonRow } from "@cashsouk/types";
import { useAuth } from "../../../../lib/auth";
import { useOrganizationInvitations } from "../../../../hooks/use-organization-invitations";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function IssuerPersonDetailPage() {
  const params = useParams<{ partyId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();
  const { activeOrganization, isLoading } = useOrganization();
  const partyId = params.partyId;

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const result = await apiClient.get<{ userId: string }>("/v1/auth/me");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: orgData } = useQuery({
    queryKey: ["organization-detail", activeOrganization?.id],
    enabled: Boolean(activeOrganization?.id),
    queryFn: async () => {
      const result = await apiClient.get<{
        onboardingStatus?: string;
        people?: ApplicationPersonRow[];
      }>(`/v1/organizations/issuer/${activeOrganization!.id}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const isCurrentUserAdmin = React.useMemo(() => {
    if (!activeOrganization || !currentUser) return false;
    if (activeOrganization.isOwner) return true;
    return activeOrganization.members?.find((member) => member.id === currentUser.userId)?.role === "ORGANIZATION_ADMIN";
  }, [activeOrganization, currentUser]);

  const { invitations } = useOrganizationInvitations(activeOrganization?.id, {
    enabled: isCurrentUserAdmin,
  });

  if (isAuthenticated === null || isLoading || !activeOrganization) {
    return <p className="p-6 text-ui text-muted-foreground">Loading…</p>;
  }

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <div className={cn(issuerContentMaxWidthClassName, "space-y-6")}>
        <PersonDetailView
          portal="issuer"
          organizationId={activeOrganization.id}
          partyId={partyId}
          organizationOnboardingStatus={orgData?.onboardingStatus}
          people={orgData?.people ?? activeOrganization.people ?? []}
          members={activeOrganization.members ?? []}
          invitations={invitations}
          ownerUserId={activeOrganization.ownerId}
          currentUserId={currentUser?.userId}
          canEdit={isCurrentUserAdmin}
          canInactivate={isCurrentUserAdmin}
          onBack={() => router.push("/profile?tab=people")}
          onChanged={async () => {
            await queryClient.invalidateQueries({ queryKey: ["organization-detail", activeOrganization.id] });
            await queryClient.invalidateQueries({ queryKey: ["party-profiles"] });
          }}
        />
      </div>
    </div>
  );
}
