import { StackManager } from '../../src/core/StackManager'
import simpleGit from 'simple-git'
import fs from 'fs/promises'
import YAML from 'yaml'
import { TemplateEngine } from '../../src/core/TemplateEngine'
import { DockerComposeAdapter } from '../../src/orchestrators/DockerComposeAdapter'
import { KubernetesAdapter } from '../../src/orchestrators/KubernetesAdapter'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { PathLike, Stats } from 'fs'
import logger, { closeLogger } from '../../src/utils/logger'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import * as ioUtils from '../../src/utils/ioUtils'
import { GitHubCommenter } from '../../src/comments/GitHubCommenter'
import { execa, type ResultPromise } from 'execa'

jest.mock('simple-git')
jest.mock('fs/promises')
jest.mock('yaml')
jest.mock('../../src/core/TemplateEngine')
jest.mock('../../src/orchestrators/DockerComposeAdapter')
jest.mock('../../src/orchestrators/KubernetesAdapter')
jest.mock('../../src/db')
jest.mock('../../src/core/PortAllocator')
jest.mock('execa')

const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>
const mockFs = fs as jest.Mocked<typeof fs>
const mockYaml = YAML as unknown as { parse: jest.Mock }
const mockTemplateEngine = TemplateEngine as jest.Mocked<typeof TemplateEngine>
const mockDocker = DockerComposeAdapter as unknown as jest.MockedClass<typeof DockerComposeAdapter>
const mockK8s = KubernetesAdapter as unknown as jest.MockedClass<typeof KubernetesAdapter>
const mockDb = db as jest.Mocked<typeof db>
const mockPorts = PortAllocator as jest.Mocked<typeof PortAllocator>
const mockedExeca = execa as jest.MockedFunction<typeof execa>

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
    delete process.env.HOST_DOMAIN
    delete process.env.HOST_SCHEME
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

    // Mock lecture du fichier YAML (config et stack)
    mockFs.readFile.mockResolvedValue('fake-yaml-content')
    mockYaml.parse.mockReturnValue({
      services: {
        web: { ports: 1 },
        api: { ports: 1 }
      }
    })

    // Mock ports dynamiques
    mockPorts.allocatePort.mockResolvedValueOnce(10001).mockResolvedValueOnce(10002)

    // Mock template + docker
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
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
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('valcriss', 'mr-42', 'web', 'WEB_PORT')
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('valcriss', 'mr-42', 'api', 'API_PORT')

    expect(mockTemplateEngine.renderToFile).toHaveBeenCalledWith(
      expect.stringContaining('docker-compose.yml'),
      expect.stringContaining('docker-compose.yml'),
      expect.objectContaining({
        WEB_PORT: 10001,
        API_PORT: 10002,
        PROJECT_KEY: projectKey,
        MR_ID: 'mr-42',
        HOST_DOMAIN: 'localhost',
        HOST_SCHEME: 'http',
        HOST_DNS: 'http://localhost'
      })
    )

    expect(mockDocker.prototype.up).toHaveBeenCalled()
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

  it('uses repository credentials when cloning the main repo', async () => {
    process.env.REPOSITORY_GITHUB_USERNAME = 'user'
    process.env.REPOSITORY_GITHUB_TOKEN = 'secret'
    const urlPayload: MergeRequestPayload = {
      ...payload,
      repo: 'https://github.com/test/repo.git'
    }

    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)
    const commentSpy = jest.spyOn(GitHubCommenter.prototype, 'postStatusComment').mockResolvedValue()
    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({})
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(urlPayload, projectKey)

    expect(fakeGit.clone).toHaveBeenCalledWith('https://user:secret@github.com/test/repo.git', expect.any(String), ['--branch', urlPayload.branch])

    commentSpy.mockRestore()
    delete process.env.REPOSITORY_GITHUB_USERNAME
    delete process.env.REPOSITORY_GITHUB_TOKEN
  })

  it('does not duplicate credentials if repo already contains them', async () => {
    process.env.REPOSITORY_GITHUB_USERNAME = 'user'
    process.env.REPOSITORY_GITHUB_TOKEN = 'secret'
    const urlPayload: MergeRequestPayload = {
      ...payload,
      repo: 'https://user:secret@github.com/test/repo.git'
    }

    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)
    const commentSpy = jest.spyOn(GitHubCommenter.prototype, 'postStatusComment').mockResolvedValue()
    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({})
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(urlPayload, projectKey)

    expect(fakeGit.clone).toHaveBeenCalledWith('https://user:secret@github.com/test/repo.git', expect.any(String), ['--branch', urlPayload.branch])

    commentSpy.mockRestore()
    delete process.env.REPOSITORY_GITHUB_USERNAME
    delete process.env.REPOSITORY_GITHUB_TOKEN
  })

  it('clones repositories from config and injects their paths', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@github.com:org/backend.git', branch: 'develop' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@github.com:org/backend.git', expect.stringContaining('/backend'), ['--branch', 'develop'])
    expect(mockTemplateEngine.renderToFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ BACKEND_PATH: expect.stringContaining('/backend') })
    )
  })

  it('uses match behavior when branch exists', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn().mockResolvedValue('something') }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@github.com:org/backend.git', branch: 'develop', behavior: 'match' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(fakeGit.listRemote).toHaveBeenCalled()
    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@github.com:org/backend.git', expect.stringContaining('/backend'), ['--branch', payload.branch])
  })

  it('falls back to defined branch when match branch is missing', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn().mockResolvedValue('') }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@github.com:org/backend.git', branch: 'develop', behavior: 'match' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(fakeGit.listRemote).toHaveBeenCalled()
    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@github.com:org/backend.git', expect.stringContaining('/backend'), ['--branch', 'develop'])
  })

  it('injects credentials when provider is gitlab', async () => {
    process.env.REPOSITORY_GITLAB_USERNAME = 'gluser'
    process.env.REPOSITORY_GITLAB_TOKEN = 'glsecret'
    const gitlabPayload: MergeRequestPayload = {
      ...payload,
      provider: 'gitlab',
      repo: 'https://gitlab.com/test/repo.git'
    }

    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({})
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(gitlabPayload, projectKey)

    expect(fakeGit.clone).toHaveBeenCalledWith('https://gluser:glsecret@gitlab.com/test/repo.git', expect.any(String), ['--branch', gitlabPayload.branch])

    delete process.env.REPOSITORY_GITLAB_USERNAME
    delete process.env.REPOSITORY_GITLAB_TOKEN
  })

  it('clones side repo without branch using default', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@github.com:org/backend.git' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@github.com:org/backend.git', expect.stringContaining('/backend'), [])
  })

  it('clones side repo for gitlab provider with injected credentials', async () => {
    process.env.REPOSITORY_GITLAB_USERNAME = 'gluser'
    process.env.REPOSITORY_GITLAB_TOKEN = 'glsecret'
    const gitlabPayload: MergeRequestPayload = {
      ...payload,
      provider: 'gitlab',
      repo: 'https://gitlab.com/test/repo.git'
    }

    const fakeGit = {
      clone: jest.fn().mockResolvedValue(undefined),
      listRemote: jest.fn()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@gitlab.com:org/backend.git' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(gitlabPayload, projectKey)

    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@gitlab.com:org/backend.git', expect.stringContaining('/backend'), [])

    delete process.env.REPOSITORY_GITLAB_USERNAME
    delete process.env.REPOSITORY_GITLAB_TOKEN
  })

  it('allocates multiple ports when service ports > 1', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({ services: { web: { ports: 2 } } })

    mockPorts.allocatePort.mockResolvedValueOnce(10001).mockResolvedValueOnce(10002)

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(mockPorts.allocatePort).toHaveBeenNthCalledWith(1, payload.project_id, payload.mr_id, 'web', 'WEB_PORT_1')
    expect(mockPorts.allocatePort).toHaveBeenNthCalledWith(2, payload.project_id, payload.mr_id, 'web', 'WEB_PORT_2')
  })

  it('runs prebuild commands for local service', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({ services: { front: { prebuild: { image: 'node:23', commands: ['npm i'] } } } })

    const EventEmitter = (await import('events')).EventEmitter
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const promise = new Promise((resolve) => {
      process.nextTick(() => {
        stdout.emit('data', Buffer.from('out'))
        stderr.emit('data', Buffer.from('err'))
        resolve(undefined)
      })
    })
    const child = Object.assign(promise, { stdout, stderr }) as unknown as ResultPromise
    mockedExeca.mockReturnValueOnce(child)
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(mockedExeca).toHaveBeenCalledWith('docker', ['run', '--rm', '-v', expect.stringContaining(':/app'), '-w', '/app', 'node:23', 'sh', '-c', 'npm i'])
  })

  it('runs prebuild commands in repository directory', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: {
          repository: { repo: 'git@github.com:org/backend.git' },
          prebuild: { image: 'node:23', mountpath: '/src', commands: ['npm i'] }
        }
      }
    })

    const EventEmitter = (await import('events')).EventEmitter
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const promise = new Promise((resolve) => {
      process.nextTick(() => {
        stdout.emit('data', Buffer.from('out'))
        stderr.emit('data', Buffer.from('err'))
        resolve(undefined)
      })
    })
    const child = Object.assign(promise, { stdout, stderr }) as unknown as ResultPromise
    mockedExeca.mockReturnValueOnce(child)
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())

    await stackManager.deploy(payload, projectKey)

    expect(mockedExeca).toHaveBeenCalledWith('docker', [
      'run',
      '--rm',
      '-v',
      expect.stringContaining('/backend:/src'),
      '-w',
      '/src',
      'node:23',
      'sh',
      '-c',
      'npm i'
    ])
  })

  it('handles listRemote errors gracefully', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined), listRemote: jest.fn().mockRejectedValue(new Error('fail')) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        backend: { repository: { repo: 'git@github.com:org/backend.git', behavior: 'match' } }
      }
    })

    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()
    mockFs.stat.mockResolvedValue({} as Stats)
    mockDb.getUsedPorts.mockResolvedValue(new Set())
    const logSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {})

    await stackManager.deploy(payload, projectKey)

    expect(fakeGit.listRemote).toHaveBeenCalled()
    expect(fakeGit.clone).toHaveBeenNthCalledWith(2, 'git@github.com:org/backend.git', expect.stringContaining('/backend'), [])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Side repo listRemote failed'))
    logSpy.mockRestore()
  })

  it("utilise simpleGit avec l'option sslVerify=false quand IGNORE_SSL_ERRORS est a true", async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    process.env.IGNORE_SSL_ERRORS = 'true'
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGit.mockReturnValue(fakeGit as any)
    mockFs.stat.mockResolvedValue({} as Stats)
    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({})
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.prototype.up.mockResolvedValue()

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

    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({
      services: {
        web: { ports: 1 }
      }
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
    expect(mockDocker.prototype.up).not.toHaveBeenCalled()
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
    expect(mockDocker.prototype.up).not.toHaveBeenCalled()
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

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to find the stack template file'))
    expect(mockDocker.prototype.up).not.toHaveBeenCalled()
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

describe('StackManager additional branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.HOST_DOMAIN
    delete process.env.HOST_SCHEME
  })

  it('deploys using kubernetes orchestrator without exposed ports', async () => {
    delete process.env.REPOSITORY_GITHUB_TOKEN
    const stackManager = new StackManager()
    const payload: MergeRequestPayload = {
      project_id: 'proj',
      projectName: '',
      mergeRequestName: '',
      mr_id: 'mr-77',
      mr_iid: 'mr-77',
      status: 'open',
      branch: 'feat',
      repo: 'repo/url',
      sha: 'deadbeef',
      author: 'me',
      full_name: 'me/repo',
      provider: 'github'
    }

    mockFs.stat.mockResolvedValue({} as Stats)
    mockFs.readFile.mockResolvedValue('yaml')
    mockYaml.parse.mockReturnValue({ orchestrator: 'kubernetes' })
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockK8s.prototype.up.mockResolvedValue()

    const hostDns = await stackManager.deploy(payload, 'key')

    expect(mockK8s.prototype.up).toHaveBeenCalled()
    expect(mockPorts.allocatePort).not.toHaveBeenCalled()
    expect(mockTemplateEngine.renderToFile).toHaveBeenCalledWith(expect.stringContaining('all.yml'), expect.any(String), expect.any(Object))
    expect(hostDns).toContain('http')
  })
})
