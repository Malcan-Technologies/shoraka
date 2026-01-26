import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { createApiClient } from "../api-client";
import { useAuthToken } from "../auth-context";

export function useNotifications() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(undefined, getAccessToken);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await apiClient.getNotifications({ limit: 20, offset: 0 });
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!getAccessToken,
  });

  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await apiClient.getUnreadNotificationsCount();
      if ("error" in response) throw new Error(response.error.message);
      return response.data.count;
    },
    enabled: !!getAccessToken,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.markNotificationAsRead(id);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.markAllNotificationsAsRead();
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  // Refetch on tab focus
  useEffect(() => {
    const onFocus = () => {
      refetch();
      refetchUnreadCount();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch, refetchUnreadCount]);

  const refreshNotifications = useCallback(() => {
    refetch();
    refetchUnreadCount();
  }, [refetch, refetchUnreadCount]);

  return {
    notifications: data?.items ?? [],
    total: data?.total ?? 0,
    unreadCount: unreadCountData ?? 0,
    isLoading,
    refreshNotifications,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}

export function useNotificationPreferences() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(undefined, getAccessToken);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const response = await apiClient.getNotificationPreferences();
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!getAccessToken,
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ typeId, data }: { typeId: string; data: { enabled_platform: boolean; enabled_email: boolean } }) => {
      const response = await apiClient.updateNotificationPreference(typeId, data);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  return {
    preferences: preferences ?? [],
    isLoading,
    updatePreference: updatePreferenceMutation.mutate,
  };
}
