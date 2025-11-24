/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@cashsouk/ui', '@cashsouk/styles', '@cashsouk/types', '@cashsouk/config'],
  experimental: {
    optimizePackageImports: ['@cashsouk/ui'],
  },
};

module.exports = nextConfig;

