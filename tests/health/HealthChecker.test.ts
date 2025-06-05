jest.mock('../../src/docker/execaWrapper')
import execa from '../../src/docker/execaWrapper'
import { HealthChecker } from '../../src/health/HealthChecker'
import { StackService, StackInfo } from '../../src/core/StackService'

jest.mock('../../src/core/StackService')

const mockedExeca = execa as unknown as jest.Mock
const mockedStackService = StackService as jest.Mocked<typeof StackService>

describe('HealthChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkStack', () => {
    const stack: StackInfo = {
      projectId: '1',
      mr_id: '2',
      projectName: 'p',
      mergeRequestName: 'mr',
      ports: {},
      provider: 'github',
      status: 'running',
      links: {}
    }

    it('returns running when all containers are running', async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: 'running\nrunning' })
      const status = await HealthChecker.checkStack(stack)
      expect(status).toBe('running')
      expect(mockedExeca).toHaveBeenCalled()
    })

    it('returns error when no output', async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: '' })
      const status = await HealthChecker.checkStack(stack)
      expect(status).toBe('error')
    })

    it('returns error when any container not running', async () => {
      mockedExeca.mockResolvedValueOnce({ stdout: 'running\nexited' })
      const status = await HealthChecker.checkStack(stack)
      expect(status).toBe('error')
    })

    it('returns error and logs when execa throws', async () => {
      const logger = await import('../../src/utils/logger')
      jest.spyOn(logger.default, 'error').mockImplementation(jest.fn())
      mockedExeca.mockRejectedValueOnce(new Error('boom'))
      const status = await HealthChecker.checkStack(stack)
      expect(status).toBe('error')
      expect(logger.default.error).toHaveBeenCalled()
    })
  })

  describe('checkAllStacks', () => {
    it('updates status when changed', async () => {
      const stacks: StackInfo[] = [
        { projectId: '1', mr_id: '2', projectName: '', mergeRequestName: '', ports: {}, provider: 'github', status: 'running', links: {} }
      ]
      mockedStackService.getAll.mockResolvedValueOnce(stacks)
      mockedExeca.mockResolvedValueOnce({ stdout: '' })
      await HealthChecker.checkAllStacks()
      expect(mockedStackService.updateStatus).toHaveBeenCalledWith('1', '2', 'error')
    })

    it('does not update when status unchanged', async () => {
      const stacks: StackInfo[] = [
        { projectId: '1', mr_id: '2', projectName: '', mergeRequestName: '', ports: {}, provider: 'github', status: 'running', links: {} }
      ]
      mockedStackService.getAll.mockResolvedValueOnce(stacks)
      mockedExeca.mockResolvedValueOnce({ stdout: 'running' })
      await HealthChecker.checkAllStacks()
      expect(mockedStackService.updateStatus).not.toHaveBeenCalled()
    })

    it('startHealthChecker lance la boucle et log en cas derreur', async () => {
      jest.useFakeTimers()
      const logger = await import('../../src/utils/logger')
      jest.spyOn(logger.default, 'error').mockImplementation(jest.fn())
      jest.spyOn(HealthChecker, 'checkAllStacks').mockRejectedValueOnce(new Error('oops'))
      const { startHealthChecker } = await import('../../src/health/HealthChecker')
      startHealthChecker(10)
      jest.advanceTimersByTime(10)
      await Promise.resolve()
      expect(logger.default.error).toHaveBeenCalled()
      jest.useRealTimers()
    })

    it("startHealthChecker utilise la valeur par defaut de l'intervalle", async () => {
      jest.useFakeTimers()
      jest.spyOn(HealthChecker, 'checkAllStacks').mockResolvedValueOnce()
      const { startHealthChecker } = await import('../../src/health/HealthChecker')
      startHealthChecker()
      jest.advanceTimersByTime(30000)
      expect(HealthChecker.checkAllStacks).toHaveBeenCalled()
      jest.useRealTimers()
    })
  })
})
