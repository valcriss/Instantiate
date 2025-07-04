import { PortAllocator } from '../../src/core/PortAllocator'
import db from '../../src/db'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { closeLogger } from '../../src/utils/logger'

jest.mock('../../src/db')

describe('PortAllocator', () => {
  const mockDb = db as jest.Mocked<typeof db>

  const originalPortMin = process.env.PORT_MIN
  const originalPortMax = process.env.PORT_MAX
  const originalExcluded = process.env.EXCLUDED_PORTS

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.PORT_MIN
    delete process.env.PORT_MAX
    delete process.env.EXCLUDED_PORTS
  })

  afterEach(() => {
    if (originalPortMin !== undefined) process.env.PORT_MIN = originalPortMin
    else delete process.env.PORT_MIN
    if (originalPortMax !== undefined) process.env.PORT_MAX = originalPortMax
    else delete process.env.PORT_MAX
    if (originalExcluded !== undefined) process.env.EXCLUDED_PORTS = originalExcluded
    else delete process.env.EXCLUDED_PORTS
  })

  afterAll(async () => {
    await closeConnection()
    closeLogger()
  })

  it('attribue le premier port disponible dans la plage', async () => {
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([10000, 10001]))

    const port = await PortAllocator.allocatePort('valcriss', 'mr-1', 'web', 'WEB_PORT')

    expect(port).toEqual(10002)
    expect(mockDb.addExposedPorts).toHaveBeenCalledWith('valcriss', 'mr-1', 'web', 'WEB_PORT', 0, 10002)
  })

  it('ignore les ports déjà utilisés', async () => {
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([10000, 10001]))

    const port = await PortAllocator.allocatePort('valcriss', 'mr-2', 'api', 'API_PORT')
    expect(port).toBe(10002)
  })

  it('lance une erreur si aucun port libre', async () => {
    // Mock pour allreadyAllocatedPort
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)

    // Mock pour getUsedPorts
    const min = Number(process.env.PORT_MIN ?? '10000')
    const max = Number(process.env.PORT_MAX ?? '11000')
    const used: number[] = []
    for (let p = min; p <= max; p++) used.push(p)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set(used))

    await expect(PortAllocator.allocatePort('valcriss', 'mr-3', 'db', 'BD_PORT')).rejects.toThrow('There is no available port')
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
    const port = await PortAllocator.allocatePort('valcriss', 'mr-4', 'cache', 'CACHE_PORT')

    expect(port).toBe(10005)
    expect(mockDb.allreadyAllocatedPort).toHaveBeenCalledWith('valcriss', 'mr-4', 'cache', 'CACHE_PORT')
  })

  it("utilise les variables d'environnement PORT_MIN et PORT_MAX", async () => {
    process.env.PORT_MIN = '20000'
    process.env.PORT_MAX = '20005'
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([20000, 20001]))

    const port = await PortAllocator.allocatePort('valcriss', 'mr-env', 'svc', 'SVC_PORT')

    expect(port).toBe(20002)
    expect(mockDb.addExposedPorts).toHaveBeenCalledWith('valcriss', 'mr-env', 'svc', 'SVC_PORT', 0, 20002)
  })

  it('exclut les ports listés dans EXCLUDED_PORTS', async () => {
    process.env.EXCLUDED_PORTS = '10002,10003'
    mockDb.allreadyAllocatedPort.mockResolvedValueOnce(null)
    mockDb.getUsedPorts.mockResolvedValueOnce(new Set([10000, 10001]))

    const port = await PortAllocator.allocatePort('valcriss', 'mr-ex', 'svc', 'SVC_PORT')

    expect(port).toBe(10004)
    expect(mockDb.addExposedPorts).toHaveBeenCalledWith('valcriss', 'mr-ex', 'svc', 'SVC_PORT', 0, 10004)
  })
})
