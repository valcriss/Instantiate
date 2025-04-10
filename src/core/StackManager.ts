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
    const cloneUrl = `https://github.com/${payload.repo}.git` // à adapter selon SCM

    try {
      logger.info(`[stack] Déploiement de la stack MR #${mrId}`)

      // Nettoyage et préparation dossier temporaire
      await fs.rm(tmpPath, { recursive: true, force: true })
      await fs.mkdir(tmpPath, { recursive: true })

      // Clonage du repo
      const git = simpleGit()
      await git.clone(cloneUrl, tmpPath, ['--branch', payload.branch])

      // Lecture du fichier de config YAML
      const configRaw = await fs.readFile(path.join(tmpPath, '.instantiate', 'config.yml'), 'utf-8')
      const config = YAML.parse(configRaw)

      const composeInput = path.join(tmpPath, '.instantiate', 'docker-compose.yml')
      const composeOutput = path.join(tmpPath, 'docker-compose.yml')

      // Préparation des ports dynamiques pour chaque service déclaré
      const ports: Record<string, number> = {}
      if (config.expose_ports) {
        for (const entry of config.expose_ports) {
          const port = await PortAllocator.allocatePort(mrId, entry.service, entry.port)
          ports[entry.service.toUpperCase() + '_PORT'] = port
        }
      }

      // Contexte pour le rendu du template
      const context = {
        MR_ID: mrId,
        PROJECT_KEY: projectKey,
        ...ports // injecte WEB_PORT, API_PORT, etc.
      }

      // Substitution du docker-compose
      await TemplateEngine.renderToFile(composeInput, composeOutput, context)

      // Lancement des containers
      await DockerService.up(tmpPath, `mr-${mrId}`)

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

      logger.info(`[stack] ✅ Stack MR #${mrId} lancée avec succès !`)
    } catch (err) {
      logger.error({ err }, `[stack] Erreur lors du déploiement de MR #${mrId}`)
      throw err
    }
  }

  async destroy(payload: MergeRequestPayload, projectKey: string) {
    const mrId = payload.mr_id
    const tmpPath = path.join(os.tmpdir(), 'instantiate', mrId)

    try {
      logger.info(`[stack] 🧹 Destruction de la stack MR #${mrId}`)
      await DockerService.down(tmpPath, `mr-${mrId}`)
      await PortAllocator.releasePorts(mrId)

      await db.query(`UPDATE merge_requests SET status = $1, updated_at = NOW() WHERE mr_id = $2`, [
        'closed',
        mrId
      ])

      logger.info(`[stack] Stack supprimée pour MR #${mrId}`)
    } catch (err) {
      logger.error({ err }, `[stack] Erreur lors de la suppression de MR #${mrId}`)
      throw err
    }
  }
}
