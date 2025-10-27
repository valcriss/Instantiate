import { parseGithubWebhook } from '../../src/providers/github'

jest.mock('node-fetch', () => jest.fn())

beforeEach(() => {
  ;(require('node-fetch') as jest.Mock).mockReset()
})

describe('parseGithubWebhook', () => {
  it('extrait correctement les infos d’un webhook GitHub', async () => {
    const body = {
      action: 'opened',
      pull_request: {
        id: 123456,
        title: '',
        number: 456,
        head: {
          ref: 'feature/awesome-feature',
          sha: 'abcdef123456'
        },
        user: {
          login: 'valcriss'
        }
      },
      repository: {
        id: 'valcriss',
        full_name: 'valcriss/instantiate-demo',
        clone_url: 'valcriss/instantiate-demo'
      }
    }

    const result = await parseGithubWebhook(body, 'pull_request')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result).toEqual({
      kind: 'handled',
      forceDeploy: false,
      payload: {
        project_id: 'valcriss',
        projectName: 'valcriss/instantiate-demo',
        mergeRequestName: '',
        mr_id: '123456',
        mr_iid: '456',
        status: 'open',
        full_name: 'valcriss/instantiate-demo',
        branch: 'feature/awesome-feature',
        repo: 'valcriss/instantiate-demo',
        sha: 'abcdef123456',
        author: 'valcriss',
        provider: 'github'
      }
    })
  })

  it('détecte un statut closed', async () => {
    const body = {
      action: 'closed',
      pull_request: {
        id: 987654,
        title: '',
        number: 456,
        head: {
          ref: 'bugfix/fix-typo',
          sha: 'deadbeef987654'
        },
        user: {
          login: 'octocat'
        }
      },
      repository: {
        id: '123456',
        full_name: 'octo/test',
        clone_url: 'octo/test'
      }
    }

    const result = await parseGithubWebhook(body, 'pull_request')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.status).toBe('closed')
    expect(result.payload.mr_id).toBe('987654')
  })

  it('ajoute les informations d’authentification si elles sont définies', async () => {
    process.env.REPOSITORY_GITHUB_USERNAME = 'user'
    process.env.REPOSITORY_GITHUB_TOKEN = 'pass'

    const body = {
      action: 'opened',
      pull_request: {
        id: 123,
        title: '',
        number: 456,
        head: {
          ref: 'feature/test',
          sha: 'sha123'
        },
        user: {
          login: 'testuser'
        }
      },
      repository: {
        id: 'repo123',
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'pull_request')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.repo).toBe('https://user:pass@github.com/test/repo.git')

    delete process.env.REPOSITORY_GITHUB_USERNAME
    delete process.env.REPOSITORY_GITHUB_TOKEN
  })

  it('remplace localhost par host.docker.internal en mode développement', async () => {
    process.env.NODE_ENV = 'development'

    const body = {
      action: 'opened',
      pull_request: {
        id: 456,
        title: '',
        number: 456,
        head: {
          ref: 'feature/docker',
          sha: 'sha456'
        },
        user: {
          login: 'dockeruser'
        }
      },
      repository: {
        id: 'repo456',
        full_name: 'test/repo',
        clone_url: 'http://localhost/test/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'pull_request')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.repo).toBe('http://host.docker.internal/test/repo.git')

    delete process.env.NODE_ENV
  })

  it('force le déploiement lorsqu’un commentaire de MR contient la commande', async () => {
    const fetchMock = require('node-fetch') as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 99,
        number: 7,
        title: 'Retry deploy',
        head: { ref: 'feature/retry', sha: 'sha999' },
        user: { login: 'octocat' },
        state: 'open'
      })
    })

    const body = {
      comment: { body: 'instantiate deploy' },
      issue: {
        number: 7,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'issue_comment')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.forceDeploy).toBe(true)
    expect(result.payload).toMatchObject({
      mr_id: '99',
      branch: 'feature/retry',
      sha: 'sha999',
      status: 'open'
    })
  })

  it('ignore les commentaires qui ne ciblent pas une pull request', async () => {
    const body = {
      comment: { body: 'instantiate deploy' },
      issue: {
        number: 7
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'issue_comment')

    expect(result).toEqual({ kind: 'skipped', reason: 'comment_not_pr' })
  })

  it('ignore les commentaires sans commande explicite', async () => {
    const body = {
      comment: { body: 'hello world' },
      issue: {
        number: 7,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'issue_comment')

    expect(result).toEqual({ kind: 'skipped', reason: 'comment_not_command' })
  })

  it('retourne skipped lorsque la recuperation du PR echoue', async () => {
    const fetchMock = require('node-fetch') as jest.Mock
    fetchMock.mockResolvedValue({ ok: false })

    const body = {
      comment: { body: 'instantiate deploy' },
      issue: {
        number: 42,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'issue_comment')

    expect(result).toEqual({ kind: 'skipped', reason: 'missing_pull_request' })
  })

  it('utilise le token github quand il est defini', async () => {
    const fetchMock = require('node-fetch') as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 99,
        number: 7,
        title: 'Retry deploy',
        head: { ref: 'feature/retry', sha: 'sha999' },
        user: { login: 'octocat' },
        state: 'open'
      })
    })

    process.env.REPOSITORY_GITHUB_TOKEN = 'token'

    const body = {
      comment: { body: 'instantiate deploy' },
      issue: {
        number: 7,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    await parseGithubWebhook(body, 'issue_comment')

    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/repos/octo/repo/pulls/7', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer token'
      }
    })

    delete process.env.REPOSITORY_GITHUB_TOKEN
  })

  it('retourne skipped pour les evenements non supportes', async () => {
    const result = await parseGithubWebhook({} as never, 'ping')
    expect(result).toEqual({ kind: 'skipped', reason: 'unsupported_event' })
  })

  it('retourne skipped lorsque le commentaire est absent', async () => {
    const body = {
      issue: {
        number: 7,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body as never, 'issue_comment')

    expect(result).toEqual({ kind: 'skipped', reason: 'comment_not_command' })
  })

  it('reouvre le statut si le PR etait ferme lors du commentaire', async () => {
    const fetchMock = require('node-fetch') as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        number: 9,
        title: 'Closed but redeploy',
        head: { ref: 'bugfix/hot', sha: 'sha-hot' },
        user: { login: 'octocat' },
        state: 'closed'
      })
    })

    const body = {
      comment: { body: 'instantiate deploy' },
      issue: {
        number: 9,
        pull_request: {}
      },
      repository: {
        id: 'repo',
        full_name: 'octo/repo',
        clone_url: 'https://github.com/octo/repo.git'
      }
    }

    const result = await parseGithubWebhook(body, 'issue_comment')

    if (result.kind !== 'handled') {
      throw new Error('Expected handled result')
    }

    expect(result.payload.status).toBe('open')
  })
})
