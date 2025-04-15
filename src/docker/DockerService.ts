import { directoryExists } from '../utils/ioUtils'
import logger from '../utils/logger'

export class DockerService {
  static async up(stackPath: string, projectName: string): Promise<void> {
    const { execa } = await import('execa')
    logger.info(`[docker] Stack up: ${projectName}`)

    const subprocess = execa('docker-compose', ['-p', projectName, 'up', '-d', '--force-recreate', '--build'], {
      cwd: stackPath
    })

    subprocess.stdout?.on('data', (data) => {
      logger.info(`[docker:stdout] ${data.toString().trim()}`)
    })

    subprocess.stderr?.on('data', (data) => {
      logger.info(`[docker:stderr] ${data.toString().trim()}`)
    })

    await subprocess
  }

  static async down(stackPath: string, projectName: string): Promise<void> {
    if (!(await directoryExists(stackPath))) {
      logger.warn(`[docker] Stack path does not exist: ${stackPath}`)
      return
    }

    const { execa } = await import('execa')
    logger.info(`[docker] Stack down: ${projectName}`)

    const subprocess = execa('docker-compose', ['-p', projectName, 'down', '--volumes'], {
      cwd: stackPath
    })

    subprocess.stdout?.on('data', (data) => {
      logger.info(`[docker:stdout] ${data.toString().trim()}`)
    })

    subprocess.stderr?.on('data', (data) => {
      logger.info(`[docker:stderr] ${data.toString().trim()}`)
    })

    await subprocess
  }
}
