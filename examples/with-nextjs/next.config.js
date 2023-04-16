const { IgnorePlugin } = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
