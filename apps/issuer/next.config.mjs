import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(/* turbopackIgnore: true */ __dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://static.cloudflareinsights.com http://localhost:3001 blob:",
              "style-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://api.cashsouk.com https://*.s3.ap-southeast-5.amazonaws.com https://*.truestack.my http://localhost:4000 http://localhost:3000 http://localhost:3001 ws://localhost:3001 wss://*.truestack.my",
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
