import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { RecordNotePaymentInput } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type IssuerNotePaymentInput = Omit<RecordNotePaymentInput, "source"> & {
  metadata?: Record<string, unknown> | null;
};

export const issuerNotesKeys = {
  all: ["issuer-notes"] as const,
  detail: (id?: string) => [...issuerNotesKeys.all, "detail", id] as const,
  instructions: (id?: string) => [...issuerNotesKeys.all, "instructions", id] as const,
  ledger: (id?: string) => [...issuerNotesKeys.all, "ledger", id] as const,
};

function useIssuerNotesApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useIssuerNotes() {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: issuerNotesKeys.all,
    queryFn: async () => {
      const response = await apiClient.getIssuerNotes();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useIssuerNote(id?: string) {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: issuerNotesKeys.detail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerNote(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useIssuerNotePaymentInstructions(id?: string) {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: issuerNotesKeys.instructions(id),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerNotePaymentInstructions(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useIssuerNoteLedger(id?: string) {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: issuerNotesKeys.ledger(id),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerNoteLedger(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useSubmitIssuerPayment(noteId: string) {
  const apiClient = useIssuerNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssuerNotePaymentInput) => {
      const response = await apiClient.submitIssuerPaymentOnBehalfOfPaymaster(noteId, {
        ...input,
        source: "ISSUER_ON_BEHALF" as RecordNotePaymentInput["source"],
      } as RecordNotePaymentInput);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuerNotesKeys.all });
      queryClient.invalidateQueries({ queryKey: issuerNotesKeys.detail(noteId) });
      queryClient.invalidateQueries({ queryKey: issuerNotesKeys.ledger(noteId) });
    },
  });
}

