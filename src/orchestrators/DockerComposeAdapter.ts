import { directoryExists } from '../utils/ioUtils'
import logger from '../utils/logger'
import execa from '../docker/execaWrapper'
import { OrchestratorAdapter } from './OrchestratorAdapter'

export class DockerComposeAdapter implements OrchestratorAdapter {
  async up(stackPath: string, projectName: string): Promise<void> {
    logger.info(`[docker] Stack up: ${projectName}`)
    const subprocess = execa('docker-compose', ['-p', projectName, 'up', '-d', '--force-recreate', '--build'], { cwd: stackPath })
    subprocess.stdout?.on('data', (d) => {
      logger.info(`[docker:stdout] ${d.toString().trim()}`)
    })
    subprocess.stderr?.on('data', (d) => {
      logger.info(`[docker:stderr] ${d.toString().trim()}`)
    })
    await subprocess
  }

  async down(stackPath: string, projectName: string): Promise<void> {
    if (!(await directoryExists(stackPath))) {
      logger.warn(`[docker] Stack path does not exist: ${stackPath}`)
      return
    }
    logger.info(`[docker] Stack down: ${projectName}`)
    const subprocess = execa('docker-compose', ['-p', projectName, 'down', '--volumes', '--rmi', 'all'], { cwd: stackPath })
    subprocess.stdout?.on('data', (d) => {
      logger.info(`[docker:stdout] ${d.toString().trim()}`)
    })
    subprocess.stderr?.on('data', (d) => {
      logger.info(`[docker:stderr] ${d.toString().trim()}`)
    })
    await subprocess
  }

  async checkHealth(projectName: string): Promise<'running' | 'error'> {
    try {
      const { stdout } = await execa('docker', ['ps', '--filter', `label=com.docker.compose.project=${projectName}`, '--format', '{{.State}}'])
      if (!stdout) {
        return 'error'
      }
      const states = stdout.split('\n').filter(Boolean)
      return states.every((s) => s === 'running') ? 'running' : 'error'
    } catch (err) {
      logger.error({ err }, '[docker] Error checking stack')
      return 'error'
    }
  }
}
