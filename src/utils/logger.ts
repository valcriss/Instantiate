import pino, { type Logger } from 'pino'

const isTest = process.env.NODE_ENV === 'test'

type ExtendedLogger = Logger & {
  transport?: { end?: () => void }
  removeAllListeners?: () => void
}

const logger: ExtendedLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        }
      })
}) as ExtendedLogger

export const closeLogger = () => {
  if (logger.flush) {
    logger.flush()
  }
  if (!isTest && logger.transport?.end) {
    logger.transport.end()
  }
  logger.removeAllListeners?.()
}

export default logger
