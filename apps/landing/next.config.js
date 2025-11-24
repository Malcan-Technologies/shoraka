/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@cashsouk/ui', '@cashsouk/styles', '@cashsouk/types', '@cashsouk/config', '@cashsouk/icons'],
  experimental: {
    optimizePackageImports: ['@cashsouk/ui'],
  },
};

module.exports = nextConfig;

