import { parseGithubWebhook } from '../../src/providers/github'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'

describe('parseGithubWebhook', () => {
  it('extrait correctement les infos d’un webhook GitHub', () => {
    const body = {
      action: 'opened',
      pull_request: {
        id: 123456,
        head: {
          ref: 'feature/awesome-feature',
          sha: 'abcdef123456'
        },
        user: {
          login: 'valcriss'
        }
      },
      repository: {
        full_name: 'valcriss/instantiate-demo'
      }
    }

    const result: MergeRequestPayload = parseGithubWebhook(body)

    expect(result).toEqual({
      mr_id: '123456',
      status: 'open',
      branch: 'feature/awesome-feature',
      repo: 'valcriss/instantiate-demo',
      sha: 'abcdef123456',
      author: 'valcriss'
    })
  })

  it('détecte un statut closed', () => {
    const body = {
      action: 'closed',
      pull_request: {
        id: 987654,
        head: {
          ref: 'bugfix/fix-typo',
          sha: 'deadbeef987654'
        },
        user: {
          login: 'octocat'
        }
      },
      repository: {
        full_name: 'octo/test'
      }
    }

    const result = parseGithubWebhook(body)

    expect(result.status).toBe('closed')
    expect(result.mr_id).toBe('987654')
  })
})
