import path from 'path'
import { execa } from 'execa'
import logger from '../utils/logger'

export class DockerService {
  /**
   * Lance une stack Docker Compose dans un dossier donné
   */
  static async up(stackPath: string, projectName: string): Promise<void> {
    try {
      logger.info(`[docker] 🚀 Stack UP: ${projectName}`)
      await execa('docker-compose', ['-p', projectName, 'up', '-d'], {
        cwd: stackPath,
        stdout: 'inherit',
        stderr: 'inherit'
      })
      logger.info(`[docker] ✅ Stack lancée: ${projectName}`)
    } catch (err) {
      logger.error({ err }, `[docker] ❌ Erreur au lancement de ${projectName}`)
      throw err
    }
  }

  /**
   * Stoppe et supprime une stack Docker Compose
   */
  static async down(stackPath: string, projectName: string): Promise<void> {
    try {
      logger.info(`[docker] 🧹 Stack DOWN: ${projectName}`)
      await execa('docker-compose', ['-p', projectName, 'down', '--volumes'], {
        cwd: stackPath,
        stdout: 'inherit',
        stderr: 'inherit'
      })
      logger.info(`[docker] 🧼 Stack supprimée: ${projectName}`)
    } catch (err) {
      logger.error({ err }, `[docker] ❌ Erreur à l'arrêt de ${projectName}`)
      throw err
    }
  }
}
