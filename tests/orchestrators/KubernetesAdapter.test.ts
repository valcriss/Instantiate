jest.mock('execa')
import { execa } from 'execa'
import { KubernetesAdapter } from '../../src/orchestrators/KubernetesAdapter'
import logger from '../../src/utils/logger'

const mockedExeca = execa as jest.MockedFunction<typeof execa>

describe('KubernetesAdapter', () => {
  const path = '/fake/path'
  const projectName = 'mr-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('applies manifests on up', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)
    const adapter = new KubernetesAdapter()
    await adapter.up(path, projectName)
    expect(mockedExeca).toHaveBeenCalledWith('kubectl', ['apply', '-f', path])
  })

  it('deletes manifests on down', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)
    const adapter = new KubernetesAdapter()
    await adapter.down(path, projectName)
    expect(mockedExeca).toHaveBeenCalledWith('kubectl', ['delete', '-f', path])
  })

  it('checkHealth returns running when all pods running', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: 'Running Running' } as any)
    const adapter = new KubernetesAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('running')
  })

  it('checkHealth returns error on mismatch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: 'Running Pending' } as any)
    const adapter = new KubernetesAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
  })

  it('checkHealth returns error when no output', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({ stdout: '' } as any)
    const adapter = new KubernetesAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
  })

  it('checkHealth handles errors', async () => {
    jest.spyOn(logger, 'error').mockImplementation(jest.fn())
    mockedExeca.mockRejectedValueOnce(new Error('boom'))
    const adapter = new KubernetesAdapter()
    const status = await adapter.checkHealth(projectName)
    expect(status).toBe('error')
    expect(logger.error).toHaveBeenCalled()
  })
})
