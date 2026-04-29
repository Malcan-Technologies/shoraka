import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  GetAdminNotesParams,
  RecordNotePaymentInput,
  SettlementPreviewInput,
  UpdateNoteDraftInput,
} from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type OverdueLateChargeInput = {
  receiptAmount?: number;
  receiptDate?: string;
};

type AdminRecordNotePaymentInput = RecordNotePaymentInput & {
  metadata?: Record<string, unknown> | null;
};

function useNotesApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export function useNotes(params: GetAdminNotesParams) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: notesKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.getAdminNotes(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useNoteSourceInvoices() {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "source-invoices"],
    queryFn: async () => {
      const response = await apiClient.getAdminNoteSourceInvoices();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useNoteBucketBalances() {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "bucket-balances"],
    queryFn: async () => {
      const response = await apiClient.getAdminNoteBucketBalances();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useNoteActionRequiredCount() {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "action-count"],
    queryFn: async () => {
      const response = await apiClient.getAdminNoteActionRequiredCount();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useCreateNoteFromInvoice() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, title }: { invoiceId: string; title?: string }) => {
      const response = await apiClient.createAdminNoteFromInvoice(invoiceId, { title });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

export function useUpdateNoteDraft() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateNoteDraftInput }) => {
      const response = await apiClient.updateAdminNoteDraft(id, input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function usePublishNote() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.publishAdminNote(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

export function useUnpublishNote() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.unpublishAdminNote(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

function useNoteAction(action: "close" | "fail" | "activate") {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response =
        action === "close"
          ? await apiClient.closeAdminNoteFunding(id)
          : action === "fail"
            ? await apiClient.failAdminNoteFunding(id)
            : await apiClient.activateAdminNote(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKeys.all }),
  });
}

export function useCloseNoteFunding() {
  return useNoteAction("close");
}

export function useFailNoteFunding() {
  return useNoteAction("fail");
}

export function useActivateNote() {
  return useNoteAction("activate");
}

export function useRecordNotePayment() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AdminRecordNotePaymentInput }) => {
      const response = await apiClient.recordAdminNotePayment(id, input as RecordNotePaymentInput);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function useApproveNotePayment() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentId }: { id: string; paymentId: string }) => {
      const response = await apiClient.approveAdminNotePayment(id, paymentId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function useRejectNotePayment() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentId, reason }: { id: string; paymentId: string; reason?: string | null }) => {
      const response = await apiClient.rejectAdminNotePayment(id, paymentId, { reason });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function usePreviewNoteSettlement() {
  const apiClient = useNotesApiClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SettlementPreviewInput }) => {
      const response = await apiClient.previewAdminNoteSettlement(id, input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useApproveNoteSettlement() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, settlementId }: { id: string; settlementId: string }) => {
      const response = await apiClient.approveAdminNoteSettlement(id, settlementId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function usePostNoteSettlement() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, settlementId }: { id: string; settlementId: string }) => {
      const response = await apiClient.postAdminNoteSettlement(id, settlementId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
      queryClient.invalidateQueries({ queryKey: [...notesKeys.detail(note.id), "ledger"] });
    },
  });
}

export function useGenerateArrearsLetter() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.generateAdminNoteArrearsLetter(id);
      if (!response.success) throw new Error(response.error.message);
      return { ...response.data, noteId: id };
    },
    onSuccess: ({ noteId }) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

export function useCheckOverdueLateCharge() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: OverdueLateChargeInput }) => {
      const response = await apiClient.checkAdminNoteOverdueLateCharge(id, input ?? {});
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(variables.id) });
    },
  });
}

export function useGenerateDefaultLetter() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.generateAdminNoteDefaultLetter(id);
      if (!response.success) throw new Error(response.error.message);
      return { ...response.data, noteId: id };
    },
    onSuccess: ({ noteId }) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

export function useMarkNoteDefault() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.markAdminNoteDefault(id, reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

