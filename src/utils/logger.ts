import pino from 'pino'

const isProd = process.env.NODE_ENV === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
})

export const closeLogger = async () => {
  if (logger.flush) {
    await logger.flush()
    await logger.removeAllListeners()
  }
}

export default logger
