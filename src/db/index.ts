import { Pool } from 'pg'
import dotenv from 'dotenv'
import { MergeRequestPayload } from '../types/MergeRequestPayload'

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export default {
  getUsedPorts: async () => {
    const result = await pool.query('SELECT external_port FROM exposed_ports')
    return new Set(result.rows.map((r) => r.external_port))
  },
  allreadyAllocatedPort: async (projectId: string, mrId: string, service: string, name: string) => {
    const result = await pool.query(`SELECT external_port FROM exposed_ports WHERE project_id= $1 AND mr_id = $2 AND service = $3 AND name = $4`, [
      projectId,
      mrId,
      service,
      name
    ])
    if (result && result.rows.length > 0) {
      return result.rows[0].external_port
    }
    return null
  },
  addExposedPorts: async (projectId: string, mrId: string, service: string, name: string, internalPort: number, port: number) => {
    await pool.query(
      `INSERT INTO exposed_ports (project_id, mr_id, service, name, internal_port, external_port)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, mrId, service, name, internalPort, port]
    )
  },
  releasePorts: async (projectId: string, mrId: string) => {
    await pool.query(`DELETE FROM exposed_ports WHERE project_id = $1 AND mr_id = $2`, [projectId, mrId])
  },
  getPortsForMr: async (projectId: string, mrId: string) => {
    const result = await pool.query(`SELECT service, external_port FROM exposed_ports WHERE project_id = $1 AND mr_id = $2`, [projectId, mrId])
    const map: Record<string, number> = {}
    for (const row of result.rows) {
      map[row.service] = row.external_port
    }
    return map
  },
  updateMergeRequest: async (payload: MergeRequestPayload, state: string) => {
    await pool.query(
      `
      INSERT INTO merge_requests (project_id, mr_id, repo, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (project_id, mr_id) DO UPDATE
      SET status = $4, updated_at = NOW()
      `,
      [payload.project_id, payload.mr_id, payload.repo, payload.status]
    )
  },
  getClient: () => pool.connect()
}

