/**
 * SECTION: Sample Page 2 Paymaster Track Record inputs for Stage 3 preview
 * WHY: Supply unsupported Canva-like values; builder must still return DNA for all metrics
 */

import { buildProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record";
import type {
  ProspectusPaymasterTrackRecord,
  ProspectusPaymasterTrackRecordInput,
} from "./prospectus-paymaster-track-record.types";

/**
 * Deliberately includes Canva-sample-like and issuer-metric observations.
 * None become Canva-facing values.
 */
export const SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD_INPUT: ProspectusPaymasterTrackRecordInput =
  {
    paymasterSnapshot: {
      name: "Kementerian Kerja Raya (KKR)",
      entity_type: "Federal Government Agency",
      ssm_number: "1234567890",
    },
    currentNoteId: "note-current",
    invoicePaidCount: 103,
    noteCount: 12,
    fundedAmount: 150_000_000,
    targetAmount: 160_000_000,
    invoiceFaceValue: 625_000,
    paymentTotal: 150_000_000,
    issuerRepaidCount: 10,
    issuerArrearsCount: 0,
    issuerDefaultedCount: 0,
    issuerSuccessfulRepaymentPercent: 100,
    issuerOnTimePaymentPercent: 94,
    invoiceDueDate: "2025-09-12T00:00:00.000Z",
    paymentReceivedDate: "2025-12-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
    repaidAt: "2025-12-15T00:00:00.000Z",
    matchingPaymasterNameRows: [
      { name: "Kementerian Kerja Raya (KKR)", ssmNumber: "1234567890" },
      { name: "Kementerian Kerja Raya (KKR)", ssmNumber: "1234567890" },
    ],
  };

export const SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD: ProspectusPaymasterTrackRecord =
  buildProspectusPaymasterTrackRecord(SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD_INPUT);
