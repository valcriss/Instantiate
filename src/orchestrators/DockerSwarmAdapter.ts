import logger from '../utils/logger'
import execa from '../docker/execaWrapper'
import { OrchestratorAdapter } from './OrchestratorAdapter'

export class DockerSwarmAdapter implements OrchestratorAdapter {
  async up(stackPath: string, projectName: string): Promise<void> {
    logger.info(`[swarm] Stack up: ${projectName}`)
    await execa('docker', ['stack', 'deploy', '-c', 'docker-compose.yml', projectName], { cwd: stackPath })
  }

  async down(_stackPath: string, projectName: string): Promise<void> {
    logger.info(`[swarm] Stack down: ${projectName}`)
    await execa('docker', ['stack', 'rm', projectName])
  }

  async checkHealth(projectName: string): Promise<'running' | 'error'> {
    try {
      const { stdout } = await execa('docker', ['service', 'ls', '--filter', `label=com.docker.stack.namespace=${projectName}`, '--format', '{{.Replicas}}'])
      if (!stdout) {
        return 'error'
      }
      const replicas = stdout.split('\n').filter(Boolean)
      return replicas.every((r) => r.split('/')[0] === r.split('/')[1]) ? 'running' : 'error'
    } catch (err) {
      logger.error('[swarm] Error checking stack', err)
      return 'error'
    }
  }
}
