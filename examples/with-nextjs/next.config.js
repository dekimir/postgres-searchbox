const { IgnorePlugin } = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We may have multiple examples in the future, with an index page
  //  that lists them. For now, we just redirect root to /movies.
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
  // This is here because pg-native is not compatible with webpack relative imports
  //  like '../../build' during local development of postgres-searchbox.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(new IgnorePlugin({ resourceRegExp: /^pg-native$/ }));
    }
    return config;
  },
};

module.exports = nextConfig;
