import { parseGithubWebhook } from '../../src/providers/github'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

describe('parseGithubWebhook', () => {
  it('extrait correctement les infos d’un webhook GitHub', () => {
    const body = {
      action: 'opened',
      pull_request: {
        id: 123456,
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

    const result: MergeRequestPayload = parseGithubWebhook(body)

    expect(result).toEqual({
      project_id: 'valcriss',
      mr_id: '123456',
      mr_iid: '456',
      status: 'open',
      full_name: 'valcriss/instantiate-demo',
      branch: 'feature/awesome-feature',
      repo: 'valcriss/instantiate-demo',
      sha: 'abcdef123456',
      author: 'valcriss',
      provider: 'github'
    })
  })

  it('détecte un statut closed', () => {
    const body = {
      action: 'closed',
      pull_request: {
        id: 987654,
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

    const result = parseGithubWebhook(body)

    expect(result.status).toBe('closed')
    expect(result.mr_id).toBe('987654')
  })

  it('ajoute les informations d’authentification si elles sont définies', () => {
    process.env.REPOSITORY_GITHUB_USERNAME = 'user'
    process.env.REPOSITORY_GITHUB_TOKEN = 'pass'

    const body = {
      action: 'opened',
      pull_request: {
        id: 123,
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

    const result = parseGithubWebhook(body)

    expect(result.repo).toBe('https://user:pass@github.com/test/repo.git')

    delete process.env.REPOSITORY_GITHUB_USERNAME
    delete process.env.REPOSITORY_GITHUB_TOKEN
  })

  it('remplace localhost par host.docker.internal en mode développement', () => {
    process.env.NODE_ENV = 'development'

    const body = {
      action: 'opened',
      pull_request: {
        id: 456,
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

    const result = parseGithubWebhook(body)

    expect(result.repo).toBe('http://host.docker.internal/test/repo.git')

    delete process.env.NODE_ENV
  })
})
