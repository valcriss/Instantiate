import { parseGitlabWebhook } from '../../src/providers/gitlab'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

describe('parseGitlabWebhook', () => {
  it('extrait correctement les infos d’un webhook GitLab avec MR ouverte', () => {
    const body = {
      object_attributes: {
        id: 54321,
        state: 'opened',
        source_branch: 'feature/gl-feature',
        last_commit: {
          id: 'abc123def456'
        },
        author_id: 99
      },
      project: {
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
      status: 'open',
      branch: 'feature/gl-feature',
      repo: 'valcriss/instantiate-gl',
      sha: 'abc123def456',
      author: '99' // ou 'valcriss' si tu préfères utiliser username dans ton implémentation
    })
  })

  it('détecte un statut closed ou merged', () => {
    const closedBody = {
      object_attributes: {
        id: 123,
        state: 'closed',
        source_branch: 'fix/closed-branch',
        last_commit: {
          id: 'deadbeef0001'
        },
        author_id: 1
      },
      project: {
        id: 'valcriss',
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
})
