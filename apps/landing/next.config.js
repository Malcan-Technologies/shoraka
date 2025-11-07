/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@shoraka/ui', '@shoraka/styles', '@shoraka/types', '@shoraka/config', '@shoraka/icons'],
  experimental: {
    optimizePackageImports: ['@shoraka/ui'],
  },
};

module.exports = nextConfig;

