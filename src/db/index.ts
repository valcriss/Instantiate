import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export default {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
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
  addExposedPorts: async (projectId: string, mrId: string, service: string, name: string) => {
    await pool.query(
      `INSERT INTO exposed_ports (project_id, mr_id, service, name, internal_port, external_port)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, mrId, service, name, internalPort, port]
    )
  },
  getClient: () => pool.connect()
}
