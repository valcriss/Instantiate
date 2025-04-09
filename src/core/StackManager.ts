import logger from '../utils/logger'
import db from '../db'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

export class StackManager {
  async deploy(payload: MergeRequestPayload, projectKey: string) {
    logger.info(`[deploy] MR #${payload.mr_id} from ${payload.repo}`)

    try {
      // TODO: cloner le repo, parser config, allouer ports, substituer fichiers, lancer Docker

      // Stocker ou mettre à jour la MR dans la base
      await db.query(
        `
        INSERT INTO merge_requests (mr_id, repo, status, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (mr_id) DO UPDATE
        SET status = $3, updated_at = NOW()
        `,
        [payload.mr_id, payload.repo, payload.status]
      )

      logger.info(`[deploy] Environnement stack lancé pour ${payload.repo}#${payload.branch}`)
    } catch (err) {
      logger.error({ err }, '[deploy] Échec du déploiement')
      throw err
    }
  }

  async destroy(payload: MergeRequestPayload, projectKey: string) {
    logger.info(`[destroy] MR #${payload.mr_id} closed, nettoyage...`)

    try {
      // TODO: stopper containers, libérer ports, supprimer volumes, etc.

      await db.query(
        `UPDATE merge_requests SET status = $1, updated_at = NOW() WHERE mr_id = $2`,
        ['closed', payload.mr_id]
      )

      logger.info(`[destroy] Stack supprimée pour MR #${payload.mr_id}`)
    } catch (err) {
      logger.error({ err }, '[destroy] Échec de la suppression')
      throw err
    }
  }
}
