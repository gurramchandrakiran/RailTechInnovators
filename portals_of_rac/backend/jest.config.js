module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'services/**/*.js',
        'controllers/**/*.js',
        'utils/**/*.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['./__tests__/setup.js'],
    modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
    forceExit: true,
    detectOpenHandles: false
};
