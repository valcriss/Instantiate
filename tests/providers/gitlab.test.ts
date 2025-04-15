import { parseGitlabWebhook } from '../../src/providers/gitlab'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

describe('parseGitlabWebhook', () => {
  it('extrait correctement les infos d’un webhook GitLab avec MR ouverte', () => {
    const body = {
      object_attributes: {
        id: 54321,
        iid: 456,
        title: 'Test MR',
        state: 'opened',
        source_branch: 'feature/gl-feature',
        last_commit: {
          id: 'abc123def456'
        },
        author_id: 99
      },
      project: {
        name: 'instantiate-gl',
        id: 'valcriss',
        git_http_url: 'valcriss/instantiate-gl'
      },
      user: {
        username: 'valcriss'
      }
    }

    const result: MergeRequestPayload = parseGitlabWebhook(body)

    expect(result).toEqual({
      project_id: 'valcriss',
      mr_id: '54321',
      mr_iid: '456',
      status: 'open',
      branch: 'feature/gl-feature',
      repo: 'valcriss/instantiate-gl',
      sha: 'abc123def456',
      author: '99',
      full_name: 'valcriss',
      mergeRequestName: 'Test MR',
      projectName: 'instantiate-gl',
      provider: 'gitlab'
    })
  })

  it('détecte un statut closed ou merged', () => {
    const closedBody = {
      object_attributes: {
        id: 123,
        iid: 456,
        title: '',
        state: 'closed',
        source_branch: 'fix/closed-branch',
        last_commit: {
          id: 'deadbeef0001'
        },
        author_id: 1
      },
      project: {
        id: 'valcriss',
        name: '',
        git_http_url: 'group/project'
      },
      user: {
        username: 'botuser'
      }
    }

    const mergedBody = {
      ...closedBody,
      object_attributes: {
        ...closedBody.object_attributes,
        state: 'merged'
      }
    }

    const closedResult = parseGitlabWebhook(closedBody)
    const mergedResult = parseGitlabWebhook(mergedBody)

    expect(closedResult.status).toBe('closed')
    expect(mergedResult.status).toBe('closed')
  })

  it('ajoute les informations d’authentification si elles sont définies', () => {
    process.env.REPOSITORY_GITLAB_USERNAME = 'user'
    process.env.REPOSITORY_GITLAB_TOKEN = 'pass'

    const body = {
      object_attributes: {
        id: 123,
        iid: 456,
        title: '',
        state: 'opened',
        source_branch: 'feature/test',
        last_commit: {
          id: 'sha123'
        },
        author_id: 42
      },
      project: {
        id: 'repo123',
        name: '',
        git_http_url: 'https://gitlab.com/test/repo.git'
      }
    }

    const result = parseGitlabWebhook(body)

    expect(result.repo).toBe('https://user:pass@gitlab.com/test/repo.git')

    delete process.env.REPOSITORY_GITLAB_USERNAME
    delete process.env.REPOSITORY_GITLAB_TOKEN
  })

  it('remplace localhost par host.docker.internal en mode développement', () => {
    process.env.NODE_ENV = 'development'

    const body = {
      object_attributes: {
        id: 456,
        iid: 456,
        title: '',
        state: 'opened',
        source_branch: 'feature/docker',
        last_commit: {
          id: 'sha456'
        },
        author_id: 99
      },
      project: {
        id: 'repo456',
        name: '',
        git_http_url: 'http://localhost/test/repo.git'
      }
    }

    const result = parseGitlabWebhook(body)

    expect(result.repo).toBe('http://host.docker.internal/test/repo.git')

    delete process.env.NODE_ENV
  })
})
