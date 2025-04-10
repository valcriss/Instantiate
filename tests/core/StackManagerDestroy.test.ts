import { StackManager } from '../../src/core/StackManager'
import { DockerService } from '../../src/docker/DockerService'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

jest.mock('../../src/docker/DockerService')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')

const mockDocker = DockerService as jest.Mocked<typeof DockerService>
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>

describe('StackManager.destroy', () => {
  const stackManager = new StackManager()

  const payload = {
    mr_id: 'mr-99',
    status: 'closed',
    branch: 'fix/crash',
    repo: 'valcriss/crashy',
    sha: 'deadbeef999',
    author: 'valcriss'
  }

  const projectKey = 'destroy-test'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('supprime la stack et libère les ports', async () => {
    mockDocker.down.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockDb.query.mockResolvedValue({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] })

    await stackManager.destroy(payload as MergeRequestPayload, projectKey)

    // ✅ Vérifie l’arrêt de Docker
    expect(mockDocker.down).toHaveBeenCalledWith(
      expect.stringContaining('instantiate'),
      `mr-${payload.mr_id}`
    )

    // ✅ Vérifie la libération des ports
    expect(mockPorts.releasePorts).toHaveBeenCalledWith(payload.mr_id)

    // ✅ Vérifie la mise à jour en base
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE merge_requests'),
      ['closed', payload.mr_id]
    )
  })

  it('log et relance une erreur si une étape échoue (ex: docker down)', async () => {
    const stackManager = new StackManager()
  
    mockDocker.down.mockRejectedValueOnce(new Error('docker down fail'))
  
    const payload = {
      mr_id: 'mr-error',
      status: 'closed',
      branch: 'hotfix',
      repo: 'valcriss/downfail',
      sha: 'failsha',
      author: 'failbot'
    }
  
    await expect(stackManager.destroy(payload as MergeRequestPayload, 'key')).rejects.toThrow('docker down fail')
  
    expect(mockDocker.down).toHaveBeenCalled()
    expect(mockPorts.releasePorts).not.toHaveBeenCalled()
    expect(mockDb.query).not.toHaveBeenCalled()
  })
  
})
