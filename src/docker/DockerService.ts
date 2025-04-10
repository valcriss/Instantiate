import logger from '../utils/logger'

export class DockerService {
  static async up(stackPath: string, projectName: string): Promise<void> {
    const { execa } = await import('execa')
    logger.info(`[docker] 🚀 Stack UP: ${projectName}`)
    await execa('docker-compose', ['-p', projectName, 'up', '-d'], {
      cwd: stackPath,
      stdout: 'inherit',
      stderr: 'inherit'
    })
  }

  static async down(stackPath: string, projectName: string): Promise<void> {
    const { execa } = await import('execa')
    logger.info(`[docker] 🧹 Stack DOWN: ${projectName}`)
    await execa('docker-compose', ['-p', projectName, 'down', '--volumes'], {
      cwd: stackPath,
      stdout: 'inherit',
      stderr: 'inherit'
    })
  }
}
