import { StackManager } from '../../src/core/StackManager'
import simpleGit from 'simple-git'
import fs from 'fs/promises'
import YAML from 'yaml'
import { TemplateEngine } from '../../src/core/TemplateEngine'
import { DockerService } from '../../src/docker/DockerService'
import db from '../../src/db'
import { PortAllocator } from '../../src/core/PortAllocator'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

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

  const payload = {
    mr_id: 'mr-42',
    status: 'open',
    branch: 'feature/test',
    repo: 'valcriss/test-repo',
    sha: 'abcdef123456',
    author: 'valcriss'
  }

  const projectKey = 'test-project'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('orchestre le déploiement complet d’une MR', async () => {
    // Mock clone
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    mockGit.mockReturnValue(fakeGit as any)

    // Mock lecture du fichier YAML
    mockFs.readFile.mockResolvedValueOnce('fake-yaml-content')
    mockYaml.parse.mockReturnValue({
      expose_ports: [
        { service: 'web', port: 3000 },
        { service: 'api', port: 8000 }
      ]
    })

    // Mock ports dynamiques
    mockPorts.allocatePort
      .mockResolvedValueOnce(10001)
      .mockResolvedValueOnce(10002)

    // Mock template + docker
    mockTemplateEngine.renderToFile.mockResolvedValue()
    mockDocker.up.mockResolvedValue()

    // Mock DB
    mockDb.query.mockResolvedValue({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] })

    // Run
    await stackManager.deploy(payload as MergeRequestPayload, projectKey)

    // ✅ Assertions clés
    expect(fakeGit.clone).toHaveBeenCalled()
    expect(mockFs.readFile).toHaveBeenCalled()
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('mr-42', 'web', 3000)
    expect(mockPorts.allocatePort).toHaveBeenCalledWith('mr-42', 'api', 8000)

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
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO merge_requests'),
      expect.arrayContaining(['mr-42', 'valcriss/test-repo', 'open'])
    )
  })

  it('log et relance une erreur si une étape échoue (ex: substitution template)', async () => {
    const stackManager = new StackManager()
  
    // Mock tout comme avant
    const fakeGit = { clone: jest.fn().mockResolvedValue(undefined) }
    mockGit.mockReturnValue(fakeGit as any)
  
    mockFs.readFile.mockResolvedValueOnce('yaml')
    mockYaml.parse.mockReturnValue({
      expose_ports: [{ service: 'web', port: 3000 }]
    })
  
    mockPorts.allocatePort.mockResolvedValueOnce(10001)
  
    // 👇 on force une erreur ici pour déclencher le catch
    mockTemplateEngine.renderToFile.mockRejectedValue(new Error('template fail'))
  
    await expect(
      stackManager.deploy(
        {
          mr_id: 'mr-crash',
          status: 'open',
          branch: 'broken',
          repo: 'valcriss/crash',
          sha: 'deadbeef',
          author: 'tester'
        },
        'fail-project'
      )
    ).rejects.toThrow('template fail')
  
    expect(mockTemplateEngine.renderToFile).toHaveBeenCalled()
    expect(mockDocker.up).not.toHaveBeenCalled()
    expect(mockDb.query).not.toHaveBeenCalled()
  })
  
})
