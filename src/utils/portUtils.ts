import execa from '../docker/execaWrapper'
import net from 'net'
import logger from './logger'

const DOCKER_PS_ARGS = ['ps', '--format', '{{.Ports}}']

const parseRange = (range: string): number[] => {
  const [startRaw, endRaw] = range.split('-')
  const start = Number.parseInt(startRaw, 10)
  const end = Number.parseInt(endRaw, 10)

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return []
  }

  const [min, max] = start <= end ? [start, end] : [end, start]
  const ports: number[] = []
  for (let port = min; port <= max; port++) {
    ports.push(port)
  }

  return ports
}

const collectHostPorts = (segment: string, accumulator: Set<number>) => {
  if (!segment.includes('->')) return
  const [hostPart] = segment.split('->')
  const rawPort = hostPart.split(':').pop()?.trim()
  if (!rawPort) return

  if (rawPort.includes('-')) {
    for (const port of parseRange(rawPort)) {
      accumulator.add(port)
    }
    return
  }

  const port = Number.parseInt(rawPort, 10)
  if (!Number.isNaN(port)) {
    accumulator.add(port)
  }
}

export const getDockerExposedPorts = async (): Promise<Set<number>> => {
  try {
    const { stdout } = await execa('docker', DOCKER_PS_ARGS)
    if (!stdout) {
      return new Set()
    }

    const ports = new Set<number>()
    const lines = stdout.split('\n').map((line) => line.trim())

    for (const line of lines) {
      if (!line) continue
      const segments = line.split(',')
      for (const segment of segments) {
        collectHostPorts(segment.trim(), ports)
      }
    }

    return ports
  } catch (error) {
    logger.debug({ error }, '[port] Unable to read docker host ports, assuming none are exposed')
    return new Set()
  }
}

export const isHostPortFree = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()

    const finish = (result: boolean) => {
      server.removeAllListeners('error')
      resolve(result)
    }

    server.once('error', () => {
      finish(false)
    })

    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      server.close(() => {
        finish(true)
      })
    })
  })
}

export const isPortFree = async (port: number, dockerPorts?: Set<number>): Promise<boolean> => {
  const exposedPorts = dockerPorts ?? (await getDockerExposedPorts())
  if (exposedPorts.has(port)) {
    return false
  }

  return await isHostPortFree(port)
}

export default isPortFree
