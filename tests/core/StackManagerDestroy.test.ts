import { StackManager } from '../../src/core/StackManager'
import { DockerComposeAdapter } from '../../src/orchestrators/DockerComposeAdapter'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { closeLogger } from '../../src/utils/logger'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { StackService } from '../../src/core/StackService'

jest.mock('../../src/orchestrators/DockerComposeAdapter')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')

const mockDocker = DockerComposeAdapter as unknown as jest.MockedClass<typeof DockerComposeAdapter>
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>
const mockStackService = StackService as jest.Mocked<typeof StackService>

describe('StackManager.destroy', () => {
  const stackManager = new StackManager()

  const payload: MergeRequestPayload = {
    project_id: 'valcriss',
    projectName: '',
    mergeRequestName: '',
    mr_id: 'mr-99',
    mr_iid: 'mr-99',
    status: 'closed',
    branch: 'fix/crash',
    repo: 'valcriss/crashy',
    sha: 'deadbeef999',
    author: 'valcriss',
    full_name: 'valcriss/crashy',
    provider: 'github'
  }

  const projectKey = 'destroy-test'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await closeConnection()
    closeLogger()
  })

  it('supprime la stack et libère les ports', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    mockDocker.prototype.down.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockDb.releasePorts.mockResolvedValue()
    mockDb.saveStack.mockResolvedValue()
    await stackManager.destroy(payload as MergeRequestPayload, projectKey)

    // ✅ Vérifie l’arrêt de Docker
    expect(mockDocker.prototype.down).toHaveBeenCalledWith(expect.stringContaining('instantiate'), `${payload.project_id}-mr-${payload.mr_id}`)

    // ✅ Vérifie la libération des ports
    expect(mockPorts.releasePorts).toHaveBeenCalledWith('valcriss', payload.mr_id)

    // ✅ Vérifie la mise à jour en base
    expect(mockDb.updateMergeRequest).toHaveBeenCalledWith(
      {
        author: 'valcriss',
        projectName: '',
        mergeRequestName: '',
        full_name: 'valcriss/crashy',
        provider: 'github',
        branch: 'fix/crash',
        mr_id: 'mr-99',
        mr_iid: 'mr-99',
        project_id: 'valcriss',
        repo: 'valcriss/crashy',
        sha: 'deadbeef999',
        status: 'closed'
      },
      'closed'
    )
  })

  it('log et relance une erreur si une étape échoue (ex: docker down)', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const stackManager = new StackManager()

    mockDocker.prototype.down.mockRejectedValueOnce(new Error('docker down fail'))

    const payload: MergeRequestPayload = {
      project_id: 'valcriss',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-error',
      mr_iid: 'mr-error',
      status: 'closed',
      branch: 'hotfix',
      repo: 'valcriss/downfail',
      sha: 'failsha',
      author: 'failbot',
      full_name: 'valcriss/failrepo',
      provider: 'github'
    }

    await expect(stackManager.destroy(payload as MergeRequestPayload, 'key')).rejects.toThrow('docker down fail')

    expect(mockDocker.prototype.down).toHaveBeenCalled()
    expect(mockPorts.releasePorts).not.toHaveBeenCalled()
    expect(mockDb.updateMergeRequest).not.toHaveBeenCalled()
  })
})
