"use client";

/**
 * Check for pending invitation token and redirect if found
 * Call this after successful authentication
 * 
 * This handles the case where a user clicks an invitation link but needs to
 * sign up or sign in first. The token is stored before auth redirect and
 * retrieved after authentication completes.
 */
export function checkAndRedirectForPendingInvitation(): boolean {
  if (typeof window === "undefined") return false;

  const pendingToken = localStorage.getItem("pending_invitation_token");
  
  if (pendingToken) {
    console.log("[Invitation] Found pending token, redirecting to accept-invitation");
    
    // Clear the token first to prevent loops
    localStorage.removeItem("pending_invitation_token");
    
    // Redirect to accept-invitation with the token
    window.location.href = `/accept-invitation?token=${pendingToken}`;
    return true; // Indicates a redirect is happening
  }
  
  return false; // No pending invitation
}
