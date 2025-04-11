import db from '../db'
import logger from '../utils/logger'

const PORT_MIN = 10000
const PORT_MAX = 11000

export class PortAllocator {
  static async allocatePort(projectId: string, mrId: string, service: string, name: string, internalPort: number): Promise<number> {
    const alreadyAllocatedPort = await db.allreadyAllocatedPort(projectId, mrId, service, name)
    if (alreadyAllocatedPort) {
      logger.info(`[port] Port already allocated : ${alreadyAllocatedPort} for ${service} ${name} (MR:${mrId})`)
      return alreadyAllocatedPort
    }
    const usedPorts = await db.getUsedPorts()
    for (let port = PORT_MIN; port <= PORT_MAX; port++) {
      if (!usedPorts.has(port)) {
        await db.query(
          `INSERT INTO exposed_ports (mr_id, service, name, internal_port, external_port)
           VALUES ($1, $2, $3, $4, $5)`,
          [mrId, service, name, internalPort, port]
        )
        logger.info(`[port] Port allocated : ${port} for ${service} ${name} (MR:${mrId})`)
        return port
      }
    }

    throw new Error('There is no available port')
  }

  static async releasePorts(mrId: string): Promise<void> {
    await db.query(`DELETE FROM exposed_ports WHERE mr_id = $1`, [mrId])
    logger.info(`[port] Ports released for MR #${mrId}`)
  }

  static async getPortsForMr(mrId: string): Promise<{ [service: string]: number }> {
    const result = await db.query(`SELECT service, external_port FROM exposed_ports WHERE mr_id = $1`, [mrId])
    const map: Record<string, number> = {}
    for (const row of result.rows) {
      map[row.service] = row.external_port
    }
    return map
  }
}
