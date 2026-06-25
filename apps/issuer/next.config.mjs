import path from "path";
import { fileURLToPath } from "url";
import { DEV_TUNNEL_ORIGINS } from "../../packages/config/dev-tunnel-origins.cjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(/* turbopackIgnore: true */ __dirname, "../..");

/** Curlec Standard Checkout — checkout.js modal + FPX bank redirect */
const CURLEC_CSP = {
  scripts: "https://checkout.razorpay.com https://*.razorpay.com",
  frames: "https://checkout.razorpay.com https://api.razorpay.com https://*.razorpay.com",
  connect: "https://api.razorpay.com https://*.razorpay.com",
  formAction: "https://api.razorpay.com https://checkout.razorpay.com https:",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: DEV_TUNNEL_ORIGINS,
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@cashsouk/ui",
    "@cashsouk/styles",
    "@cashsouk/types",
    "@cashsouk/config",
    "@cashsouk/help-content",
  ],
  experimental: {
    optimizePackageImports: ["@cashsouk/ui"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://static.cloudflareinsights.com ${CURLEC_CSP.scripts} http://localhost:3001 blob:`,
              "style-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              `connect-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://api.cashsouk.com https://*.s3.ap-southeast-5.amazonaws.com https://*.truestack.my ${CURLEC_CSP.connect} http://localhost:4000 http://localhost:3000 http://localhost:3001 ws://localhost:3001 wss://*.truestack.my`,
              `frame-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com ${CURLEC_CSP.frames}`,
              `form-action 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com ${CURLEC_CSP.formAction}`,
            ].join("; "),
          },
        ],
      },
      {
        source: "/ekyc/capture.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              // SigningCloud SDK returns the console origin dynamically, so connect-src needs broad https access here.
              "connect-src 'self' https: http://localhost:4000 http://localhost:3001 blob:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
