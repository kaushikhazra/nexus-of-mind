module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/client/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'client/src/**/*.ts',
    '!client/src/**/*.d.ts',
  ],
  moduleNameMapper: {
    '^@babylonjs/core$': '<rootDir>/jest.babylon-mock.js',
    '^@babylonjs/gui$': '<rootDir>/jest.babylon-gui-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@babylonjs)/)'
  ]
};