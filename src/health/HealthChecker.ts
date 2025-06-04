import execa from '../docker/execaWrapper'
import { StackInfo, StackService, StackStatus } from '../core/StackService'
import logger from '../utils/logger'

export class HealthChecker {
  static async checkStack(stack: StackInfo): Promise<StackStatus> {
    const projectName = `${stack.projectId}-mr-${stack.mr_id}`
    try {
      const { stdout } = await execa('docker', [
        'ps',
        '--filter',
        `label=com.docker.compose.project=${projectName}`,
        '--format',
        '{{.State}}'
      ])
      if (!stdout) {
        return 'error'
      }
      const states = stdout.split('\n').filter(Boolean)
      return states.every((s) => s === 'running') ? 'running' : 'error'
    } catch (err) {
      logger.error('[health] Error checking stack', err)
      return 'error'
    }
  }

  static async checkAllStacks(): Promise<void> {
    const stacks = await StackService.getAll()
    for (const stack of stacks) {
      const status = await this.checkStack(stack)
      if (status !== stack.status) {
        await StackService.updateStatus(stack.projectId, stack.mr_id, status)
      }
    }
  }
}

export function startHealthChecker(intervalMs = 30000) {
  setInterval(() => {
    HealthChecker.checkAllStacks().catch((err) => {
      logger.error('[health] Error during health check loop', err)
    })
  }, intervalMs)
}
