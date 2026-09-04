/* eslint-disable @typescript-eslint/no-require-imports -- CJS config cannot import .cjs via ESM syntax */
const { DEV_TUNNEL_ORIGINS } = require("../../packages/config/dev-tunnel-origins.cjs");
const { NEXT_DEV_EXPERIMENTAL } = require("../../packages/config/next-dev-experimental.cjs");
const { PLAIN_CSP } = require("../../packages/config/plain-csp-origins.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: DEV_TUNNEL_ORIGINS,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: [
    "@cashsouk/ui",
    "@cashsouk/styles",
    "@cashsouk/types",
    "@cashsouk/config",
    "@cashsouk/icons",
  ],
  experimental: {
    ...NEXT_DEV_EXPERIMENTAL,
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
              `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://static.cloudflareinsights.com ${PLAIN_CSP.scripts} blob:`,
              `style-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com ${PLAIN_CSP.styles}`,
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              `connect-src 'self' https://*.amazoncognito.com https://cognito-idp.ap-southeast-5.amazonaws.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://api.cashsouk.com https://*.truestack.my http://localhost:4000 http://localhost:3000 ${PLAIN_CSP.connect}`,
              "frame-src 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "form-action 'self' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
