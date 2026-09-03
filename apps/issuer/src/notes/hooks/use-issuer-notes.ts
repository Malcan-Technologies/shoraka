import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  IssuerPaymentEvidenceUploadUrlRequest,
  RecordNotePaymentInput,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type IssuerNotePaymentInput = RecordNotePaymentInput;

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

export function useViewIssuerShorakaCertificate(noteId: string | null) {
  const apiClient = useIssuerNotesApiClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerShorakaCertificateViewUrl(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useIssuerInvestmentNoteCertificate(noteId?: string) {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: [...issuerNotesKeys.detail(noteId), "investment-note-certificate"] as const,
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerInvestmentNoteCertificate(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useViewIssuerInvestmentNoteCertificate(noteId: string | null) {
  const apiClient = useIssuerNotesApiClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerInvestmentNoteCertificate(noteId);
      if (!response.success) throw new Error(response.error.message);
      if (!response.data.viewUrl) throw new Error("Investment Note Certificate is not available");
      return response.data;
    },
  });
}

export function useDownloadIssuerInvestmentNoteCertificate(noteId: string | null) {
  const apiClient = useIssuerNotesApiClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerInvestmentNoteCertificate(noteId);
      if (!response.success) throw new Error(response.error.message);
      if (!response.data.downloadUrl) {
        throw new Error("Investment Note Certificate is not available");
      }
      return response.data;
    },
  });
}

export function useIssuerSettlementHibahReceipt(noteId?: string) {
  const apiClient = useIssuerNotesApiClient();
  return useQuery({
    queryKey: [...issuerNotesKeys.detail(noteId), "settlement-hibah-receipt"] as const,
    enabled: Boolean(noteId),
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 5000 : false),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerSettlementHibahReceipt(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useViewIssuerSettlementHibahReceipt(noteId: string | null) {
  const apiClient = useIssuerNotesApiClient();
  return useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getIssuerSettlementHibahReceipt(noteId);
      if (!response.success) throw new Error(response.error.message);
      if (!response.data.viewUrl) throw new Error("Settlement & Hibah Receipt is not available");
      return response.data;
    },
  });
}

export function useSubmitIssuerPayment(noteId: string) {
  const apiClient = useIssuerNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssuerNotePaymentInput) => {
      const response = await apiClient.submitIssuerPaymentOnBehalfOfPaymaster(noteId, input);
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

export function useIssuerPaymentEvidenceUploadUrl(noteId: string) {
  const apiClient = useIssuerNotesApiClient();
  return useMutation({
    mutationFn: async (input: IssuerPaymentEvidenceUploadUrlRequest) => {
      const response = await apiClient.requestIssuerPaymentEvidenceUploadUrl(noteId, input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

