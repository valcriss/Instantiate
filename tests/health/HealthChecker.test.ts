jest.mock('fs/promises')
jest.mock('yaml')
jest.mock('../../src/orchestrators', () => ({
  getOrchestratorAdapter: jest.fn()
}))
import fs from 'fs/promises'
import YAML from 'yaml'
import { getOrchestratorAdapter } from '../../src/orchestrators'
import { HealthChecker } from '../../src/health/HealthChecker'
import { StackService, StackInfo } from '../../src/core/StackService'

jest.mock('../../src/core/StackService')

const mockFs = fs as jest.Mocked<typeof fs>
const mockYaml = YAML as unknown as { parse: jest.Mock }
const mockGetAdapter = getOrchestratorAdapter as jest.Mock
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

    it('uses compose when config missing', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('no file'))
      const adapter = { checkHealth: jest.fn().mockResolvedValue('running') }
      mockGetAdapter.mockReturnValueOnce(adapter)
      const status = await HealthChecker.checkStack(stack)
      expect(mockGetAdapter).toHaveBeenCalledWith('compose')
      expect(status).toBe('running')
    })

    it('uses orchestrator from config', async () => {
      mockFs.readFile.mockResolvedValueOnce('yaml')
      mockYaml.parse.mockReturnValueOnce({ orchestrator: 'swarm' })
      const adapter = { checkHealth: jest.fn().mockResolvedValue('error') }
      mockGetAdapter.mockReturnValueOnce(adapter)
      const status = await HealthChecker.checkStack(stack)
      expect(mockGetAdapter).toHaveBeenCalledWith('swarm')
      expect(status).toBe('error')
    })

    it('uses default when orchestrator key missing', async () => {
      mockFs.readFile.mockResolvedValueOnce('yaml')
      mockYaml.parse.mockReturnValueOnce({})
      const adapter = { checkHealth: jest.fn().mockResolvedValue('running') }
      mockGetAdapter.mockReturnValueOnce(adapter)
      const status = await HealthChecker.checkStack(stack)
      expect(mockGetAdapter).toHaveBeenCalledWith('compose')
      expect(status).toBe('running')
    })

    it('logs and returns error when adapter throws', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('no file'))
      const adapter = { checkHealth: jest.fn().mockRejectedValue(new Error('boom')) }
      mockGetAdapter.mockReturnValueOnce(adapter)
      const logger = await import('../../src/utils/logger')
      jest.spyOn(logger.default, 'error').mockImplementation(jest.fn())
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
      jest.spyOn(HealthChecker, 'checkStack').mockResolvedValueOnce('error')
      await HealthChecker.checkAllStacks()
      expect(mockedStackService.updateStatus).toHaveBeenCalledWith('1', '2', 'error')
    })

    it('does not update when status unchanged', async () => {
      const stacks: StackInfo[] = [
        { projectId: '1', mr_id: '2', projectName: '', mergeRequestName: '', ports: {}, provider: 'github', status: 'running', links: {} }
      ]
      mockedStackService.getAll.mockResolvedValueOnce(stacks)
      jest.spyOn(HealthChecker, 'checkStack').mockResolvedValueOnce('running')
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
