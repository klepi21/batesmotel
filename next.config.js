/** @type {import('next').NextConfig} */
const nextConfig = {
  // distDir: 'build', // Removed custom distDir for Vercel compatibility
  transpilePackages: ['@multiversx/sdk-dapp-ui'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding', {
      bufferutil: 'bufferutil',
      'utf-8-validate': 'utf-8-validate'
    });

    return config;
  }
};

module.exports = nextConfig;
