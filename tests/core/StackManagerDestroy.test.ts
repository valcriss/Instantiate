import { StackManager } from '../../src/core/StackManager'
import { DockerComposeAdapter } from '../../src/orchestrators/DockerComposeAdapter'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { closeLogger } from '../../src/utils/logger'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { StackService } from '../../src/core/StackService'
import simpleGit, { SimpleGit } from 'simple-git'

jest.mock('../../src/orchestrators/DockerComposeAdapter')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')
jest.mock('simple-git')
jest.mock('../../src/core/StackService')

const mockDocker = DockerComposeAdapter as unknown as jest.MockedClass<typeof DockerComposeAdapter>
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>
const mockStackService = StackService as jest.Mocked<typeof StackService>
const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>

function createFakeGit(): SimpleGit {
  return {
    clone: jest.fn().mockResolvedValue(undefined)
  } as unknown as SimpleGit
}

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
    mockGit.mockReturnValue(createFakeGit())
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
    expect(mockDocker.prototype.down).toHaveBeenCalled()

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

  it('injecte les identifiants lorsque le provider est gitlab', async () => {
    process.env.REPOSITORY_GITLAB_USERNAME = 'gluser'
    process.env.REPOSITORY_GITLAB_TOKEN = 'glsecret'
    const gitlabPayload: MergeRequestPayload = {
      ...payload,
      provider: 'gitlab',
      repo: 'https://gitlab.com/test/repo.git'
    }
    const fakeGit = createFakeGit()
    mockGit.mockReturnValue(fakeGit)
    mockDocker.prototype.down.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockDb.updateMergeRequest.mockResolvedValue()
    mockStackService.remove.mockResolvedValue()
    jest
      .spyOn(
        stackManager as unknown as {
          loadConfiguration: (...args: unknown[]) => Promise<unknown>
        },
        'loadConfiguration'
      )
      .mockResolvedValueOnce({
        orchestrator: 'compose',
        composeInput: '/tmp/i',
        config: {}
      })
    mockPorts.getPortsForMr.mockResolvedValueOnce({})
    jest
      .spyOn(
        stackManager as unknown as {
          cloneRepositories: (...args: unknown[]) => Promise<unknown>
        },
        'cloneRepositories'
      )
      .mockResolvedValueOnce({})
    jest
      .spyOn(
        stackManager as unknown as {
          renderComposeFile: (...args: unknown[]) => Promise<void>
        },
        'renderComposeFile'
      )
      .mockResolvedValueOnce(Promise.resolve())

    await stackManager.destroy(gitlabPayload, projectKey)

    expect(fakeGit.clone).toHaveBeenCalledWith('https://gluser:glsecret@gitlab.com/test/repo.git', expect.any(String), ['--branch', gitlabPayload.branch])

    delete process.env.REPOSITORY_GITLAB_USERNAME
    delete process.env.REPOSITORY_GITLAB_TOKEN
  })

  it("utilise simpleGit avec l'option sslVerify=false quand IGNORE_SSL_ERRORS est a true", async () => {
    process.env.IGNORE_SSL_ERRORS = 'true'
    const fakeGit = createFakeGit()
    mockGit.mockReturnValue(fakeGit)
    mockDocker.prototype.down.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockDb.updateMergeRequest.mockResolvedValue()
    mockStackService.remove.mockResolvedValue()
    jest
      .spyOn(
        stackManager as unknown as {
          loadConfiguration: (...args: unknown[]) => Promise<unknown>
        },
        'loadConfiguration'
      )
      .mockResolvedValueOnce(null)

    await stackManager.destroy(payload as MergeRequestPayload, projectKey)

    expect(mockGit).toHaveBeenCalledWith({ config: ['http.sslVerify=false'] })
    process.env.IGNORE_SSL_ERRORS = ''
  })

  it('lance une erreur si le dossier de travail est impossible à créer', async () => {
    const spy = jest
      .spyOn(
        stackManager as unknown as {
          prepareTmpDir: (...args: unknown[]) => Promise<boolean>
        },
        'prepareTmpDir'
      )
      .mockResolvedValueOnce(false)

    await expect(stackManager.destroy(payload as MergeRequestPayload, projectKey)).rejects.toThrow('Unable to recreate working directory')

    spy.mockRestore()
  })
})
