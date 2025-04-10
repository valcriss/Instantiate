import logger from '../utils/logger'

export class DockerService {
  static async up(stackPath: string, projectName: string): Promise<void> {
    const { execa } = await import('execa')
    logger.info(`[docker] Stack started : ${projectName}`)
    await execa('docker-compose', ['-p', projectName, 'up', '-d'], {
      cwd: stackPath,
      stdout: function* (line: string | Uint8Array | unknown) {
        logger.info(`[docker] ${line}`)
      },
      stderr: function* (line: string | Uint8Array | unknown) {
        logger.info(`[docker] ${line}`)
      }
    })
  }

  static async down(stackPath: string, projectName: string): Promise<void> {
    const { execa } = await import('execa')
    logger.info(`[docker] Stack down : ${projectName}`)
    await execa('docker-compose', ['-p', projectName, 'down', '--volumes'], {
      cwd: stackPath,
      stdout: function* (line: string | Uint8Array | unknown) {
        logger.info(`[docker] ${line}`)
      },
      stderr: function* (line: string | Uint8Array | unknown) {
        logger.info(`[docker] ${line}`)
      }
    })
  }
}
