import * as pino from 'pino'

// 👇 On isole le cache Node.js pour pouvoir forcer NODE_ENV
jest.resetModules()

describe('logger (utils/logger.ts)', () => {
  let mockPino: jest.Mock
  let infoSpy: jest.Mock, errorSpy: jest.Mock

  beforeEach(() => {
    infoSpy = jest.fn()
    errorSpy = jest.fn()

    mockPino = jest.fn(() => ({
      info: infoSpy,
      error: errorSpy
    }))

    jest.mock('pino', () => mockPino)
  })

  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('utilise pino avec transport pretty en développement', () => {
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL = 'debug'

    const logger = require('../../src/utils/logger').default

    expect(mockPino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        transport: expect.objectContaining({
          target: 'pino-pretty'
        })
      })
    )

    logger.info('test log')
    expect(infoSpy).toHaveBeenCalledWith('test log')
  })
})
