import type { Notification } from "@prisma/client";
import { logger } from "../../lib/logger";
import type { NotificationPayloads, NotificationTypeId } from "./registry";

export type TypedSender = {
  sendTyped<T extends NotificationTypeId>(
    userId: string,
    typeId: T,
    payload: NotificationPayloads[T],
    idempotencyKey?: string
  ): Promise<Notification | null>;
};

/**
 * Per-recipient send that never throws, so a single failure cannot drop the batch log.
 */
export async function sendTypedSafe<T extends NotificationTypeId>(
  svc: TypedSender,
  userId: string,
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyKey?: string
): Promise<Notification | null> {
  try {
    return await svc.sendTyped(userId, typeId, payload, idempotencyKey);
  } catch (error) {
    logger.error({ error, userId, typeId }, "Failed to send typed notification to user");
    return null;
  }
}

export async function sendTypedToUsersSafe<T extends NotificationTypeId>(
  svc: TypedSender,
  userIds: string[],
  typeId: T,
  payload: NotificationPayloads[T],
  idempotencyKeyForUser: (userId: string) => string
): Promise<Array<Notification | null>> {
  return Promise.all(
    userIds.map((userId) =>
      sendTypedSafe(svc, userId, typeId, payload, idempotencyKeyForUser(userId))
    )
  );
}
