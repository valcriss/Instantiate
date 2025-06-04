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
       VALUES ($1, $2, $3, $4, $5, $6)`,
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
  getMergeRequestCommentId: async (projectId: string, mrId: string) => {
    const result = await pool.query('SELECT comment_id FROM merge_requests WHERE project_id = $1 AND mr_id = $2', [projectId, mrId])
    if (result.rows.length > 0) {
      return result.rows[0].comment_id as string | null
    }
    return null
  },
  setMergeRequestCommentId: async (projectId: string, mrId: string, commentId: string) => {
    await pool.query('UPDATE merge_requests SET comment_id = $3 WHERE project_id = $1 AND mr_id = $2', [projectId, mrId, commentId])
  },
  updateMergeRequest: async (payload: MergeRequestPayload, state: string) => {
    await pool.query(
      `
      INSERT INTO merge_requests (project_id, mr_id, project_name, merge_request_name, repo, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (project_id, mr_id) DO UPDATE
      SET status = $6, updated_at = NOW()
      `,
      [payload.project_id, payload.mr_id, payload.projectName, payload.mergeRequestName, payload.repo, payload.status]
    )
  },
  saveStack: async (
    projectId: string,
    mrId: string,
    projectName: string,
    mergeRequestName: string,
    ports: Record<string, number>,
    provider: string,
    status: string,
    links: Record<string, string>
  ) => {
    await pool.query(
      `
      INSERT INTO stacks (project_id, mr_id, project_name, merge_request_name, ports, provider, status, links, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (project_id, mr_id) DO UPDATE
      SET ports = $5,
          provider = $6,
          status = $7,
          links = $8,
          updated_at = now()
      `,
      [projectId, mrId, projectName, mergeRequestName, JSON.stringify(ports), provider, status, JSON.stringify(links)]
    )
  },
  updateStackStatus: async (projectId: string, mrId: string, status: string) => {
    await pool.query(
      `UPDATE stacks SET status = $3, updated_at = now() WHERE project_id = $1 AND mr_id = $2`,
      [projectId, mrId, status]
    )
  },
  removeStack: async (projectId: string, mrId: string) => {
    await pool.query(`DELETE FROM stacks WHERE project_id = $1 AND mr_id = $2`, [projectId, mrId])
  },
  getAllStacks: async () => {
    const result = await pool.query(`SELECT * FROM stacks ORDER BY created_at DESC`)
    return result.rows.map((row) => ({
      projectId: row.project_id,
      mr_id: row.mr_id,
      projectName: row.project_name,
      mergeRequestName: row.merge_request_name,
      ports: row.ports,
      provider: row.provider,
      status: row.status,
      links: row.links,
      updatedAt: row.updated_at.toISOString(),
      createdAt: row.created_at.toISOString()
    }))
  },
  getClient: () => pool.connect()
}
