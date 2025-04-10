import request from 'supertest'
import express from 'express'
import updateRoute from '../../src/api/update'
import * as github from '../../src/providers/github'
import * as gitlab from '../../src/providers/gitlab'
import { StackManager } from '../../src/core/StackManager'

jest.mock('../../src/providers/github')
jest.mock('../../src/providers/gitlab')
jest.mock('../../src/core/StackManager')

const mockDeploy = jest.fn()
const mockDestroy = jest.fn()

// remplace les méthodes de la classe StackManager
;(StackManager as jest.Mock).mockImplementation(() => ({
  deploy: mockDeploy,
  destroy: mockDestroy
}))

const app = express()
app.use(express.json())
app.use('/api', updateRoute)

describe('POST /api/update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const fakePayload = {
    mr_id: '123',
    status: 'open',
    branch: 'main',
    repo: 'valcriss/test',
    sha: 'abcd',
    author: 'valcriss'
  }

  it('traite un webhook GitHub pour MR ouverte', async () => {
    ;(github.parseGithubWebhook as jest.Mock).mockReturnValue(fakePayload)

    const res = await request(app)
      .post('/api/update?key=test-key')
      .set('x-github-event', 'pull_request')
      .send({ some: 'payload' })

    expect(res.status).toBe(200)
  })

  it('traite un webhook GitLab pour MR fermée', async () => {
    ;(gitlab.parseGitlabWebhook as jest.Mock).mockReturnValue({ ...fakePayload, status: 'closed' })

    const res = await request(app)
      .post('/api/update?key=gl-key')
      .set('x-gitlab-event', 'Merge Request Hook')
      .send({ some: 'payload' })

    expect(res.status).toBe(200)
  })

  it('retourne 400 si pas de project key', async () => {
    const res = await request(app)
      .post('/api/update')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Missing project key/)
  })

  it('retourne 400 si SCM provider inconnu', async () => {
    const res = await request(app)
      .post('/api/update?key=123')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unsupported/)
  })
})
