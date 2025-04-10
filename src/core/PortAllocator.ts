import db from '../db'
import logger from '../utils/logger'

const PORT_MIN = 10000
const PORT_MAX = 11000

export class PortAllocator {
  static async allocatePort(mrId: string, service: string, internalPort: number): Promise<number> {
    const usedPorts = await this.getUsedPorts()
    for (let port = PORT_MIN; port <= PORT_MAX; port++) {
      if (!usedPorts.has(port)) {
        await db.query(
          `INSERT INTO exposed_ports (mr_id, service, internal_port, external_port)
           VALUES ($1, $2, $3, $4)`,
          [mrId, service, internalPort, port]
        )
        logger.info(`[port] Port alloué : ${port} pour ${service} (${mrId})`)
        return port
      }
    }

    throw new Error('Aucun port libre disponible')
  }

  static async getUsedPorts(): Promise<Set<number>> {
    const result = await db.query(`SELECT external_port FROM exposed_ports`)
    return new Set(result.rows.map((r) => r.external_port))
  }

  static async releasePorts(mrId: string): Promise<void> {
    await db.query(`DELETE FROM exposed_ports WHERE mr_id = $1`, [mrId])
    logger.info(`[port] ♻️ Ports libérés pour MR #${mrId}`)
  }

  static async getPortsForMr(mrId: string): Promise<{ [service: string]: number }> {
    const result = await db.query(
      `SELECT service, external_port FROM exposed_ports WHERE mr_id = $1`,
      [mrId]
    )
    const map: Record<string, number> = {}
    for (const row of result.rows) {
      map[row.service] = row.external_port
    }
    return map
  }
}
