import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { CreateApplicationLogParams } from "./types";
import * as repository from "./repository";
import { attachApplicationLogDisplayReferences } from "./attach-display-references";

/**
 * Application timeline writer.
 *
 * When `db` is the caller's transaction client, a failed insert must abort that
 * transaction so state and evidence cannot diverge. Sequential callers (no `db`)
 * keep the origin/main overlay behaviour: the write is attempted, then logged, and
 * does not fail the already-committed business mutation.
 */
export async function logApplicationActivity(
  params: CreateApplicationLogParams,
  db?: Prisma.TransactionClient | typeof prisma
) {
  const client = db ?? prisma;
  let next = params;
  try {
    next = await attachApplicationLogDisplayReferences(params, client);
  } catch {
    next = params;
  }
  try {
    await repository.createApplicationLog(next, db);
  } catch (error) {
    if (db) {
      throw error;
    }
    console.error("Failed to log application activity", error);
  }
}
