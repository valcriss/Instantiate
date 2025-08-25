jest.mock('execa')
import { execa } from 'execa'
import { DockerSwarmAdapter } from '../../src/orchestrators/DockerSwarmAdapter'
import logger from '../../src/utils/logger'

const mockedExeca = execa as jest.MockedFunction<typeof execa>

describe('DockerSwarmAdapter', () => {
  const path = '/fake/path'
  const projectName = 'mr-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deploys with docker stack deploy', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)
    const adapter = new DockerSwarmAdapter()
    await adapter.up(path, projectName)
    expect(mockedExeca).toHaveBeenCalledWith('docker', ['stack', 'deploy', '-c', 'docker-compose.yml', projectName], expect.objectContaining({ cwd: path }))
  })

  it('removes stack and prunes images', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValue({} as any)
    const adapter = new DockerSwarmAdapter()
    await adapter.down(path, projectName)
    expect(mockedExeca).toHaveBeenNthCalledWith(1, 'docker', ['stack', 'rm', projectName])
    expect(mockedExeca).toHaveBeenNthCalledWith(2, 'docker', ['image', 'prune', '-f'])
  })

  it('checkHealth returns running when replicas match', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: '1/1\n2/2' } as any)
    const adapter = new DockerSwarmAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('running')
  })

  it('checkHealth returns error on mismatch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: '1/1\n0/1' } as any)
    const adapter = new DockerSwarmAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
  })

  it('checkHealth returns error when no output', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: '' } as any)
    const adapter = new DockerSwarmAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
  })

  it('checkHealth handles execa errors', async () => {
    jest.spyOn(logger, 'error').mockImplementation(jest.fn())
    mockedExeca.mockRejectedValueOnce(new Error('boom'))
    const adapter = new DockerSwarmAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
    expect(logger.error).toHaveBeenCalled()
  })
})
