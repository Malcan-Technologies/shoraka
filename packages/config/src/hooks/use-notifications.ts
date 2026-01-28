import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { createApiClient } from "../api-client";
import { useAuthToken } from "../auth-context";

export function useNotifications(options: { limit?: number; offset?: number; read?: boolean } = {}) {
  const { limit = 15, offset = 0, read } = options;
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(undefined, getAccessToken);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["notifications", limit, offset, read],
    queryFn: async () => {
      const response = await apiClient.getNotifications({ limit, offset, read });
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
    pagination: data?.pagination,
    total: data?.pagination?.total ?? 0,
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

export function useAdminNotifications(options: { limit?: number; offset?: number } = {}) {
  const { limit = 20, offset = 0 } = options;
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(undefined, getAccessToken);

  const { data: types, isLoading: isLoadingTypes } = useQuery({
    queryKey: ["admin-notification-types"],
    queryFn: async () => {
      const response = await apiClient.getAdminNotificationTypes();
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!getAccessToken,
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateAdminNotificationType(id, data);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-types"] });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.sendAdminNotification(data);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
  });

  const { data: groups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["admin-notification-groups"],
    queryFn: async () => {
      const response = await apiClient.getAdminNotificationGroups();
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!getAccessToken,
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; userIds: string[] }) => {
      const response = await apiClient.createAdminNotificationGroup(data);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-groups"] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateAdminNotificationGroup(id, data);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-groups"] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteAdminNotificationGroup(id);
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-groups"] });
    },
  });

  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin-notification-logs", limit, offset],
    queryFn: async () => {
      const response = await apiClient.getAdminNotificationLogs({ limit, offset });
      if ("error" in response) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!getAccessToken,
  });

  return {
    types: types ?? [],
    isLoadingTypes,
    updateType: updateTypeMutation.mutate,
    sendNotification: sendNotificationMutation.mutate,
    isSending: sendNotificationMutation.isPending,
    groups: groups ?? [],
    isLoadingGroups,
    createGroup: createGroupMutation.mutate,
    isCreatingGroup: createGroupMutation.isPending,
    updateGroup: updateGroupMutation.mutate,
    deleteGroup: deleteGroupMutation.mutate,
    logs: logsData?.items ?? [],
    paginationLogs: logsData?.pagination,
    isLoadingLogs,
  };
}
