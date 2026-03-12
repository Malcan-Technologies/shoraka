export type OfferEventStatus =
  | "OFFER_SENT"
  | "APPROVED"
  | "REJECTED"
  | "AMENDMENT_REQUESTED"
  | "PENDING";

export interface OfferStateEvent {
  eventType: string;
  applicationId: string;
  issuerOrganizationId: string;
  scope: "application" | "section" | "item";
  scopeKey?: string;
  status: OfferEventStatus;
  emittedAt: string;
}

type Listener = (event: OfferStateEvent) => void;

const listeners = new Map<number, Listener>();
let listenerSeq = 0;

export function subscribeOfferStateEvents(listener: Listener): () => void {
  listenerSeq += 1;
  const id = listenerSeq;
  listeners.set(id, listener);
  return () => {
    listeners.delete(id);
  };
}

export function publishOfferStateEvent(event: OfferStateEvent): void {
  for (const listener of listeners.values()) {
    try {
      listener(event);
    } catch {
      // Best-effort event fanout; individual listener errors must not break emitters.
    }
  }
}
