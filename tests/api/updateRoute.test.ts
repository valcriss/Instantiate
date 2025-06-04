import request from 'supertest'
import express from 'express'

import updateRoute from '../../src/api/update'
import { enqueueUpdateEvent } from '../../src/api/update'
import * as github from '../../src/providers/github'
import * as gitlab from '../../src/providers/gitlab'
import { StackManager } from '../../src/core/StackManager'
import { closeConnection } from '../../src/mqtt/MQTTClient'
import { closeLogger } from '../../src/utils/logger'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

// Mocks
jest.mock('../../src/providers/github')
jest.mock('../../src/providers/gitlab')
jest.mock('../../src/core/StackManager')

// Implémentations factices pour la StackManager
const mockDeploy = jest.fn()
const mockDestroy = jest.fn()

;(StackManager as jest.Mock).mockImplementation(() => ({
  deploy: mockDeploy,
  destroy: mockDestroy
}))

// Création de l'app Express réelle, SANS listen()
const app = express()
app.disable('x-powered-by')
app.use(express.json())
app.use('/api', updateRoute)

// Hooks Jest avant/après tous les tests
beforeAll(async () => {
  // Si vous avez d'autres initialisations à faire, mettez-les ici
})

afterAll(async () => {
  // Nettoyage / Fermeture de connexions éventuelles
  await closeConnection()
  closeLogger()
  // On remet les mocks à zéro au cas où
  jest.clearAllMocks()
  jest.resetAllMocks()
})

describe('POST /api/update', () => {
  // Nettoyage / reset des mocks avant chaque test
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  // Exemple de payload
  const fakePayload: MergeRequestPayload = {
    project_id: '123',
    projectName: '',
    mergeRequestName: '',
    mr_id: '123',
    mr_iid: '123',
    status: 'open',
    branch: 'main',
    repo: 'valcriss/test',
    sha: 'abcd',
    author: 'valcriss',
    full_name: 'valcriss/test',
    provider: 'github'
  }

  it('traite un webhook GitHub pour MR ouverte', async () => {
    ;(github.parseGithubWebhook as jest.Mock).mockReturnValue(fakePayload)

    // On utilise directement `request(app)` au lieu de `request(server)`
    const res = await request(app).post('/api/update?key=test-key').set('x-github-event', 'pull_request').send({ some: 'payload' })

    expect(res.status).toBe(200)
  })

  it('traite un webhook GitLab pour MR fermée', async () => {
    ;(gitlab.parseGitlabWebhook as jest.Mock).mockReturnValue({
      ...fakePayload,
      status: 'closed'
    })

    const res = await request(app).post('/api/update?key=gl-key').set('x-gitlab-event', 'Merge Request Hook').send({ some: 'payload' })

    expect(res.status).toBe(200)
  })

  it('retourne 400 si pas de project key', async () => {
    const res = await request(app).post('/api/update').send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Missing project key/)
  })

  it('retourne 400 si SCM provider inconnu', async () => {
    const res = await request(app).post('/api/update?key=123').send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unsupported/)
  })

  it("retourne 500 en cas d'erreur interne", async () => {
    ;(github.parseGithubWebhook as jest.Mock).mockImplementation(() => {
      throw new Error('Erreur simulée')
    })

    const res = await request(app).post('/api/update?key=test-key').set('x-github-event', 'pull_request').send({ some: 'payload' })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Internal error/)
  })

  it("retourne 500 si l'enqueue échoue", async () => {
    ;(gitlab.parseGitlabWebhook as jest.Mock).mockReturnValue({
      ...fakePayload,
      status: 'closed'
    })
    // On simule une exception dans publishUpdateEvent
    jest.spyOn(require('../../src/mqtt/MQTTClient'), 'publishUpdateEvent').mockImplementation(() => {
      throw new Error("Erreur d'enqueue simulée")
    })

    const res = await request(app).post('/api/update?key=test-key').set('x-github-event', 'pull_request').send({ some: 'payload' })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Internal error/)
  })

  it("log l'erreur lorsque enqueueUpdateEvent echoue", () => {
    const logger = require('../../src/utils/logger').default
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    jest.spyOn(require('../../src/mqtt/MQTTClient'), 'ensureMQTTClientIsInitialized').mockImplementation(() => {
      throw new Error('fail')
    })

    enqueueUpdateEvent({ payload: fakePayload, projectKey: 'key' })

    expect(logger.error).toHaveBeenCalledWith('[api] Failed to enqueue update event')
  })
})
