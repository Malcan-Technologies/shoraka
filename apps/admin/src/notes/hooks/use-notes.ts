import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  GetAdminNotesParams,
  RecordNotePaymentInput,
  SettlementPreviewInput,
  UpdateNoteFeaturedInput,
  UpdateNoteDraftInput,
  ShorakaWithdrawalState,
  ShorakaSubmitOrderStateResponse,
} from "@cashsouk/types";
import { adminInvestmentsKeys } from "@/investments/hooks/use-admin-investments";
import { notesKeys } from "../query-keys";

/**
 * Broad invalidation that refreshes everything driven by a note-side mutation:
 * the sidebar/dashboard counts (action-count, pending-repayments, pending-issuer-payouts,
 * pending-service-fee-trustee-letters),
 * the bucket balances, the notes list/detail, and the investments registry. Use this from
 * any mutation that could change a count, bucket balance, or investment status.
 */
function invalidateAdminRegistries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: notesKeys.all });
  queryClient.invalidateQueries({ queryKey: adminInvestmentsKeys.all });
}

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

export function useNoteBucketActivity(accountCode: string | null, page: number, pageSize = 20) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "bucket-balances", accountCode, "activity", page, pageSize],
    queryFn: async () => {
      if (!accountCode) throw new Error("Bucket code is required");
      const response = await apiClient.getAdminNoteBucketActivity(accountCode, { page, pageSize });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled: accountCode != null,
  });
}

export function useNoteActionRequiredCount({ enabled = true }: { enabled?: boolean } = {}) {
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
    enabled,
  });
}

export function usePendingRepayments({ enabled = true }: { enabled?: boolean } = {}) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "pending-repayments"],
    queryFn: async () => {
      const response = await apiClient.getAdminPendingRepayments();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
}

export function usePendingIssuerPayouts({ enabled = true }: { enabled?: boolean } = {}) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "pending-issuer-payouts"],
    queryFn: async () => {
      const response = await apiClient.getAdminPendingIssuerPayouts();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
}

export function usePendingServiceFeeTrusteeLetters({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: [...notesKeys.all, "pending-service-fee-trustee-letters"],
    queryFn: async () => {
      const response = await apiClient.getAdminPendingServiceFeeTrusteeLetters();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
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
    onSuccess: () => invalidateAdminRegistries(queryClient),
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
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function useUpdateNoteFeatured() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateNoteFeaturedInput }) => {
      const response = await apiClient.updateAdminNoteFeatured(id, input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
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
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
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
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
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
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
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
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function useRejectNotePayment() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paymentId,
      reason,
    }: {
      id: string;
      paymentId: string;
      reason?: string | null;
    }) => {
      const response = await apiClient.rejectAdminNotePayment(id, paymentId, { reason });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(variables.id) });
    },
  });
}

export function useGenerateServiceFeeTrusteeLetter() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, settlementId }: { noteId: string; settlementId: string }) => {
      const response = await apiClient.generateAdminNoteServiceFeeTrusteeLetter(
        noteId,
        settlementId
      );
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, { noteId }) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
    },
  });
}

export function useMarkServiceFeeTrusteeLetterSubmitted() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, settlementId }: { noteId: string; settlementId: string }) => {
      const response = await apiClient.markAdminNoteServiceFeeTrusteeLetterSubmitted(
        noteId,
        settlementId
      );
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

export function useMarkServiceFeeTrusteeInstructionCompleted() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, settlementId }: { noteId: string; settlementId: string }) => {
      const response = await apiClient.markAdminNoteServiceFeeTrusteeInstructionCompleted(
        noteId,
        settlementId
      );
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (note) => {
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
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
      invalidateAdminRegistries(queryClient);
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
      invalidateAdminRegistries(queryClient);
      queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
    },
  });
}

function invalidateWithdrawalNote(
  queryClient: ReturnType<typeof useQueryClient>,
  noteId: string | null
) {
  invalidateAdminRegistries(queryClient);
  if (!noteId) return;
  queryClient.invalidateQueries({ queryKey: notesKeys.detail(noteId) });
  queryClient.invalidateQueries({ queryKey: [...notesKeys.detail(noteId), "ledger"] });
}

export function useGenerateWithdrawalLetter() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.generateWithdrawalLetter(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (withdrawal) => {
      invalidateWithdrawalNote(queryClient, withdrawal.noteId);
    },
  });
}

export function useMarkWithdrawalSubmitted() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.markWithdrawalSubmittedToTrustee(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (withdrawal) => {
      invalidateWithdrawalNote(queryClient, withdrawal.noteId);
    },
  });
}

export function useMarkWithdrawalCompleted() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.markWithdrawalCompleted(id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (withdrawal) => {
      invalidateWithdrawalNote(queryClient, withdrawal.noteId);
    },
  });
}

export function useUpdateWithdrawalBeneficiary() {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      beneficiarySnapshot,
    }: {
      id: string;
      beneficiarySnapshot: Record<string, unknown>;
    }) => {
      const response = await apiClient.updateWithdrawalBeneficiary(id, beneficiarySnapshot);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (withdrawal) => {
      invalidateWithdrawalNote(queryClient, withdrawal.noteId);
    },
  });
}

export function useShorakaWithdrawalState(withdrawalId: string | null) {
  const apiClient = useNotesApiClient();
  return useQuery({
    queryKey: ["shoraka", "withdrawal", withdrawalId ?? ""],
    queryFn: async () => {
      if (!withdrawalId) return null;
      const response = await apiClient.getAdminWithdrawalShoraka(withdrawalId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled: Boolean(withdrawalId),
  });
}

export function useSubmitShorakaOrder(withdrawalId: string | null) {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!withdrawalId) throw new Error("Withdrawal id is required");
      const response = await apiClient.submitAdminWithdrawalShorakaSubmitOrder(withdrawalId);
      if (!response.success) throw new Error(response.error.message);
      return response.data as ShorakaSubmitOrderStateResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoraka", "withdrawal", withdrawalId ?? ""] });
    },
  });
}

export function useQueryShorakaStatus(withdrawalId: string | null) {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!withdrawalId) throw new Error("Withdrawal id is required");
      const response = await apiClient.queryAdminWithdrawalShorakaStatus(withdrawalId);
      if (!response.success) throw new Error(response.error.message);
      return response.data as ShorakaWithdrawalState;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoraka", "withdrawal", withdrawalId ?? ""] });
    },
  });
}

export function useFetchShorakaCertificate(withdrawalId: string | null) {
  const apiClient = useNotesApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!withdrawalId) throw new Error("Withdrawal id is required");
      const response = await apiClient.fetchAdminWithdrawalShorakaCertificate(withdrawalId);
      if (!response.success) throw new Error(response.error.message);
      return response.data as ShorakaWithdrawalState;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoraka", "withdrawal", withdrawalId ?? ""] });
    },
  });
}
