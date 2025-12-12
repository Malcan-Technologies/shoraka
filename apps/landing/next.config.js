/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@cashsouk/ui",
    "@cashsouk/styles",
    "@cashsouk/types",
    "@cashsouk/config",
    "@cashsouk/icons",
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com blob:",
              "style-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https://*.amazoncognito.com https://cognito-idp.ap-southeast-5.amazonaws.com https://*.auth.ap-southeast-5.amazoncognito.com https://auth.cashsouk.com https://api.cashsouk.com http://localhost:4000 http://localhost:3000",
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
