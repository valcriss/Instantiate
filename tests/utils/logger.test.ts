import * as pino from 'pino'

// 👇 On isole le cache Node.js pour pouvoir forcer NODE_ENV
jest.resetModules()

describe('logger (utils/logger.ts)', () => {
  let mockPino: jest.Mock
  let infoSpy: jest.Mock, errorSpy: jest.Mock
  let flushSpy: jest.Mock, removeListenersSpy: jest.Mock

  beforeEach(() => {
    infoSpy = jest.fn()
    errorSpy = jest.fn()
    flushSpy = jest.fn()
    removeListenersSpy = jest.fn()

    mockPino = jest.fn(() => ({
      info: infoSpy,
      error: errorSpy,
      flush: flushSpy,
      removeAllListeners: removeListenersSpy
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

  it('omits transport in test environment', () => {
    process.env.NODE_ENV = 'test'
    const logger = require('../../src/utils/logger').default

    expect(mockPino.mock.calls[0][0]).not.toHaveProperty('transport')

    logger.error('boom')
    expect(errorSpy).toHaveBeenCalledWith('boom')
  })

  it('flushes and removes listeners when closeLogger is called', () => {
    process.env.NODE_ENV = 'development'
    const { closeLogger } = require('../../src/utils/logger')
    closeLogger()
    expect(flushSpy).toHaveBeenCalled()
    expect(removeListenersSpy).toHaveBeenCalled()
  })

  it('handles logger without flush method', () => {
    jest.resetModules()
    mockPino.mockReturnValue({ info: infoSpy, error: errorSpy })
    const { closeLogger } = require('../../src/utils/logger')
    expect(() => closeLogger()).not.toThrow()
  })

  it('calls transport.end when available', () => {
    jest.resetModules()
    const endSpy = jest.fn()
    mockPino.mockReturnValue({
      info: infoSpy,
      error: errorSpy,
      flush: flushSpy,
      removeAllListeners: removeListenersSpy,
      transport: { end: endSpy }
    })
    process.env.NODE_ENV = 'development'
    const { closeLogger } = require('../../src/utils/logger')
    closeLogger()
    expect(endSpy).toHaveBeenCalled()
  })
})
