import { StackManager } from '../../src/core/StackManager'
import simpleGit from 'simple-git'
import fs from 'fs/promises'
import YAML from 'yaml'
import { TemplateEngine } from '../../src/core/TemplateEngine'
import { DockerService } from '../../src/docker/DockerService'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { PathLike, Stats } from 'fs'
import logger, { closeLogger } from '../../src/utils/logger'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import * as ioUtils from '../../src/utils/ioUtils'

jest.mock('simple-git')
jest.mock('fs/promises')
jest.mock('yaml')
jest.mock('../../src/core/TemplateEngine')
jest.mock('../../src/docker/DockerService')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')

const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>
const mockFs = fs as jest.Mocked<typeof fs>
const mockYaml = YAML as unknown as { parse: jest.Mock }
const mockTemplateEngine = TemplateEngine as jest.Mocked<typeof TemplateEngine>
const mockDocker = DockerService as jest.Mocked<typeof DockerService>
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>

describe('StackManager.deploy', () => {
  const stackManager = new StackManager()

  const payload: MergeRequestPayload = {
    project_id: 'valcriss',
    projectName: '',
    mergeRequestName: '',
    mr_id: 'mr-42',
    mr_iid: 'mr-42',
    status: 'open',
    branch: 'feature/test',
    repo: 'valcriss/test-repo',
    sha: 'abcdef123456',
    author: 'valcriss',
    full_name: 'valcriss/test-repo',
    provider: 'github'
  }

  const projectKey = 'test-project'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await closeConnection()
    closeLogger()
  })

  it('orchestre le déploiement complet d’une MR', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    // Mock clone
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    // Mock lecture du fichier YAML
    mockFs.readFile.mockResolvedValueOnce('fake-yaml-content')
    mockYaml.parse.mockReturnValue({
      expose_ports: [
        { service: 'web', name: 'WEB_PORT', port: 3000 },
        { service: 'api', name: 'API_PORT', port: 8000 }
      ]
    })

    // Mock ports dynamiques
    mockPorts.allocatePort.mockResolvedValueOnce(10001).mockResolvedValueOnce(10002)

    // Mock template + docker
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.up.mockResolvedValue()
    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      return {} as Stats // Simulate file exists
    })
    // Mock DB
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    // Run
    await stackManager.deploy(payload as MergeRequestPayload, projectKey)

    // ✅ Assertions clés
    expect(fakeGit.clone).toHaveBeenCalled()
    expect(mockFs.readFile).toHaveBeenCalled()
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('valcriss', 'mr-42', 'web', 'WEB_PORT', 3000)
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('valcriss', 'mr-42', 'api', 'API_PORT', 8000)

    expect(mockTemplateEngine.renderToFile).toHaveBeenCalledWith(
      expect.stringContaining('docker-compose.yml'),
      expect.stringContaining('docker-compose.yml'),
      expect.objectContaining({
        WEB_PORT: 10001,
        API_PORT: 10002,
        PROJECT_KEY: projectKey,
        MR_ID: 'mr-42'
      })
    )

    expect(mockDocker.up).toHaveBeenCalled()
    expect(mockDb.updateMergeRequest).toHaveBeenCalledWith(
      {
        author: 'valcriss',
        projectName: '',
        mergeRequestName: '',
        full_name: 'valcriss/test-repo',
        provider: 'github',
        branch: 'feature/test',
        mr_id: 'mr-42',
        mr_iid: 'mr-42',
        project_id: 'valcriss',
        repo: 'valcriss/test-repo',
        sha: 'abcdef123456',
        status: 'open'
      },
      'open'
    )
  })

  it("utilise simpleGit avec l'option sslVerify=false quand IGNORE_SSL_ERRORS est a true", async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    process.env.IGNORE_SSL_ERRORS = 'true'
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)
    mockFs.stat.mockResolvedValue({} as Stats)
    mockFs.readFile.mockResolvedValueOnce('yaml')
    mockYaml.parse.mockReturnValue({})
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.up.mockResolvedValue()

    await stackManager.deploy(payload, projectKey)

    expect(mockGit).toHaveBeenCalledWith({ config: ['http.sslVerify=false'] })
    process.env.IGNORE_SSL_ERRORS = ''
  })

  it('log et relance une erreur si une étape échoue (ex: substitution template)', async () => {
    const stackManager = new StackManager()
    delete process.env.REPOSITORY_GITHUB_TOKEN
    // Mock tout comme avant
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValueOnce('yaml')
    mockYaml.parse.mockReturnValue({
      expose_ports: [{ service: 'web', port: 3000, name: 'WEB_PORT' }]
    })

    mockPorts.allocatePort.mockResolvedValueOnce(10001)

    // 👇 on force une erreur ici pour déclencher le catch
    mockTemplateEngine.renderToFile.mockRejectedValue(new Error('template fail'))

    await expect(
      stackManager.deploy(
        {
          project_id: 'valcriss',
          projectName: '',
          mergeRequestName: '',
          mr_id: 'mr-crash',
          mr_iid: 'mr-crash',
          status: 'open',
          branch: 'broken',
          repo: 'valcriss/crash',
          sha: 'deadbeef',
          author: 'tester',
          full_name: 'valcriss/crash',
          provider: 'github'
        },
        'fail-project'
      )
    ).rejects.toThrow('template fail')

    expect(mockTemplateEngine.renderToFile).toHaveBeenCalled()
    expect(mockDocker.up).not.toHaveBeenCalled()
  })

  it('log un avertissement et retourne si le fichier config.yml est manquant', async () => {
    const stackManager = new StackManager()
    delete process.env.REPOSITORY_GITHUB_TOKEN
    // Mock tout comme avant
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      if (filePath.toString().includes('config.yml')) {
        throw new Error('File not found xxx') // Simulate missing config.yml
      }
      return {} as Stats // Simulate other files exist
    })

    const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})

    await stackManager.deploy(
      {
        project_id: 'valcriss',
        projectName: '',
        mergeRequestName: '',
        mr_id: 'mr-missing-config',
        mr_iid: 'mr-missing-config',
        status: 'open',
        branch: 'missing-config',
        repo: 'valcriss/missing-config',
        sha: 'deadbeef',
        author: 'tester',
        full_name: 'valcriss/missing-config',
        provider: 'github'
      },
      'missing-config-project'
    )

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to find the configuration file'))
    expect(mockDocker.up).not.toHaveBeenCalled()
    expect(mockDb.addExposedPorts).not.toHaveBeenCalled()

    loggerSpy.mockRestore()
  })

  it('log un avertissement et retourne si le fichier docker-compose.yml est manquant', async () => {
    const stackManager = new StackManager()
    delete process.env.REPOSITORY_GITHUB_TOKEN
    // Mock tout comme avant
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      if (filePath.toString().includes('docker-compose.yml')) {
        throw new Error('File not found') // Simulate missing docker-compose.yml
      }
      return {} as Stats // Simulate other files exist
    })

    const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})

    await stackManager.deploy(
      {
        project_id: 'valcriss',
        projectName: '',
        mergeRequestName: '',
        mr_id: 'mr-missing-compose',
        mr_iid: 'mr-missing-compose',
        status: 'open',
        branch: 'missing-compose',
        repo: 'valcriss/missing-compose',
        sha: 'deadbeef',
        author: 'tester',
        full_name: 'valcriss/missing-compose',
        provider: 'github'
      },
      'missing-compose-project'
    )

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to find the docker-compose file'))
    expect(mockDocker.up).not.toHaveBeenCalled()
    expect(mockDb.addExposedPorts).not.toHaveBeenCalled()

    loggerSpy.mockRestore()
  })

  it('log une erreur et retourne si le dossier temporaire ne peut pas être créé', async () => {
    const stackManager = new StackManager()
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)
    jest.spyOn(ioUtils, 'createDirectory').mockResolvedValueOnce(false)
    jest.spyOn(ioUtils, 'removeDirectory').mockResolvedValueOnce(true)
    mockFs.stat.mockResolvedValue({} as Stats)
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})

    const result = await stackManager.deploy(payload, projectKey)

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to create directory'))
    expect(result).toBeUndefined()
    expect(fakeGit.clone).not.toHaveBeenCalled()
    loggerSpy.mockRestore()
  })
})

describe('StackManager environment variables', () => {
  const originalHostDomain = process.env.HOST_DOMAIN
  const originalHostScheme = process.env.HOST_SCHEME

  afterEach(() => {
    process.env.HOST_DOMAIN = originalHostDomain
    process.env.HOST_SCHEME = originalHostScheme
  })

  it('should use default values when HOST_DOMAIN and HOST_SCHEME are not set', async () => {
    delete process.env.HOST_DOMAIN
    delete process.env.HOST_SCHEME
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const stackManager = new StackManager()
    const payload: MergeRequestPayload = {
      project_id: 'test-project',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-1',
      mr_iid: 'mr-1',
      status: 'open',
      branch: 'main',
      repo: 'test-repo',
      sha: '123456',
      author: 'tester',
      full_name: 'test-repo/test-repo',
      provider: 'github'
    }

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      return {} as Stats
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()

    const hostDns = await stackManager.deploy(payload, 'test-key')

    expect(hostDns).toContain('http://localhost')
  })

  it('should use HOST_DOMAIN when it is set', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    process.env.HOST_DOMAIN = 'custom-domain'
    delete process.env.HOST_SCHEME

    const stackManager = new StackManager()
    const payload: MergeRequestPayload = {
      project_id: 'test-project',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-1',
      mr_iid: 'mr-1',
      status: 'open',
      branch: 'main',
      repo: 'test-repo',
      sha: '123456',
      author: 'tester',
      full_name: 'test-repo/test-repo',
      provider: 'github'
    }

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      return {} as Stats
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()

    const hostDns = await stackManager.deploy(payload, 'test-key')

    expect(hostDns).toContain('http://custom-domain')
  })

  it('should use HOST_SCHEME when it is set', async () => {
    delete process.env.HOST_DOMAIN
    delete process.env.REPOSITORY_GITHUB_TOKEN
    process.env.HOST_SCHEME = 'https'

    const stackManager = new StackManager()
    const payload: MergeRequestPayload = {
      project_id: 'test-project',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-1',
      mr_iid: 'mr-1',
      status: 'open',
      branch: 'main',
      repo: 'test-repo',
      sha: '123456',
      author: 'tester',
      full_name: 'test-repo/test-repo',
      provider: 'github'
    }

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      return {} as Stats
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()

    const hostDns = await stackManager.deploy(payload, 'test-key')

    expect(hostDns).toContain('https://localhost')
  })

  it('should use both HOST_DOMAIN and HOST_SCHEME when they are set', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    process.env.HOST_DOMAIN = 'custom-domain'
    process.env.HOST_SCHEME = 'https'

    const stackManager = new StackManager()
    const payload: MergeRequestPayload = {
      project_id: 'test-project',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-1',
      mr_iid: 'mr-1',
      status: 'open',
      branch: 'main',
      repo: 'test-repo/repo',
      sha: '123456',
      author: 'tester',
      full_name: 'test-repo/repo',
      provider: 'github'
    }

    mockFs.stat.mockImplementation(async (filePath: PathLike) => {
      return {} as Stats
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()

    const hostDns = await stackManager.deploy(payload, 'test-key')

    expect(hostDns).toContain('https://custom-domain')
  })
})
