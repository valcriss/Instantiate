jest.mock('execa') // <-- utilise __mocks__/execa.ts
import { execa } from 'execa'
import { DockerService } from '../../src/docker/DockerService'
import * as ioUtils from '../../src/utils/ioUtils'

jest.mock('../../src/utils/ioUtils', () => ({
  ...jest.requireActual('../../src/utils/ioUtils'),
  directoryExists: jest.fn()
}))

const mockedExeca = execa as jest.MockedFunction<typeof execa>
const mockedDirectoryExists = ioUtils.directoryExists as jest.MockedFunction<typeof ioUtils.directoryExists>

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

    expect(mockedExeca).toHaveBeenCalledWith(
      'docker-compose',
      ['-p', projectName, 'up', '-d', '--force-recreate', '--build'],
      expect.objectContaining({ cwd: path })
    )
  })

  it('lance docker-compose down avec les bons arguments', async () => {
    mockedDirectoryExists.mockResolvedValueOnce(true) // Simulate directory exists

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedExeca.mockResolvedValueOnce({} as any)

    await DockerService.down(path, projectName)

    expect(mockedExeca).toHaveBeenCalledWith('docker-compose', ['-p', projectName, 'down', '--volumes'], expect.objectContaining({ cwd: path }))
  })

  it("n'exécute pas docker-compose down si le dossier n'existe pas", async () => {
    mockedDirectoryExists.mockResolvedValueOnce(false)
    await DockerService.down(path, projectName)
    expect(mockedExeca).not.toHaveBeenCalled()
  })

  it('logge les sorties stdout et stderr', async () => {
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
    Object.assign(promise, { stdout, stderr })
    mockedExeca.mockReturnValueOnce(promise as any)
    const logger = await import('../../src/utils/logger')
    jest.spyOn(logger.default, 'info').mockImplementation(jest.fn())

    await DockerService.up(path, projectName)

    expect(logger.default.info).toHaveBeenCalledWith('[docker:stdout] out')
    expect(logger.default.info).toHaveBeenCalledWith('[docker:stderr] err')
  })

  it('logge les sorties stdout et stderr lors du down', async () => {
    mockedDirectoryExists.mockResolvedValueOnce(true)
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
    Object.assign(promise, { stdout, stderr })
    mockedExeca.mockReturnValueOnce(promise as any)
    const logger = await import('../../src/utils/logger')
    jest.spyOn(logger.default, 'info').mockImplementation(jest.fn())

    await DockerService.down(path, projectName)

    expect(logger.default.info).toHaveBeenCalledWith('[docker:stdout] out')
    expect(logger.default.info).toHaveBeenCalledWith('[docker:stderr] err')
  })
})
