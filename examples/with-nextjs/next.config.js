/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // For now, redirect root to /movies
        source: '/',
        destination: '/movies',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
