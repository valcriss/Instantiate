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
   * @param escapeHtml Si true, les variables seront échappées pour éviter les injections de code
   */
  static async renderToFile(inputPath: string, outputPath: string, context: Record<string, unknown>, escapeHtml: boolean = false): Promise<void> {
    const originalEscape = mustache.escape
    try {
      // Sauvegarder le comportement d'échappement original

      // Si escapeHtml est false, désactiver l'échappement
      if (!escapeHtml) {
        mustache.escape = (text) => text
      }

      const template = await fs.readFile(inputPath, 'utf-8')
      const result = mustache.render(template, context)

      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, result, 'utf-8')
      logger.info(`[template] Template rendered in ${outputPath}`)
    } catch (err) {
      logger.error(`[template] Error while rendering the template ${inputPath}`)
      throw err
    } finally {
      // Restaurer le comportement d'échappement original
      mustache.escape = originalEscape
    }
  }
}
