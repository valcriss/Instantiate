import { PortAllocator } from '../../src/core/PortAllocator'
import db from '../../src/db'

jest.mock('../../src/db')

describe('PortAllocator', () => {
  const mockDb = db as jest.Mocked<typeof db>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('attribue le premier port disponible dans la plage', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] }) // aucun port utilisé

    mockDb.query.mockResolvedValueOnce({ rows: [], command: '', rowCount: 1, oid: 0, fields: [] }) // simulate insert

    const port = await PortAllocator.allocatePort('mr-1', 'web', 3000)

    expect(port).toBeGreaterThanOrEqual(10000)
    expect(port).toBeLessThanOrEqual(11000)
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exposed_ports'),
      expect.arrayContaining(['mr-1', 'web', 3000, port])
    )
  })

  it('ignore les ports déjà utilisés', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ external_port: 10000 }, { external_port: 10001 }],
      command: '',
      rowCount: 2,
      oid: 0,
      fields: []
    }) // ports déjà pris

    mockDb.query.mockResolvedValueOnce({ rows: [], command: '', rowCount: 1, oid: 0, fields: [] }) // insert sur 10002

    const port = await PortAllocator.allocatePort('mr-2', 'api', 8000)
    expect(port).toBe(10002)
  })

  it('lance une erreur si aucun port libre', async () => {
    const used = []
    for (let p = 10000; p <= 11000; p++) used.push({ external_port: p })
    mockDb.query.mockResolvedValueOnce({ rows: used, command: '', rowCount: used.length, oid: 0, fields: [] })

    await expect(
      PortAllocator.allocatePort('mr-3', 'db', 5432)
    ).rejects.toThrow('Aucun port libre disponible')
  })

  it('supprime tous les ports d’une MR via releasePorts', async () => {
    await PortAllocator.releasePorts('mr-123')
    expect(mockDb.query).toHaveBeenCalledWith(
      'DELETE FROM exposed_ports WHERE mr_id = $1',
      ['mr-123']
    )
  })

  it('retourne les ports alloués à une MR', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { service: 'web', external_port: 10101 },
        { service: 'db', external_port: 10102 }
      ],
      command: '',
      rowCount: 2,
      oid: 0,
      fields: []
    })

    const result = await PortAllocator.getPortsForMr('mr-x')
    expect(result).toEqual({ web: 10101, db: 10102 })
  })
})
