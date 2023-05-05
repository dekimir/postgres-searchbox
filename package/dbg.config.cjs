/**
 * This is the config file for
 * [dts-bundle-generator](https://github.com/timocov/dts-bundle-generator)
 *
 * In this project dts is the last step in the build process.
 * Before this step, tsc is run to compile js to the build folder.
 * tsc also adds type decorations (.d.ts) to the build folder.
 * but, tsc does not inline dependeny types.
 *
 * client and handler argements depend heavily on types exported by the
 * @algolia/client-search package.
 *
 * In order to have type suggestions to the end developer, we could include
 * @algolia/client-search as a dependency.
 * Or use bundle them inline when this package is published to npm.
 * Bundling is the most effective choice for keeping the package size low.
 */

const config = {
  entries: [
    {
      filePath: './src/bundle.types.ts',
      outFile: './build/bundle.types.d.ts',
      output: {
        exportReferencedTypes: false,
      },
      libraries: {
        inlinedLibraries: ['@algolia/client-search'],
      },
    },
  ],
};

module.exports = config;
