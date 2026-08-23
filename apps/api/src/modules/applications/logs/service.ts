import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { CreateApplicationLogParams } from "./types";
import * as repository from "./repository";

/**
 * Best-effort activity log. Preserved from origin/main: business flow must never fail because an
 * activity row could not be written.
 *
 * Pass `db` when the caller is inside a transaction that must roll back together with the log.
 */
export async function logApplicationActivity(
  params: CreateApplicationLogParams,
  db?: Prisma.TransactionClient | typeof prisma
) {
  try {
    await repository.createApplicationLog(params, db);
  } catch (error) {
    // never throw; ensure business flow continues
    console.error("Failed to log application activity", error);
  }
}
