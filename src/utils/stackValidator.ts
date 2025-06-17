import fs from 'fs/promises'
import YAML from 'yaml'
import fetch from 'node-fetch'
import Ajv, { type AnySchema } from 'ajv'

const COMPOSE_SCHEMA_URL = 'https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json'

export type Orchestrator = 'compose' | 'swarm' | 'kubernetes'

/**
 * Validate a stack file by parsing YAML and optionally checking the compose schema.
 * @param filePath path to the stack file
 * @param orchestrator orchestrator type
 */
export async function validateStackFile(filePath: string, orchestrator: Orchestrator): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf-8')
  let parsed
  try {
    parsed = YAML.parse(raw)
  } catch {
    throw new Error(`[validator] Invalid YAML format in ${filePath}`)
  }

  if (orchestrator === 'compose' || orchestrator === 'swarm') {
    const res = await fetch(COMPOSE_SCHEMA_URL)
    const composeSchema = (await res.json()) as AnySchema
    const ajv = new Ajv()
    const validate = ajv.compile(composeSchema)
    if (!validate(parsed)) {
      throw new Error(`[validator] ${filePath} does not match compose schema`)
    }
  }
}
