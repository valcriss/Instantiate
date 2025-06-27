import path from 'path'
import fs from 'fs/promises'
import YAML from 'yaml'
import { StackInfo, StackService, StackStatus } from '../core/StackService'
import logger from '../utils/logger'
import { getOrchestratorAdapter } from '../orchestrators'
import { buildStackName } from '../utils/nameUtils'
import { getWorkingPath } from '../utils/workingPath'

export class HealthChecker {
  static async checkStack(stack: StackInfo): Promise<StackStatus> {
    const projectName = buildStackName(stack.projectName, stack.mergeRequestName)
    try {
      let orchestrator = 'compose'
      try {
        const raw = await fs.readFile(
          path.join(path.join(getWorkingPath(), 'instantiate', stack.projectId, stack.mr_id), '.instantiate', 'config.yml'),
          'utf-8'
        )
        const config = YAML.parse(raw)
        orchestrator = config.orchestrator ?? 'compose'
      } catch {
        // ignore
      }
      const adapter = getOrchestratorAdapter(orchestrator)
      const status = await adapter.checkHealth(projectName)
      return status
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
