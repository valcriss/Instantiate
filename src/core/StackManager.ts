import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import simpleGit from 'simple-git'
import YAML from 'yaml'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import db from '../db'
import logger from '../utils/logger'
import { TemplateEngine } from './TemplateEngine'
import { DockerService } from '../docker/DockerService'
import { PortAllocator } from './PortAllocator'

export class StackManager {
  async deploy(payload: MergeRequestPayload, projectKey: string) {
    const mrId = payload.mr_id
    const tmpPath = path.join(os.tmpdir(), 'instantiate', mrId)
    const cloneUrl = `${payload.repo}`
    const hostdomain = process.env.HOST_DOMAIN || 'localhost'
    const hostScheme = process.env.HOST_SCHEME || 'http'
    const hostDns = `${hostScheme}://${hostdomain}`

    try {
      logger.info(`[stack] Starting the deployment of the stack for MR #${mrId}`)

      // Nettoyage et préparation dossier temporaire
      await fs.rm(tmpPath, { recursive: true, force: true })
      await fs.mkdir(tmpPath, { recursive: true })

      // Clonage du repo
      const git = simpleGit()
      await git.clone(cloneUrl, tmpPath, ['--branch', payload.branch])

      // Lecture du fichier de config YAML
      const configPath = path.join(tmpPath, '.instantiate', 'config.yml')
      const configExists = await fs
        .stat(configPath)
        .then(() => true)
        .catch(() => false)
      if (!configExists) {
        logger.warn(`[stack] Unable to find the configuration file in current branch [${payload.branch}] : ${configPath}`)
        return
      }

      const composeInput = path.join(tmpPath, '.instantiate', 'docker-compose.yml')
      const composeExists = await fs
        .stat(composeInput)
        .then(() => true)
        .catch(() => false)
      if (!composeExists) {
        logger.warn(`[stack] Unable to find the docker-compose file in current branch [${payload.branch}] : ${composeInput}`)
        return
      }

      // Stockage de l'état de la MR
      await db.query(
        `
        INSERT INTO merge_requests (mr_id, repo, status, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (mr_id) DO UPDATE
        SET status = $3, updated_at = NOW()
        `,
        [mrId, payload.repo, payload.status]
      )

      // Lecture du fichier de configuration
      const configRaw = await fs.readFile(configPath, 'utf-8')
      const config = YAML.parse(configRaw)
      const composeOutput = path.join(tmpPath, 'docker-compose.yml')

      // Préparation des ports dynamiques pour chaque service déclaré
      const ports: Record<string, number> = {}
      if (config.expose_ports) {
        for (const entry of config.expose_ports) {
          const port = await PortAllocator.allocatePort(mrId, entry.service, entry.name, entry.port)
          ports[entry.name] = port
        }
      }

      // Contexte pour le rendu du template
      const context = {
        MR_ID: mrId,
        PROJECT_KEY: projectKey,
        HOST_DNS: hostDns,
        ...ports // injecte WEB_PORT, API_PORT, etc.
      }

      // Substitution du docker-compose
      await TemplateEngine.renderToFile(composeInput, composeOutput, context)

      // Lancement des containers
      await DockerService.up(tmpPath, `mr-${mrId}`)

      logger.info(`[stack] Stack for the MR #${mrId} successfully deployed`)
    } catch (err) {
      logger.error(`[stack] Error during the deployment of the stack for MR #${mrId}`)
      throw err
    }
  }

  async destroy(payload: MergeRequestPayload, projectKey: string) {
    const mrId = payload.mr_id
    const tmpPath = path.join(os.tmpdir(), 'instantiate', mrId)

    try {
      logger.info(`[stack] Removing of the stack for MR #${mrId}`)
      await DockerService.down(tmpPath, `mr-${mrId}`)
      await PortAllocator.releasePorts(mrId)

      await db.query(`UPDATE merge_requests SET status = $1, updated_at = NOW() WHERE mr_id = $2`, ['closed', mrId])

      logger.info(`[stack] Stack for MR #${mrId} successfully removed`)

      await fs.rm(tmpPath, { recursive: true, force: true })
    } catch (err) {
      logger.error(`[stack] Error during the removal of the stack for MR #${mrId}`)
      throw err
    }
  }
}
