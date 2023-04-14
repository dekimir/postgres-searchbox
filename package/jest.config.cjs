module.exports = {
  testMatch: [
    '<rootDir>/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/*.test.{ts,tsx,js,jsx}',
  ],
  collectCoverage: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
