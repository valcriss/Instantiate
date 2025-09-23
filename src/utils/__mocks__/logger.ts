const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  flush: jest.fn(),
  removeAllListeners: jest.fn()
}

export const closeLogger = jest.fn()

export default mockLogger
