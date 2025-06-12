import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import simpleGit from 'simple-git'
import YAML from 'yaml'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import db from '../db'
import logger from '../utils/logger'
import { TemplateEngine } from './TemplateEngine'
import { getOrchestratorAdapter } from '../orchestrators'
import { PortAllocator } from './PortAllocator'
import { CommentService } from '../comments/CommentService'
import { StackService } from './StackService'
import { createDirectory, removeDirectory } from '../utils/ioUtils'

export class StackManager {
  async deploy(payload: MergeRequestPayload, projectKey: string) {
    const projectId = payload.project_id
    const mrId = payload.mr_id
    const tmpPath = path.join(os.tmpdir(), 'instantiate', projectId.toString(), mrId.toString())
    const cloneUrl = `${payload.repo}`
    const hostDomain = process.env.HOST_DOMAIN ?? 'localhost'
    const hostScheme = process.env.HOST_SCHEME ?? 'http'
    const hostDns = `${hostScheme}://${hostDomain}`
    const commenter = CommentService.getCommenter(payload.provider)
    try {
      logger.info(`[stack] Starting the deployment of the stack for MR #${mrId}`)
      await db.updateMergeRequest(payload, payload.status)
      await commenter.postStatusComment(payload, 'in_progress')
      // Nettoyage et préparation dossier temporaire

      await removeDirectory(tmpPath)
      const createDirectoryResult = await createDirectory(tmpPath)

      if (!createDirectoryResult) {
        logger.error(`[stack] Unable to create directory ${tmpPath}`)
        return
      }

      // Clonage du repo
      const git = simpleGit({ config: process.env.IGNORE_SSL_ERRORS === 'true' ? ['http.sslVerify=false'] : [] })
      await git.clone(cloneUrl, tmpPath, ['--branch', payload.branch])

      // Lecture du fichier de config YAML
      const configPath = path.join(tmpPath, '.instantiate', 'config.yml')
      const configExists = await fs
        .stat(configPath)
        .then(() => true)
        .catch(() => false)
      if (!configExists) {
        logger.warn(`[stack] Unable to find the configuration file in current branch [${payload.branch}] : ${configPath}`)
        return null
      }

      await db.updateMergeRequest(payload, payload.status)

      // Lecture du fichier de configuration
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
        logger.warn(`[stack] Unable to find the stack template file in current branch [${payload.branch}] : ${composeInput}`)
        return null
      }

      const repoPaths: Record<string, string> = {}
      if (config.repositories) {
        const repos = config.repositories as Record<string, { repo: string; branch: string }>
        for (const [name, repoCfg] of Object.entries(repos)) {
          const repoPath = path.join(tmpPath, name)
          await git.clone(repoCfg.repo, repoPath, ['--branch', repoCfg.branch])
          repoPaths[name.toUpperCase() + '_PATH'] = repoPath
        }
      }

      const adapter = getOrchestratorAdapter(orchestrator)
      const composeOutput = path.join(tmpPath, 'docker-compose.yml')

      // Préparation des ports dynamiques pour chaque service déclaré
      const ports: Record<string, number> = {}
      const portsLinks: Record<string, string> = {}
      if (config.expose_ports) {
        for (const entry of config.expose_ports) {
          const port = await PortAllocator.allocatePort(projectId, mrId, entry.service, entry.name, entry.port)
          ports[entry.name] = port
          portsLinks[entry.service] = `${hostDns}:${port}`
        }
      }

      // Contexte pour le rendu du template
      const context = {
        MR_ID: mrId,
        PROJECT_KEY: projectKey,
        HOST_DNS: hostDns,
        HOST_DOMAIN: hostDomain,
        HOST_SCHEME: hostScheme,
        ...repoPaths,
        ...ports // injecte WEB_PORT, API_PORT, etc.
      }

      // Substitution du docker-compose
      await TemplateEngine.renderToFile(composeInput, composeOutput, context)

      // Lancement des containers
      await adapter.up(tmpPath, `${projectId}-mr-${mrId}`)
      await commenter.postStatusComment(payload, 'ready', portsLinks)
      logger.info(`[stack] Stack for the MR #${mrId} on project ${projectId} successfully deployed`)

      StackService.save({
        projectId,
        projectName: payload.projectName,
        mergeRequestName: payload.mergeRequestName,
        ports: ports,
        mr_id: payload.mr_id,
        provider: payload.provider,
        status: 'running',
        links: portsLinks
      })

      return hostDns
    } catch (err) {
      logger.error(`[stack] Error during the deployment of the stack for MR #${mrId} on project ${projectId}`)
      throw err
    }
  }

  async destroy(payload: MergeRequestPayload, projectKey: string) {
    const projectId = payload.project_id
    const mrId = payload.mr_id
    const tmpPath = path.join(os.tmpdir(), 'instantiate', projectId.toString(), mrId.toString())
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
      await adapter.down(tmpPath, `${projectId}-mr-${mrId}`)
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
}
