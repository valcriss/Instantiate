import db from '../../src/db'
import { StackService, StackInfo } from '../../src/core/StackService'

jest.mock('../../src/db')

const mockDb = db as jest.Mocked<typeof db>

describe('StackService', () => {
  const mockStackInfo: StackInfo = {
    projectId: '1',
    projectName: 'test-project',
    mergeRequestName: 'test-mr',
    ports: { http: 8080 },
    mr_id: '123',
    provider: 'github',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'running',
    links: { self: 'http://localhost:8080' }
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should save a stack to the database', async () => {
    await StackService.save(mockStackInfo)
    expect(mockDb.saveStack).toHaveBeenCalled()
  })

  it('should remove a stack from the database', async () => {
    await StackService.remove(mockStackInfo.projectId, mockStackInfo.mr_id)
    expect(mockDb.removeStack).toHaveBeenCalledWith(mockStackInfo.projectId, mockStackInfo.mr_id)
  })

  it('should retrieve all stacks from the database', async () => {
    mockDb.getAllStacks.mockResolvedValue([mockStackInfo as Required<StackInfo>])
    const stacks = await StackService.getAll()
    expect(stacks).toEqual([mockStackInfo])
    expect(mockDb.getAllStacks).toHaveBeenCalled()
  })

  it('should update stack status', async () => {
    await StackService.updateStatus('1', '2', 'error')
    expect(mockDb.updateStackStatus).toHaveBeenCalledWith('1', '2', 'error')
  })
})
