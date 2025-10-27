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
      projectName: '',
      mergeRequestName: '',
      project_id: '123',
      mr_id: '456',
      mr_iid: '456',
      repo: 'test-repo',
      status: 'open',
      branch: 'main',
      sha: 'abc123',
      author: 'test-author',
      full_name: 'test-full-name',
      provider: 'github'
    }
    const state = 'open'

    mockPoolInstance.query.mockClear() // Clear previous calls to avoid interference

    await db.updateMergeRequest(payload, state)

    expect(mockPoolInstance.query).toHaveBeenCalledTimes(1) // Ensure only one query is made
    expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('last_commit_sha'), [
      payload.project_id,
      payload.mr_id,
      payload.projectName,
      payload.mergeRequestName,
      payload.repo,
      state,
      payload.sha
    ])
  })

  it('getMergeRequestCommitSha retourne le dernier sha ou null', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ last_commit_sha: 'abc123' }] })

    const sha = await db.getMergeRequestCommitSha('1', '2')
    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT last_commit_sha FROM merge_requests WHERE project_id = $1 AND mr_id = $2', ['1', '2'])
    expect(sha).toBe('abc123')

    mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ last_commit_sha: null }] })
    const nullSha = await db.getMergeRequestCommitSha('1', '4')
    expect(nullSha).toBeNull()

    mockPoolInstance.query.mockResolvedValueOnce({ rows: [] })
    const missingSha = await db.getMergeRequestCommitSha('1', '3')
    expect(missingSha).toBeNull()
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

  it('updateExposedPort met à jour le port exposé existant', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockClear()

    await db.updateExposedPort('123', '456', 'test-service', 'test-name', 4242)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(
      `UPDATE exposed_ports SET external_port = $5 WHERE project_id = $1 AND mr_id = $2 AND service = $3 AND name = $4`,
      ['123', '456', 'test-service', 'test-name', 4242]
    )
  })

  it('removeExposedPort supprime une entrée de port exposé', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockClear()

    await db.removeExposedPort('123', '456', 'test-service', 'test-name')

    expect(mockPoolInstance.query).toHaveBeenCalledWith(`DELETE FROM exposed_ports WHERE project_id = $1 AND mr_id = $2 AND service = $3 AND name = $4`, [
      '123',
      '456',
      'test-service',
      'test-name'
    ])
  })

  it('releasePorts supprime les ports exposés pour un projet et une MR donnés', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value

    const projectId = '123'
    const mrId = '456'

    await db.releasePorts(projectId, mrId)

    expect(mockPoolInstance.query).toHaveBeenCalledWith(`DELETE FROM exposed_ports WHERE project_id = $1 AND mr_id = $2`, [projectId, mrId])
  })

  it("getMergeRequestCommentId retourne l'id du commentaire", async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ comment_id: '10' }] })
    const id = await db.getMergeRequestCommentId('1', '2')
    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT comment_id FROM merge_requests WHERE project_id = $1 AND mr_id = $2', ['1', '2'])
    expect(id).toBe('10')
  })

  it('setMergeRequestCommentId met à jour le commentaire', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    await db.setMergeRequestCommentId('1', '2', '3')
    expect(mockPoolInstance.query).toHaveBeenCalledWith('UPDATE merge_requests SET comment_id = $3 WHERE project_id = $1 AND mr_id = $2', ['1', '2', '3'])
  })

  it('updateStackStatus met à jour le statut', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    await db.updateStackStatus('1', '2', 'running')
    expect(mockPoolInstance.query).toHaveBeenCalledWith('UPDATE stacks SET status = $3, updated_at = now() WHERE project_id = $1 AND mr_id = $2', [
      '1',
      '2',
      'running'
    ])
  })

  it("getMergeRequestCommentId retourne null lorsqu'aucun commentaire n'existe", async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    mockPoolInstance.query.mockResolvedValueOnce({ rows: [] })
    const id = await db.getMergeRequestCommentId('1', '2')
    expect(id).toBeNull()
  })

  it('removeStack supprime la stack', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    await db.removeStack('1', '2')
    expect(mockPoolInstance.query).toHaveBeenCalledWith('DELETE FROM stacks WHERE project_id = $1 AND mr_id = $2', ['1', '2'])
  })

  it('saveStack insère ou met à jour une stack', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    await db.saveStack('1', '2', 'p', 'mr', { http: 80 }, 'github', 'running', { self: 'x' })
    expect(mockPoolInstance.query).toHaveBeenCalled()
  })

  it('getAllStacks retourne toutes les stacks formatées', async () => {
    const mockPoolInstance = (Pool as unknown as jest.Mock).mock.results[0].value
    const now = new Date()
    const rows = [
      {
        project_id: '1',
        mr_id: '2',
        project_name: 'p',
        merge_request_name: 'mr',
        ports: { http: 80 },
        provider: 'github',
        status: 'running',
        links: { self: 'x' },
        updated_at: now,
        created_at: now
      }
    ]
    mockPoolInstance.query.mockResolvedValueOnce({ rows })

    const result = await db.getAllStacks()

    expect(mockPoolInstance.query).toHaveBeenCalledWith(`SELECT * FROM stacks ORDER BY created_at DESC`)
    expect(result).toEqual([
      {
        projectId: '1',
        mr_id: '2',
        projectName: 'p',
        mergeRequestName: 'mr',
        ports: { http: 80 },
        provider: 'github',
        status: 'running',
        links: { self: 'x' },
        updatedAt: now.toISOString(),
        createdAt: now.toISOString()
      }
    ])
  })
})
