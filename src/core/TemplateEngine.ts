import fs from 'fs/promises'
import path from 'path'
import mustache from 'mustache'
import logger from '../utils/logger'

export class TemplateEngine {
  /**
   * Remplace les variables dans un template avec les données fournies.
   * @param inputPath Chemin vers le template (ex: .instantiate/docker-compose.yml)
   * @param outputPath Chemin où écrire le résultat final
   * @param context Dictionnaire des variables à injecter
   */
  static async renderToFile(inputPath: string, outputPath: string, context: Record<string, any>): Promise<void> {
    try {
      const template = await fs.readFile(inputPath, 'utf-8')
      const result = mustache.render(template, context)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, result, 'utf-8')
      logger.info(`✅ Template rendu dans ${outputPath}`)
    } catch (err) {
      logger.error({ err }, `Erreur lors du rendu du template ${inputPath}`)
      throw err
    }
  }
}
