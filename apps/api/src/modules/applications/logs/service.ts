/**
 * Legacy ApplicationLog helper. No live writers remain after SigningAuditLog cutover.
 * Table/model cleanup is a separate PR.
 */
import { CreateApplicationLogParams } from "./types";
import * as repository from "./repository";

export async function logApplicationActivity(params: CreateApplicationLogParams) {
  try {
    await repository.createApplicationLog(params);
  } catch (error) {
    console.error("Failed to log application activity", error);
  }
}

