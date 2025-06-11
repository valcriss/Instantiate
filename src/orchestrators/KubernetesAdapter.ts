import logger from '../utils/logger'
import execa from '../docker/execaWrapper'
import { OrchestratorAdapter } from './OrchestratorAdapter'

export class KubernetesAdapter implements OrchestratorAdapter {
  async up(stackPath: string, _projectName: string): Promise<void> {
    logger.info('[k8s] Apply manifests')
    await execa('kubectl', ['apply', '-f', stackPath])
  }

  async down(stackPath: string, _projectName: string): Promise<void> {
    logger.info('[k8s] Delete manifests')
    await execa('kubectl', ['delete', '-f', stackPath])
  }

  async checkHealth(projectName: string): Promise<'running' | 'error'> {
    try {
      const { stdout } = await execa('kubectl', ['get', 'pods', '-l', `app=${projectName}`, '-o', 'jsonpath={.items[*].status.phase}'])
      if (!stdout) {
        return 'error'
      }
      const phases = stdout.trim().split(/\s+/)
      return phases.every((p) => p === 'Running') ? 'running' : 'error'
    } catch (err) {
      logger.error('[k8s] Error checking stack', err)
      return 'error'
    }
  }
}
