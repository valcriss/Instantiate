import fs from 'fs/promises'
import YAML from 'yaml'

export type Orchestrator = 'compose' | 'swarm' | 'kubernetes'

/**
 * Validate a stack file by parsing YAML and optionally checking the compose schema.
 * @param filePath path to the stack file
 * @param orchestrator orchestrator type
 */
export async function validateStackFile(filePath: string): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf-8')
  try {
    YAML.parse(raw)
  } catch {
    throw new Error(`[validator] Invalid YAML format in ${filePath}`)
  }
}
