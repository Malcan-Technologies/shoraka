import type { SupportChatIdentity } from "@cashsouk/types";

export type PlainCustomerDetails = {
  email: string;
  emailHash: string;
  fullName?: string;
  shortName?: string;
};

export type PlainInitLink = {
  icon: "book";
  text: string;
  url: string;
};

export type PlainInitConfig = {
  appId: string;
  links: PlainInitLink[];
  theme: "light";
  customerDetails?: PlainCustomerDetails;
};

export type PlainChatApi = {
  init(config: PlainInitConfig): void;
  update(config: PlainInitConfig): void;
  setCustomerDetails(details: PlainCustomerDetails): void;
  isInitialized(): boolean;
  open(): void;
  close(): void;
};

declare global {
  interface Window {
    Plain?: PlainChatApi;
  }
}

export function toPlainCustomerDetails(customer: SupportChatIdentity): PlainCustomerDetails {
  const details: PlainCustomerDetails = {
    email: customer.email,
    emailHash: customer.emailHash,
  };
  if (customer.fullName) details.fullName = customer.fullName;
  if (customer.shortName) details.shortName = customer.shortName;
  return details;
}

export function buildPlainInitConfig(input: {
  appId: string;
  helpCenterUrl: string;
  customer?: SupportChatIdentity | null;
}): PlainInitConfig {
  const config: PlainInitConfig = {
    appId: input.appId,
    links: [{ icon: "book", text: "Help Center", url: input.helpCenterUrl }],
    theme: "light",
  };
  if (input.customer) {
    config.customerDetails = toPlainCustomerDetails(input.customer);
  }
  return config;
}

export type PlainSyncAction =
  | { type: "skip" }
  | { type: "init"; config: PlainInitConfig }
  | { type: "identify"; details: PlainCustomerDetails };

export function nextPlainSyncAction(input: {
  appId: string | undefined;
  helpCenterUrl: string;
  customer?: SupportChatIdentity | null;
  hasApi: boolean;
  alreadyInitialized: boolean;
}): PlainSyncAction {
  if (!input.appId || !input.hasApi) {
    return { type: "skip" };
  }
  if (input.alreadyInitialized) {
    return input.customer
      ? { type: "identify", details: toPlainCustomerDetails(input.customer) }
      : { type: "skip" };
  }
  return {
    type: "init",
    config: buildPlainInitConfig({
      appId: input.appId,
      helpCenterUrl: input.helpCenterUrl,
      customer: input.customer,
    }),
  };
}

export const PLAIN_CHAT_AUTO_OPEN_KEY = "plain-chat-auto-opened";

export function shouldAutoOpenPlainChat(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(PLAIN_CHAT_AUTO_OPEN_KEY) !== "1";
}

export function markPlainChatAutoOpened(storage: Pick<Storage, "setItem">): void {
  storage.setItem(PLAIN_CHAT_AUTO_OPEN_KEY, "1");
}
