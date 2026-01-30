"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { Button } from "../../components/ui/button";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { NameEntryDialog } from "../../components/name-entry-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuthToken();
  const { refreshOrganizations, switchOrganization } = useOrganization();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const token = searchParams.get("token");
  const [showNameDialog, setShowNameDialog] = React.useState(false);
  const [invitationAccepted, setInvitationAccepted] = React.useState(false);
  const hasAttemptedAcceptance = React.useRef(false);

  // Store token in localStorage before potential auth redirect
  // Note: This runs only if the component mounts (user is authenticated)
  // For unauthenticated users, the URL is preserved in sessionStorage by redirectToLogin()
  React.useEffect(() => {
    if (token && typeof window !== "undefined") {
      localStorage.setItem("pending_invitation_token", token);
      console.log("[Invitation] Stored token for post-auth:", token);
    } else if (!token && typeof window !== "undefined") {
      console.warn("[Invitation] No token in URL. User may have been redirected after auth.");
    }
  }, [token]);

  // Fetch user profile to check if name exists
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const result = await apiClient.get<{
        userId: string;
        user: {
          first_name: string | null;
          last_name: string | null;
        };
      }>("/v1/auth/me");
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: invitationAccepted,
  });

  const acceptMutation = useMutation({
    mutationFn: async (invitationToken: string) => {
      const result = await apiClient.post<{
        success: boolean;
        organizationId: string;
        portalType: string;
      }>("/v1/organizations/invitations/accept", {
        token: invitationToken,
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: async (data) => {
      // Refresh organizations and switch to the new one
      await refreshOrganizations();
      switchOrganization(data.organizationId);
      
      setInvitationAccepted(true);
      toast.success("Invitation accepted successfully!");
    },
    onError: (error: Error) => {
      // If invitation is already accepted, treat it as success
      if (error.message.includes("already been accepted")) {
        setInvitationAccepted(true);
        toast.success("Welcome back! Redirecting...");
      } else {
        toast.error("Failed to accept invitation", { description: error.message });
      }
    },
  });

  // Check if name is missing after invitation is accepted and profile is loaded
  React.useEffect(() => {
    if (invitationAccepted && userProfile) {
      const hasName =
        userProfile.user.first_name && userProfile.user.first_name.trim() &&
        userProfile.user.last_name && userProfile.user.last_name.trim();
      
      if (!hasName) {
        setShowNameDialog(true);
      } else {
        // Name exists, redirect to profile page
        setTimeout(() => {
          router.push("/profile");
        }, 1000);
      }
    }
  }, [invitationAccepted, userProfile, router]);

  const handleNameComplete = () => {
    setShowNameDialog(false);
    // Refetch profile to get updated name, then redirect to profile page
    setTimeout(() => {
      router.push("/profile");
    }, 500);
  };

  React.useEffect(() => {
    if (token && !invitationAccepted && !hasAttemptedAcceptance.current && !acceptMutation.isPending) {
      hasAttemptedAcceptance.current = true;
      acceptMutation.mutate(token);
    }
  }, [token, invitationAccepted, acceptMutation]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <XCircleIcon className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Invitation</h1>
          <p className="text-muted-foreground">No invitation token provided.</p>
          <Button onClick={() => router.push("/profile")}>Go to Profile</Button>
        </div>
      </div>
    );
  }

  if (acceptMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <ArrowPathIcon className="h-12 w-12 text-primary mx-auto animate-spin" />
          <h1 className="text-2xl font-bold">Accepting Invitation</h1>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    );
  }

  if (acceptMutation.isSuccess) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <CheckCircleIcon className="h-12 w-12 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">Invitation Accepted</h1>
            <p className="text-muted-foreground">You have successfully joined the organization.</p>
                {showNameDialog ? (
                  <p className="text-sm text-muted-foreground">Please complete your profile...</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Redirecting to profile...</p>
                )}
          </div>
        </div>
        <NameEntryDialog
          open={showNameDialog}
          onOpenChange={setShowNameDialog}
          onComplete={handleNameComplete}
        />
      </>
    );
  }

  if (acceptMutation.isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <XCircleIcon className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Failed to Accept Invitation</h1>
          <p className="text-muted-foreground">
            {acceptMutation.error instanceof Error
              ? acceptMutation.error.message
              : "An error occurred while accepting the invitation."}
          </p>
          <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return null;
}
