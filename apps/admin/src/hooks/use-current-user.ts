"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { UserRole } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: UserRole[];
  investor_onboarding_completed: boolean;
  issuer_onboarding_completed: boolean;
  admin: { status: string } | null;
}

interface MeResponse {
  user: CurrentUser;
  activeRole: string | null;
  sessions: {
    active: number;
  };
}

export const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const;

/**
 * Centralized hook for fetching the current user.
 * Uses React Query for automatic deduplication, caching, and stale-while-revalidate.
 * All components needing user data should use this hook instead of making direct API calls.
 */
export function useCurrentUser() {
  const { getAccessToken } = useAuthToken();

  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const result = await apiClient.get<MeResponse>("/v1/auth/me");

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to invalidate the current user cache.
 * Use this after profile updates or role changes.
 */
export function useInvalidateCurrentUser() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
  };
}
