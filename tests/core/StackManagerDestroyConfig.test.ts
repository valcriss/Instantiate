import { StackManager } from '../../src/core/StackManager'
import fs from 'fs/promises'
import YAML from 'yaml'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { closeLogger } from '../../src/utils/logger'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { StackService } from '../../src/core/StackService'
import * as orchestrators from '../../src/orchestrators'
import { OrchestratorAdapter } from '../../src/orchestrators/OrchestratorAdapter'
import simpleGit from 'simple-git'

jest.mock('fs/promises')
jest.mock('yaml')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')
jest.mock('../../src/core/StackService')
jest.mock('../../src/orchestrators')
jest.mock('simple-git')

const mockFs = fs as jest.Mocked<typeof fs>
const mockYaml = YAML as unknown as { parse: jest.Mock }
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>
const mockStackService = StackService as jest.Mocked<typeof StackService>
const mockGetAdapter = orchestrators.getOrchestratorAdapter as jest.MockedFunction<typeof orchestrators.getOrchestratorAdapter>
const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>

function createFakeGit() {
  return {
    clone: jest.fn().mockResolvedValue(undefined)
  }
}

describe('StackManager.destroy config handling', () => {
  const stackManager = new StackManager()
  const payload: MergeRequestPayload = {
    project_id: 'proj',
    projectName: '',
    mergeRequestName: '',
    mr_id: 'mr-55',
    mr_iid: 'mr-55',
    status: 'closed',
    branch: 'feat',
    repo: 'repo/url',
    sha: 'beef',
    author: 'me',
    full_name: 'me/repo',
    provider: 'github'
  }
  const projectKey = 'key'

  beforeEach(() => {
    jest.clearAllMocks()
    mockGit.mockReturnValue(createFakeGit() as any)
    mockFs.stat.mockRejectedValue(new Error('missing'))
  })

  afterAll(async () => {
    await closeConnection()
    closeLogger()
  })

  it('uses orchestrator from config file', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    mockFs.readFile.mockResolvedValueOnce('yaml')
    mockFs.readFile.mockResolvedValueOnce('compose')
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never)
    mockYaml.parse.mockReturnValueOnce({ orchestrator: 'kubernetes' })
    const adapter: OrchestratorAdapter = {
      up: async () => Promise.resolve(),
      down: jest.fn(),
      checkHealth: async () => 'running'
    }
    mockGetAdapter.mockReturnValueOnce(adapter)
    mockDb.updateMergeRequest.mockResolvedValue()
    mockStackService.remove.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockFs.rm.mockResolvedValue(undefined)

    await stackManager.destroy(payload, projectKey)

    expect(mockGetAdapter).toHaveBeenCalledWith('kubernetes')
    expect(adapter.down).toHaveBeenCalled()
  })

  it('defaults to compose when orchestrator is missing', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    mockFs.readFile.mockResolvedValueOnce('yaml')
    mockFs.readFile.mockResolvedValueOnce('compose')
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never)
    mockYaml.parse.mockReturnValueOnce({})
    const adapter: OrchestratorAdapter = {
      up: async () => Promise.resolve(),
      down: jest.fn(),
      checkHealth: async () => 'running'
    }
    mockGetAdapter.mockReturnValueOnce(adapter)

    await stackManager.destroy(payload, projectKey)

    expect(mockGetAdapter).toHaveBeenCalledWith('compose')
    expect(adapter.down).toHaveBeenCalled()
  })

  it('ignore config read errors', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    mockFs.readFile.mockRejectedValueOnce(new Error('fail'))
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never)
    const adapter: OrchestratorAdapter = {
      up: async () => Promise.resolve(),
      down: jest.fn(),
      checkHealth: async () => 'running'
    }
    mockGetAdapter.mockReturnValueOnce(adapter)
    mockDb.updateMergeRequest.mockResolvedValue()
    mockStackService.remove.mockResolvedValue()
    mockPorts.releasePorts.mockResolvedValue()
    mockFs.rm.mockResolvedValue(undefined)

    await stackManager.destroy(payload, projectKey)

    expect(mockGetAdapter).toHaveBeenCalledWith('compose')
    expect(adapter.down).toHaveBeenCalled()
  })
})
