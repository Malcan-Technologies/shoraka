/// <reference lib="dom" />

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error: unknown }) => void) => void;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: string;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  callback_url: string;
  redirect: boolean;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  config?: {
    display?: {
      blocks?: Record<
        string,
        {
          name: string;
          instruments: Array<{ method: string }>;
        }
      >;
      sequence?: string[];
      preferences?: { show_default_blocks?: boolean };
    };
  };
  modal?: {
    ondismiss?: () => void;
  };
};

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

function waitForRazorpay(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const poll = () => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Curlec checkout failed to load"));
        return;
      }
      window.setTimeout(poll, 50);
    };

    poll();
  });
}

function loadCurlecCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Curlec checkout is only available in the browser"));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);

      if (existing && window.Razorpay) {
        resolve();
        return;
      }

      if (existing) {
        existing.remove();
      }

      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        void waitForRazorpay()
          .then(resolve)
          .catch(reject);
      };
      script.onerror = () => {
        script.remove();
        scriptPromise = null;
        reject(new Error("Failed to load Curlec checkout"));
      };
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export type OpenCurlecFpxCheckoutInput = {
  keyId: string;
  orderId: string;
  amountMyr: number;
  callbackUrl: string;
  description?: string;
  prefillName?: string;
  prefillEmail: string;
  prefillContact: string;
  onDismiss?: () => void;
};

/**
 * Curlec Standard Checkout (official web integration).
 * Opens as an overlay modal; FPX bank step redirects away, then returns via callback_url.
 */
export async function openCurlecFpxCheckout(input: OpenCurlecFpxCheckoutInput): Promise<void> {
  await loadCurlecCheckoutScript();

  if (!window.Razorpay) {
    throw new Error("Curlec checkout failed to initialize");
  }

  const amountSen = Math.round(input.amountMyr * 100);

  const checkout = new window.Razorpay({
    key: input.keyId,
    amount: String(amountSen),
    currency: "MYR",
    name: "CashSouk",
    description: input.description ?? "Payment",
    order_id: input.orderId,
    callback_url: input.callbackUrl,
    redirect: true,
    prefill: {
      name: input.prefillName,
      email: input.prefillEmail,
      contact: input.prefillContact,
    },
    config: {
      display: {
        blocks: {
          banks: {
            name: "Pay via FPX",
            instruments: [{ method: "fpx" }],
          },
        },
        sequence: ["block.banks"],
        preferences: { show_default_blocks: false },
      },
    },
    modal: {
      ondismiss: input.onDismiss,
    },
  });

  checkout.open();
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function isLocalOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveLocalHttpOrigin(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const { hostname, port } = window.location;
  return port ? `http://${hostname}:${port}` : `http://${hostname}`;
}

export function resolvePortalOrigin(configuredUrl?: string): string {
  const configured = configuredUrl?.trim();
  if (configured) {
    const configuredOrigin = normalizeOrigin(configured);
    if (isLocalOrigin(configuredOrigin)) {
      return configuredOrigin.replace(/^https:\/\//, "http://");
    }
    return configuredOrigin;
  }

  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const currentOrigin = normalizeOrigin(window.location.origin);

  // Next.js local dev is HTTP-only; https://localhost callbacks fail after FPX redirect.
  if (isLocalOrigin(currentOrigin)) {
    return resolveLocalHttpOrigin();
  }

  return currentOrigin;
}

export function buildGatewayCallbackUrl(input: {
  portalOrigin: string;
  callbackPath: string;
  paymentId: string;
  paymentIdParam?: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams({
    [input.paymentIdParam ?? "paymentId"]: input.paymentId,
  });
  if (input.returnTo) {
    params.set("returnTo", input.returnTo);
  }
  return `${input.portalOrigin}${input.callbackPath}?${params.toString()}`;
}

export function buildDepositCallbackUrl(
  depositId: string,
  returnTo?: string,
  portalOrigin?: string
): string {
  const origin =
    portalOrigin ??
    resolvePortalOrigin(process.env.NEXT_PUBLIC_INVESTOR_URL?.trim());

  return buildGatewayCallbackUrl({
    portalOrigin: origin,
    callbackPath: "/deposits/callback",
    paymentId: depositId,
    paymentIdParam: "depositId",
    returnTo,
  });
}

export function buildIssuerOnboardingFeeCallbackUrl(
  onboardingFeeId: string,
  returnTo?: string,
  portalOrigin?: string
): string {
  const origin =
    portalOrigin ??
    resolvePortalOrigin(process.env.NEXT_PUBLIC_ISSUER_URL?.trim());

  return buildGatewayCallbackUrl({
    portalOrigin: origin,
    callbackPath: "/onboarding-fee/callback",
    paymentId: onboardingFeeId,
    paymentIdParam: "onboardingFeeId",
    returnTo,
  });
}

export function buildApplicationProcessingFeeCallbackUrl(
  feePaymentId: string,
  returnTo?: string,
  portalOrigin?: string
): string {
  const origin =
    portalOrigin ??
    resolvePortalOrigin(process.env.NEXT_PUBLIC_ISSUER_URL?.trim());

  return buildGatewayCallbackUrl({
    portalOrigin: origin,
    callbackPath: "/applications/processing-fee/callback",
    paymentId: feePaymentId,
    paymentIdParam: "processingFeeId",
    returnTo,
  });
}
