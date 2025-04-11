import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
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
