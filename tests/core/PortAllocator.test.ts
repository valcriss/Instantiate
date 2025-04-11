import { PortAllocator } from '../../src/core/PortAllocator'
import db from '../../src/db'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { closeLogger } from '../../src/utils/logger'

jest.mock('../../src/db')

describe('PortAllocator', () => {
  const mockDb = db as jest.Mocked<typeof db>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await closeConnection()
    await closeLogger()
  })

  it('attribue le premier port disponible dans la plage', async () => {
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)

    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([10000, 10001]))

    const port = await PortAllocator.allocatePort('valcriss', 'mr-1', 'web', 'WEB_PORT', 3000)

    expect(port).toEqual(10002)
    expect(mockDb.addExposedPorts).toHaveBeenCalledWith('valcriss', 'mr-1', 'web', 'WEB_PORT', 3000, 10002)
  })

  it('ignore les ports déjà utilisés', async () => {
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([10000, 10001])) // insert sur 10002

    const port = await PortAllocator.allocatePort('valcriss', 'mr-2', 'api', 'API_PORT', 8000)
    expect(port).toBe(10002)
  })

  it('lance une erreur si aucun port libre', async () => {
    // Mock pour allreadyAllocatedPort
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)

    // Mock pour getUsedPorts
    const used: number[] = []
    for (let p = 10000; p <= 11000; p++) used.push(p)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set(used))

    await expect(PortAllocator.allocatePort('valcriss', 'mr-3', 'db', 'BD_PORT', 5432)).rejects.toThrow('There is no available port')
  })

  it('supprime tous les ports d’une MR via releasePorts', async () => {
    await PortAllocator.releasePorts('valcriss', 'mr-123')
    expect(mockDb.releasePorts).toHaveBeenCalledWith('valcriss', 'mr-123')
  })

  it('retourne les ports alloués à une MR', async () => {
    mockDb.getPortsForMr.mockResolvedValueOnce({ web: 10101, db: 10102 })

    const result = await PortAllocator.getPortsForMr('valcriss', 'mr-x')
    expect(result).toEqual({ web: 10101, db: 10102 })
  })

  it('retourne le port déjà alloué si allreadyAllocatedPort retourne une valeur', async () => {
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(10005)
    const port = await PortAllocator.allocatePort('valcriss', 'mr-4', 'cache', 'CACHE_PORT', 6379)

    expect(port).toBe(10005)
    expect(mockDb.allreadyAllocatedPort).toHaveBeenCalledWith('valcriss', 'mr-4', 'cache', 'CACHE_PORT')
  })
})
