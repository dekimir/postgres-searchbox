// This is here because pg-native is not compatible with webpack
// Webpack is used in the examples/with-nextjs
// it looks for this module (pg-native) even though it is not used
// This dummy module is a workaround for this issue:
// https://github.com/brianc/node-postgres/issues/838
module.exports = null;
