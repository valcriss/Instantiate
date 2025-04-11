import { Pool } from 'pg'
import db from '../../src/db'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

jest.mock('pg', () => {
  const mClient = { query: jest.fn(), connect: jest.fn() }
  const mPool = jest.fn(() => mClient)
  return { Pool: mPool }
})

describe('db/index.ts', () => {
  it('appelle pool.connect', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.connect.mockResolvedValueOnce('mockClient')

    const client = await db.getClient()
    expect(mockPoolInstance.connect).toHaveBeenCalled()
    expect(client).toBe('mockClient')
  })

  it('getUsedPorts retourne un ensemble de ports utilisés', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const mockQueryResult = { rows: [{ external_port: 3000 }, { external_port: 3001 }] }
    mockPoolInstance.query.mockResolvedValueOnce(mockQueryResult)

    const usedPorts = await db.getUsedPorts()
    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT external_port FROM exposed_ports')
    expect(usedPorts).toEqual(new Set([3000, 3001]))
  })

  it('updateMergeRequest insère ou met à jour une merge request', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const payload: MergeRequestPayload = {
      project_id: '123',
      mr_id: '456',
      repo: 'test-repo',
      status: 'open',
      branch: 'main',
      sha: 'abc123',
      author: 'test-author'
    }
    const state = 'open'

    await db.updateMergeRequest(payload, state)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(
      `\n      INSERT INTO merge_requests (project_id, mr_id, repo, status, created_at, updated_at)\n      VALUES ($1, $2, $3, $4, NOW(), NOW())\n      ON CONFLICT (project_id, mr_id) DO UPDATE\n      SET status = $4, updated_at = NOW()\n      `,
      [payload.project_id, payload.mr_id, payload.repo, payload.status]
    )
  })

  it('allreadyAllocatedPort retourne le port déjà alloué si disponible', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const mockQueryResult = { rows: [{ external_port: 8080 }] }
    mockPoolInstance.query.mockResolvedValueOnce(mockQueryResult)

    const projectId = '123'
    const mrId = '456'
    const service = 'test-service'
    const name = 'test-name'

    const allocatedPort = await db.allreadyAllocatedPort(projectId, mrId, service, name)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(
      `SELECT external_port FROM exposed_ports WHERE project_id= $1 AND mr_id = $2 AND service = $3 AND name = $4`,
      [projectId, mrId, service, name]
    )
    expect(allocatedPort).toBe(8080)
  })

  it("allreadyAllocatedPort retourne null si aucun port n'est alloué", async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const mockQueryResult = { rows: [] }
    mockPoolInstance.query.mockResolvedValueOnce(mockQueryResult)

    const projectId = '123'
    const mrId = '456'
    const service = 'test-service'
    const name = 'test-name'

    const allocatedPort = await db.allreadyAllocatedPort(projectId, mrId, service, name)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(
      `SELECT external_port FROM exposed_ports WHERE project_id= $1 AND mr_id = $2 AND service = $3 AND name = $4`,
      [projectId, mrId, service, name]
    )
    expect(allocatedPort).toBeNull()
  })

  it('getPortsForMr retourne une map des ports pour une MR donnée', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const mockQueryResult = {
      rows: [
        { service: 'service1', external_port: 3000 },
        { service: 'service2', external_port: 3001 }
      ]
    }
    mockPoolInstance.query.mockResolvedValueOnce(mockQueryResult)

    const projectId = '123'
    const mrId = '456'

    const portsMap = await db.getPortsForMr(projectId, mrId)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(`SELECT service, external_port FROM exposed_ports WHERE project_id = $1 AND mr_id = $2`, [
      projectId,
      mrId
    ])
    expect(portsMap).toEqual({ service1: 3000, service2: 3001 })
  })

  it('addExposedPorts insère un port exposé dans la base de données', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value

    const projectId = '123'
    const mrId = '456'
    const service = 'test-service'
    const name = 'test-name'
    const internalPort = 8080
    const externalPort = 3000

    await db.addExposedPorts(projectId, mrId, service, name, internalPort, externalPort)
    expect(mockPoolInstance.query).toHaveBeenCalled()
  })

  it('releasePorts supprime les ports exposés pour un projet et une MR donnés', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value

    const projectId = '123'
    const mrId = '456'

    await db.releasePorts(projectId, mrId)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(`DELETE FROM exposed_ports WHERE project_id = $1 AND mr_id = $2`, [projectId, mrId])
  })
})
