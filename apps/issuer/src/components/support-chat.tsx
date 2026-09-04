"use client";

import { createApiClient, HELP_CENTER_URL, useAuthToken } from "@cashsouk/config";
import { PlainChatWidget } from "@cashsouk/ui";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SupportChat() {
  const { getAccessToken } = useAuthToken();
  const { data } = useQuery({
    queryKey: ["support", "chat-identity"],
    queryFn: async () => {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const result = await apiClient.getSupportChatIdentity();
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: Infinity,
    retry: 1,
  });

  return (
    <PlainChatWidget
      appId={process.env.NEXT_PUBLIC_PLAIN_CHAT_APP_ID}
      helpCenterUrl={HELP_CENTER_URL}
      customer={data}
    />
  );
}
