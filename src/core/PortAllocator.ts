import db from '../db'
import logger from '../utils/logger'

const DEFAULT_PORT_MIN = 10000
const DEFAULT_PORT_MAX = 11000

export class PortAllocator {
  private static get portMin(): number {
    return parseInt(process.env.PORT_MIN ?? DEFAULT_PORT_MIN.toString(), 10)
  }

  private static get portMax(): number {
    return parseInt(process.env.PORT_MAX ?? DEFAULT_PORT_MAX.toString(), 10)
  }

  private static get excludedPorts(): Set<number> {
    const raw = process.env.EXCLUDED_PORTS
    if (!raw) return new Set()
    return new Set(
      raw
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => parseInt(p, 10))
        .filter((p) => !Number.isNaN(p))
    )
  }
  static async allocatePort(projectId: string, mrId: string, service: string, name: string): Promise<number> {
    const alreadyAllocatedPort = await db.allreadyAllocatedPort(projectId, mrId, service, name)
    if (alreadyAllocatedPort) {
      logger.info(`[port] Port already allocated : ${alreadyAllocatedPort} for ${service} ${name} (MR:${mrId})`)
      return alreadyAllocatedPort
    }
    const usedPorts = await db.getUsedPorts()
    const excludedPorts = PortAllocator.excludedPorts
    const min = PortAllocator.portMin
    const max = PortAllocator.portMax
    for (let port = min; port <= max; port++) {
      if (!usedPorts.has(port) && !excludedPorts.has(port)) {
        await db.addExposedPorts(projectId, mrId, service, name, 0, port)
        logger.info(`[port] Port allocated : ${port} for ${service} ${name} (MR:${mrId})`)
        return port
      }
    }

    throw new Error('There is no available port')
  }

  static async releasePorts(projectId: string, mrId: string): Promise<void> {
    await db.releasePorts(projectId, mrId)
    logger.info(`[port] Ports released for MR #${mrId}`)
  }

  static async getPortsForMr(projectId: string, mrId: string): Promise<{ [service: string]: number }> {
    return await db.getPortsForMr(projectId, mrId)
  }
}
