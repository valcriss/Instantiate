module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      sourceMaps: 'inline',
      module: {
        type: 'commonjs'
      },
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript'
        }
      }
    }]
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 100,
      branches: 100,
      functions: 100,
      statements: 100
    }
  },
  setupFiles: ['<rootDir>/tests/setupTests.ts'],
  moduleNameMapper: {
    '^node-fetch$': '<rootDir>/tests/__mocks__/node.fetch.ts'
  }
}
