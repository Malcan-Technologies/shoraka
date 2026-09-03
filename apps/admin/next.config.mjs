import path from "path";
import { fileURLToPath } from "url";
import { DEV_TUNNEL_ORIGINS } from "../../packages/config/dev-tunnel-origins.cjs";
import { NEXT_DEV_EXPERIMENTAL } from "../../packages/config/next-dev-experimental.cjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(/* turbopackIgnore: true */ __dirname, "../..");

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
    ...NEXT_DEV_EXPERIMENTAL,
  },
  async redirects() {
    return [
      {
        source: "/users",
        destination: "/accounts",
        permanent: true,
      },
      {
        source: "/users/:id",
        destination: "/accounts/:id",
        permanent: true,
      },
      {
        source: "/organizations",
        has: [{ type: "query", key: "tab", value: "investor" }],
        destination: "/investors",
        permanent: true,
      },
      {
        source: "/organizations",
        destination: "/issuers",
        permanent: true,
      },
      {
        source: "/organizations/issuer/:id",
        destination: "/issuers/:id",
        permanent: true,
      },
      {
        source: "/organizations/investor/:id",
        destination: "/investors/:id",
        permanent: true,
      },
      {
        source: "/settings/rmo-profile",
        destination: "/shoraka/profile",
        permanent: true,
      },
    ];
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://static.cloudflareinsights.com blob:",
              "style-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://api.cashsouk.com https://*.s3.ap-southeast-5.amazonaws.com https://*.truestack.my http://localhost:4000 http://localhost:3000",
              "frame-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "form-action 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
