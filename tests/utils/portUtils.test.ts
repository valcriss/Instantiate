import net, { AddressInfo } from 'net'
import execa from '../../src/docker/execaWrapper'
import * as portUtils from '../../src/utils/portUtils'

jest.mock('../../src/docker/execaWrapper')

const mockExeca = execa as jest.Mock

describe('portUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('analyse correctement les ports exposés par Docker', async () => {
    mockExeca.mockResolvedValue({
      stdout:
        '0.0.0.0:80->80/tcp, :::80->80/tcp, 80/tcp, 0.0.0.0:abc-def->90/tcp, 0.0.0.0:abc->70/tcp, ::->100/tcp\n\n0.0.0.0:8080->8080/tcp\n0.0.0.0:3000-3002->3000-3002/tcp'
    })

    const ports = await portUtils.getDockerExposedPorts()

    expect(Array.from(ports).sort((a, b) => a - b)).toEqual([80, 3000, 3001, 3002, 8080])
  })

  it('gère les plages inversées dans la sortie Docker', async () => {
    mockExeca.mockResolvedValue({ stdout: '0.0.0.0:5-3->5-3/tcp' })

    const ports = await portUtils.getDockerExposedPorts()

    expect(Array.from(ports).sort((a, b) => a - b)).toEqual([3, 4, 5])
  })

  it('retourne un ensemble vide si la commande Docker échoue', async () => {
    mockExeca.mockRejectedValue(new Error('docker unavailable'))

    const ports = await portUtils.getDockerExposedPorts()

    expect(ports.size).toBe(0)
  })

  it("détecte qu'un port est occupé via la liste Docker", async () => {
    const available = await portUtils.isPortFree(80, new Set([80]))
    expect(available).toBe(false)
  })

  it("interroge l'hôte quand le port n'est pas dans la liste Docker", async () => {
    const hostSpy = jest.spyOn(portUtils, 'isHostPortFree').mockResolvedValueOnce(true)

    const free = await portUtils.isPortFree(12345, new Set())

    expect(free).toBe(true)
    expect(hostSpy).toHaveBeenCalledWith(12345)
    hostSpy.mockRestore()
  })

  it("récupère les ports Docker quand aucun ensemble n'est fourni", async () => {
    mockExeca.mockResolvedValue({ stdout: '' })
    const hostSpy = jest.spyOn(portUtils, 'isHostPortFree').mockResolvedValueOnce(true)

    const free = await portUtils.isPortFree(23456)

    expect(free).toBe(true)
    expect(mockExeca).toHaveBeenCalledTimes(1)
    expect(hostSpy).toHaveBeenCalledWith(23456)
    hostSpy.mockRestore()
  })

  it("indique correctement si un port est libre sur l'hôte", async () => {
    const server = net.createServer()

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen({ port: 0, host: '0.0.0.0' }, resolve)
    })

    const { port } = server.address() as AddressInfo

    const busy = await portUtils.isHostPortFree(port)
    expect(busy).toBe(false)

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const free = await portUtils.isHostPortFree(port)
    expect(free).toBe(true)
  })
})
