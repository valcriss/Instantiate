jest.mock('execa') // <-- utilise __mocks__/execa.ts
import { execa } from 'execa'
import { DockerService } from '../../src/docker/DockerService'

const mockedExeca = execa as jest.MockedFunction<typeof execa>

describe('DockerService', () => {
  const path = '/fake/path'
  const projectName = 'mr-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lance docker-compose up avec les bons arguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)

    await DockerService.up(path, projectName)

    expect(mockedExeca).toHaveBeenCalledWith('docker-compose', ['-p', projectName, 'up', '-d'], expect.objectContaining({ cwd: path }))
  })

  it('lance docker-compose down avec les bons arguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)

    await DockerService.down(path, projectName)

    expect(mockedExeca).toHaveBeenCalledWith('docker-compose', ['-p', projectName, 'down', '--volumes'], expect.objectContaining({ cwd: path }))
  })
})
