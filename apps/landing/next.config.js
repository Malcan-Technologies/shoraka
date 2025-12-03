/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@cashsouk/ui', '@cashsouk/styles', '@cashsouk/types', '@cashsouk/config', '@cashsouk/icons'],
  experimental: {
    optimizePackageImports: ['@cashsouk/ui'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazoncognito.com blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.amazoncognito.com https://api.cashsouk.com",
              "frame-src 'self' https://*.amazoncognito.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

