import request from 'supertest'
import express from 'express'
import stacksPageRoute from '../../src/pages/stacksPage'
import { StackService, StackInfo } from '../../src/core/StackService'
import { closeLogger } from '../../src/utils/logger'

jest.mock('../../src/core/StackService')

const mockStackService = StackService as jest.Mocked<typeof StackService>

const app = express()
app.disable('x-powered-by')
app.use('/', stacksPageRoute)

afterAll(() => {
  closeLogger()
})

describe('GET /', () => {
  const fakeStack: StackInfo = {
    projectId: '1',
    projectName: 'Awesome project',
    mergeRequestName: 'Improve tests',
    ports: { http: 8080 },
    mr_id: '42',
    provider: 'github',
    status: 'running',
    links: { app: 'http://localhost:8080' },
    createdAt: '2021-01-01T12:00:00Z',
    updatedAt: '2021-01-02T12:00:00Z'
  }

  beforeEach(() => {
    mockStackService.getAll.mockResolvedValue([fakeStack as Required<StackInfo>])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('retourne le HTML généré avec les informations des stacks', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain(fakeStack.projectName)
    expect(res.text).toContain(fakeStack.mergeRequestName)
    expect(res.text).toContain(fakeStack.provider)
    expect(res.text).toContain(fakeStack.status)
    const escapedLink = fakeStack.links.app.replace(/\//g, '&#x2F;')
    expect(res.text).toContain(escapedLink)

    const formattedCreated = new Date(fakeStack.createdAt!).toLocaleString()
    const formattedUpdated = new Date(fakeStack.updatedAt!).toLocaleString()
    const escapedCreated = formattedCreated.replace(/\//g, '&#x2F;')
    const escapedUpdated = formattedUpdated.replace(/\//g, '&#x2F;')
    expect(res.text).toContain(escapedCreated)
    expect(res.text).toContain(escapedUpdated)
  })
})
