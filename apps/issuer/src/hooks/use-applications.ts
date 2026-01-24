import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateApplicationInput, UpdateApplicationStepInput } from "@cashsouk/types";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplication(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getApplication(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApplicationInput) => {
      const response = await apiClient.createApplication(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });
}

export function useUpdateApplicationStep() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stepData }: { id: string; stepData: UpdateApplicationStepInput }) => {
      const response = await apiClient.updateApplicationStep(id, stepData);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save progress", {
        description: error.message,
      });
    },
  });
}
