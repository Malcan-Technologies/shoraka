"use client";

import type { SupportChatIdentity } from "@cashsouk/types";
import Script from "next/script";
import { useCallback, useEffect } from "react";
import {
  markPlainChatAutoOpened,
  nextPlainSyncAction,
  shouldAutoOpenPlainChat,
} from "./plain-chat-config";

export type PlainChatWidgetProps = {
  appId: string | undefined;
  helpCenterUrl: string;
  customer?: SupportChatIdentity | null;
};

let didInitPlain = false;

function isPlainInitialized(): boolean {
  return didInitPlain || Boolean(typeof window !== "undefined" && window.Plain?.isInitialized());
}

export function PlainChatWidget({ appId, helpCenterUrl, customer }: PlainChatWidgetProps) {
  const syncPlain = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const action = nextPlainSyncAction({
      appId,
      helpCenterUrl,
      customer,
      hasApi: Boolean(window.Plain),
      alreadyInitialized: isPlainInitialized(),
    });

    if (action.type === "identify") {
      window.Plain?.setCustomerDetails(action.details);
      return;
    }

    if (action.type !== "init" || !window.Plain) {
      return;
    }

    didInitPlain = true;
    try {
      window.Plain.init(action.config);
    } catch {
      // Plain throws if a concurrent onReady/effect already initialized the widget.
    }

    if (shouldAutoOpenPlainChat(window.sessionStorage)) {
      window.Plain.open();
      markPlainChatAutoOpened(window.sessionStorage);
    }
  }, [appId, helpCenterUrl, customer]);

  useEffect(() => {
    if (!appId || typeof window === "undefined") {
      return;
    }

    if (window.Plain) {
      syncPlain();
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.Plain || Date.now() - startedAt > 8000) {
        window.clearInterval(timer);
        syncPlain();
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [appId, syncPlain]);

  if (!appId) return null;

  return (
    <Script
      id="plain-chat-widget"
      src="https://chat.cdn-plain.com/index.js"
      strategy="afterInteractive"
      onReady={syncPlain}
    />
  );
}
