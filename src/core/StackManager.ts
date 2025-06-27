import path from 'path'
import fs from 'fs/promises'
import simpleGit, { SimpleGit } from 'simple-git'
import YAML from 'yaml'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import db from '../db'
import logger from '../utils/logger'
import { TemplateEngine } from './TemplateEngine'
import { validateStackFile } from '../utils/stackValidator'
import { getOrchestratorAdapter } from '../orchestrators'
import { buildStackName } from '../utils/nameUtils'
import { PortAllocator } from './PortAllocator'
import { CommentService } from '../comments/CommentService'
import { StackService } from './StackService'
import { createDirectory, removeDirectory } from '../utils/ioUtils'
import { injectCredentialsIfMissing } from '../utils/gitUrl'
import execa from '../docker/execaWrapper'
import { getWorkingPath } from '../utils/workingPath'

/**
 * Coordinates the creation and removal of ephemeral stacks for merge requests.
 *
 * A stack is deployed when a merge request is opened or updated and destroyed
 * once the request is closed. The manager handles repository cloning,
 * configuration loading, port allocation and orchestrator interaction.
 */
export class StackManager {
  /**
   * Deploy an environment for the given merge request.
   *
   * Workflow:
   * - Record the merge request as "in progress" and notify via comment.
   * - Create a temporary directory and clone the main repository.
   * - Load `.instantiate/config.yml` and clone any additional repositories.
   * - Allocate dynamic ports for services and render the stack template.
   * - Start the orchestrator to launch the stack.
   * - Save stack information in the database and comment the exposed links.
   *
   * Side effects include database updates, temporary file creation, port
   * allocation and orchestrator execution.
   *
   * @param payload Merge request payload describing the environment to deploy.
   * @param projectKey Key identifying the project for template substitutions.
   * @returns The base URL where the stack will be reachable.
   */
  async deploy(payload: MergeRequestPayload, projectKey: string) {
    const projectId = payload.project_id
    const mrId = payload.mr_id
    const tmpPath = path.join(getWorkingPath(), 'instantiate', projectId.toString(), mrId.toString())
    let cloneUrl = `${payload.repo}`
    if (payload.provider === 'gitlab') {
      cloneUrl = injectCredentialsIfMissing(cloneUrl, process.env.REPOSITORY_GITLAB_USERNAME, process.env.REPOSITORY_GITLAB_TOKEN)
    }
    if (payload.provider === 'github') {
      cloneUrl = injectCredentialsIfMissing(cloneUrl, process.env.REPOSITORY_GITHUB_USERNAME, process.env.REPOSITORY_GITHUB_TOKEN)
    }
    const hostDomain = process.env.HOST_DOMAIN ?? 'localhost'
    const hostScheme = process.env.HOST_SCHEME ?? 'http'
    const hostDns = `${hostScheme}://${hostDomain}`
    const commenter = CommentService.getCommenter(payload.provider)
    try {
      logger.info(`[stack] Starting the deployment of the stack for MR #${mrId}`)
      await db.updateMergeRequest(payload, payload.status)
      await commenter.postStatusComment(payload, 'in_progress')

      if (!(await this.prepareTmpDir(tmpPath))) {
        return
      }

      const git = simpleGit({ config: process.env.IGNORE_SSL_ERRORS === 'true' ? ['http.sslVerify=false'] : [] })
      await git.clone(cloneUrl, tmpPath, ['--branch', payload.branch])

      const configData = await this.loadConfiguration(tmpPath, payload.branch)
      if (!configData) {
        return null
      }

      await db.updateMergeRequest(payload, payload.status)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repoPaths = await this.cloneRepositories(git, payload, tmpPath, (configData.config as any).services)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.runPrebuild((configData.config as any).services, repoPaths, tmpPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { ports, portsLinks } = await this.allocateServicePorts((configData.config as any).services, projectId, mrId, hostDns)

      const context = {
        MR_ID: mrId,
        PROJECT_KEY: projectKey,
        HOST_DNS: hostDns,
        HOST_DOMAIN: hostDomain,
        HOST_SCHEME: hostScheme,
        ...repoPaths,
        ...ports
      }

      await this.launchStack(tmpPath, configData.composeInput, configData.orchestrator, context, ports, portsLinks, payload, commenter)

      return hostDns
    } catch (err) {
      logger.error(`[stack] Error during the deployment of the stack for MR #${mrId} on project ${projectId}`)
      await commenter.postStatusComment(payload, 'error')
      await StackService.updateStatus(projectId, mrId, 'error')
      throw err
    }
  }

  /**
   * Remove the environment associated with a merge request.
   *
   * Steps:
   * - Determine the orchestrator used for the deployment.
   * - Stop and remove the running stack.
   * - Release any ports allocated for the services.
   * - Update the merge request status and cleanup persisted data.
   * - Delete the temporary working directory and post a closing comment.
   *
   * This method updates the database, interacts with the orchestrator and
   * removes all artifacts created by {@link deploy}.
   */
  async destroy(payload: MergeRequestPayload, projectKey: string) {
    const projectId = payload.project_id
    const mrId = payload.mr_id
    const tmpPath = path.join(getWorkingPath(), 'instantiate', projectId.toString(), mrId.toString())
    const commenter = CommentService.getCommenter(payload.provider)

    try {
      logger.info(`[stack] Removing of the stack for MR #${mrId}`)
      let orchestrator = 'compose'
      try {
        const raw = await fs.readFile(path.join(tmpPath, '.instantiate', 'config.yml'), 'utf-8')
        const conf = YAML.parse(raw)
        orchestrator = conf.orchestrator ?? 'compose'
      } catch {
        // ignore if missing
      }
      const adapter = getOrchestratorAdapter(orchestrator)
      const stackName = buildStackName(payload.projectName, payload.mergeRequestName)
      await adapter.down(tmpPath, stackName)
      await PortAllocator.releasePorts(projectId, mrId)

      await db.updateMergeRequest(payload, 'closed')

      logger.info(`[stack] Stack for MR #${mrId} on project ${projectId} successfully removed`)

      await StackService.remove(projectId, mrId)

      await fs.rm(tmpPath, { recursive: true, force: true })
      await commenter.postStatusComment(payload, 'closed')
    } catch (err) {
      logger.error(`[stack] Error during the removal of the stack for MR #${mrId} on project ${projectId}`)
      throw err
    }
  }

  private async prepareTmpDir(tmpPath: string): Promise<boolean> {
    await removeDirectory(tmpPath)
    const created = await createDirectory(tmpPath)
    if (!created) {
      logger.error(`[stack] Unable to create directory ${tmpPath}`)
    }
    return created
  }

  private async loadConfiguration(tmpPath: string, branch: string): Promise<{ config: unknown; orchestrator: string; composeInput: string } | null> {
    const configPath = path.join(tmpPath, '.instantiate', 'config.yml')
    const configExists = await fs
      .stat(configPath)
      .then(() => true)
      .catch(() => false)
    if (!configExists) {
      logger.warn(`[stack] Unable to find the configuration file in current branch [${branch}] : ${configPath}`)
      return null
    }

    const configRaw = await fs.readFile(configPath, 'utf-8')
    const config = YAML.parse(configRaw)
    const orchestrator = config.orchestrator ?? 'compose'
    const stackfileName = config.stackfile ?? (orchestrator === 'kubernetes' ? 'all.yml' : 'docker-compose.yml')
    const composeInput = path.join(tmpPath, '.instantiate', stackfileName)
    const composeExists = await fs
      .stat(composeInput)
      .then(() => true)
      .catch(() => false)
    if (!composeExists) {
      logger.warn(`[stack] Unable to find the stack template file in current branch [${branch}] : ${composeInput}`)
      return null
    }

    return { config, orchestrator, composeInput }
  }

  private async cloneRepositories(
    git: SimpleGit,
    payload: MergeRequestPayload,
    tmpPath: string,
    services?: Record<string, { repository?: { repo: string; branch?: string; behavior?: string } }>
  ): Promise<Record<string, string>> {
    const repoPaths: Record<string, string> = {}
    if (services) {
      for (const [serviceName, serviceCfg] of Object.entries(services)) {
        if (serviceCfg.repository) {
          const repoCfg = serviceCfg.repository
          const repoPath = path.join(tmpPath, serviceName)
          let sideRepoUrl = repoCfg.repo
          if (payload.provider === 'gitlab') {
            sideRepoUrl = injectCredentialsIfMissing(sideRepoUrl, process.env.REPOSITORY_GITLAB_USERNAME, process.env.REPOSITORY_GITLAB_TOKEN)
          }
          if (payload.provider === 'github') {
            sideRepoUrl = injectCredentialsIfMissing(sideRepoUrl, process.env.REPOSITORY_GITHUB_USERNAME, process.env.REPOSITORY_GITHUB_TOKEN)
          }
          let branchToClone = repoCfg.branch
          const behavior = repoCfg.behavior ?? 'fixed'
          logger.debug(`[stack] Side repo behavior ${behavior}`)
          if (behavior === 'match') {
            try {
              const result = await git.listRemote(['--heads', sideRepoUrl, payload.branch])
              logger.debug(`[stack] Side repo listRemote ${result}`)
              if (result.trim().length > 0) {
                branchToClone = payload.branch
              }
            } catch (e) {
              logger.debug(`[stack] Side repo listRemote failed ${e}`)
            }
          }
          const cloneArgs = branchToClone ? ['--branch', branchToClone] : []
          await git.clone(sideRepoUrl, repoPath, cloneArgs)
          repoPaths[serviceName.toUpperCase() + '_PATH'] = repoPath
        }
      }
    }
    return repoPaths
  }

  private async runPrebuild(
    services:
      | Record<
          string,
          { repository?: { repo: string; branch?: string; behavior?: string }; prebuild?: { image: string; mountpath?: string; commands: string[] } }
        >
      | undefined,
    repoPaths: Record<string, string>,
    tmpPath: string
  ): Promise<void> {
    if (!services) {
      return
    }
    for (const [serviceName, serviceCfg] of Object.entries(services)) {
      const pre = serviceCfg.prebuild
      if (!pre) {
        continue
      }
      const mountPath = pre.mountpath ?? '/app'
      const hostPath = serviceCfg.repository ? repoPaths[serviceName.toUpperCase() + '_PATH'] : tmpPath
      logger.info(`[prebuild] ${serviceName}`)
      logger.info(`[prebuild] executing commands: ${pre.commands.join(' && ')} on image ${pre.image}`)
      const subprocess = execa('docker', ['run', '--rm', '-v', `${hostPath}:${mountPath}`, '-w', mountPath, pre.image, 'sh', '-c', pre.commands.join(' && ')])
      subprocess.stdout?.on('data', (d) => {
        logger.info(`[prebuild:stdout] ${d.toString().trim()}`)
      })
      subprocess.stderr?.on('data', (d) => {
        logger.info(`[prebuild:stderr] ${d.toString().trim()}`)
      })
      await subprocess
    }
  }

  private async allocateServicePorts(
    services: Record<string, { ports?: number }> | undefined,
    projectId: string,
    mrId: string,
    hostDns: string
  ): Promise<{ ports: Record<string, number>; portsLinks: Record<string, string> }> {
    const ports: Record<string, number> = {}
    const portsLinks: Record<string, string> = {}
    if (services) {
      for (const [serviceName, serviceCfg] of Object.entries(services)) {
        const count = typeof serviceCfg.ports === 'number' ? serviceCfg.ports : 0
        for (let index = 1; index <= count; index++) {
          const varName = count > 1 ? `${serviceName.toUpperCase()}_PORT_${index}` : `${serviceName.toUpperCase()}_PORT`
          const ext = await PortAllocator.allocatePort(projectId, mrId, serviceName, varName)
          ports[varName] = ext
          if (!portsLinks[serviceName]) {
            portsLinks[serviceName] = `${hostDns}:${ext}`
          }
        }
      }
    }
    return { ports, portsLinks }
  }

  private async launchStack(
    tmpPath: string,
    composeInput: string,
    orchestrator: string,
    context: Record<string, unknown>,
    ports: Record<string, number>,
    portsLinks: Record<string, string>,
    payload: MergeRequestPayload,
    commenter: ReturnType<typeof CommentService.getCommenter>
  ): Promise<void> {
    const adapter = getOrchestratorAdapter(orchestrator)
    const composeOutput = path.join(tmpPath, 'docker-compose.yml')

    await TemplateEngine.renderToFile(composeInput, composeOutput, context)
    await validateStackFile(composeOutput)

    const stackName = buildStackName(payload.projectName, payload.mergeRequestName)

    await adapter.up(tmpPath, stackName)
    await commenter.postStatusComment(payload, 'ready', portsLinks)
    logger.info(`[stack] Stack for the MR #${payload.mr_id} on project ${payload.project_id} successfully deployed`)

    await StackService.save({
      projectId: payload.project_id,
      projectName: payload.projectName,
      mergeRequestName: payload.mergeRequestName,
      ports,
      mr_id: payload.mr_id,
      provider: payload.provider,
      status: 'running',
      links: portsLinks
    })
  }
}
