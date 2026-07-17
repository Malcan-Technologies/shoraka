/**
 * SECTION: Sample Issuer Track-Record Summary for Stage 7 preview
 * WHY: Identity source documented; metrics unavailable until prospectus rules exist
 */

import { buildProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record";
import type {
  ProspectusIssuerTrackRecord,
  ProspectusIssuerTrackRecordInput,
} from "./prospectus-issuer-track-record.types";

export const SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT: ProspectusIssuerTrackRecordInput = {};

export const SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD: ProspectusIssuerTrackRecord =
  buildProspectusIssuerTrackRecord(SAMPLE_PROSPECTUS_ISSUER_TRACK_RECORD_INPUT);
