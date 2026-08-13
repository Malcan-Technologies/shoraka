/**
 * Temporary ApplicationLog writer used only by signing/service.ts for SIGNING_PACKAGE_* events.
 * Application, review, contract, and invoice history is ApplicationAuditLog.
 * This helper is removed after SigningAuditLog cutover.
 */
import { CreateApplicationLogParams } from "./types";
import * as repository from "./repository";

export async function logApplicationActivity(params: CreateApplicationLogParams) {
  try {
    await repository.createApplicationLog(params);
  } catch (error) {
    // never throw; ensure business flow continues
    console.error("Failed to log application activity", error);
  }
}

