import fetch from 'node-fetch'
import logger from '../../src/utils/logger'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { GitHubCommenter } from '../../src/comments/GitHubCommenter'
import { Response } from 'node-fetch'

jest.mock('node-fetch')
jest.mock('../../src/utils/logger')

const { Response: MockResponse } = jest.requireActual('node-fetch')

describe('GitHubCommenter', () => {
  let commenter: GitHubCommenter
  let originalGithubToken: string | undefined
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  const fakePayload: MergeRequestPayload = {
    project_id: '123',
    mr_id: '456',
    mr_iid: '456',
    status: 'open',
    branch: 'main',
    repo: 'https://github.com/valcriss/test-repo',
    sha: 'abcde',
    author: 'valcriss',
    full_name: 'valcriss/test-repo',
    provider: 'github'
  }

  beforeAll(() => {
    originalGithubToken = process.env.REPOSITORY_GITHUB_TOKEN
  })

  beforeEach(() => {
    process.env.REPOSITORY_GITHUB_TOKEN = 'fake-github-token'
    mockFetch.mockReset()
    ;(logger.info as jest.Mock).mockClear()

    commenter = new GitHubCommenter()
  })

  afterAll(() => {
    process.env.REPOSITORY_GITHUB_TOKEN = originalGithubToken
  })

  describe('removePreviousStatusComment', () => {
    it('supprime un commentaire contenant <!-- instantiate-comment --> s’il existe', async () => {
      const fakeComments = [
        { id: 111, body: 'Some random comment' },
        { id: 222, body: 'This one has <!-- instantiate-comment --> inside' }
      ]

      mockFetch.mockResolvedValueOnce({
        json: async () => fakeComments,
        status: 200
      } as Response)

      mockFetch.mockResolvedValueOnce({
        status: 204
      } as Response)

      await commenter.removePreviousStatusComment(fakePayload)

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/valcriss/test-repo/issues/456/comments',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-github-token'
          })
        })
      )

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/valcriss/test-repo/issues/comments/222',
        expect.objectContaining({ method: 'DELETE' })
      )

      expect(logger.info).toHaveBeenCalledWith('[github-comment] Deleted previous comment for MR #456')
    })

    it('ne supprime pas si aucun commentaire "instantiate-comment" n’est trouvé', async () => {
      const fakeComments = [
        { id: 111, body: 'Some random comment' },
        { id: 222, body: 'Another random comment' }
      ]

      mockFetch.mockResolvedValueOnce({
        json: async () => fakeComments,
        status: 200
      } as Response)

      await commenter.removePreviousStatusComment(fakePayload)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(logger.info).not.toHaveBeenCalled()
    })

    it('ne fait rien si REPOSITORY_GITHUB_TOKEN est vide', async () => {
      process.env.REPOSITORY_GITHUB_TOKEN = ''

      await commenter.removePreviousStatusComment(fakePayload)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('postStatusComment', () => {
    it("n'envoie pas de requête si REPOSITORY_GITHUB_TOKEN est vide", async () => {
      process.env.REPOSITORY_GITHUB_TOKEN = ''

      await commenter.postStatusComment(fakePayload, 'in_progress')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("supprime d'abord un commentaire précédent, puis poste un nouveau commentaire", async () => {
      const fakeComments = [{ id: 999, body: 'Some old comment <!-- instantiate-comment -->' }]

      mockFetch.mockResolvedValueOnce({
        json: async () => fakeComments,
        status: 200
      } as Response)

      mockFetch.mockResolvedValueOnce({
        status: 204
      } as Response)

      mockFetch.mockResolvedValueOnce({
        status: 201
      } as Response)

      await commenter.postStatusComment(fakePayload, 'in_progress', { link1: 'http://example.com' })

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/valcriss/test-repo/issues/comments/999',
        expect.objectContaining({ method: 'DELETE' })
      )

      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        'https://api.github.com/repos/valcriss/test-repo/issues/456/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            body: '<!-- instantiate-comment -->\n Deployment in progress...'
          })
        })
      )

      expect(logger.info).toHaveBeenCalledTimes(2)
    })
  })

  describe('deleteComment', () => {
    it('ne fait rien si REPOSITORY_GITHUB_TOKEN est vide', async () => {
      process.env.REPOSITORY_GITHUB_TOKEN = ''

      await commenter['deleteComment']('valcriss/test-repo', 123)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('envoie une requête DELETE si REPOSITORY_GITHUB_TOKEN est défini', async () => {
      process.env.REPOSITORY_GITHUB_TOKEN = 'fake-github-token'

      mockFetch.mockResolvedValueOnce({
        status: 204
      } as Response)

      await commenter['deleteComment']('valcriss/test-repo', 123)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/valcriss/test-repo/issues/comments/123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-github-token'
          })
        })
      )
    })
  })

  describe('getGitHubOwnerFromProjectUrl', () => {
    it('throws an error if the project URL is invalid', () => {
      expect(() => {
        commenter.getGitHubOwnerFromProjectUrl('invalid-url')
      }).toThrowError('Invalid GitHub project URL: invalid-url')
    })
  })

  describe('getGitHubRepositoryFromProjectUrl', () => {
    it('throws an error if the project URL is invalid', () => {
      expect(() => {
        commenter.getGitHubRepositoryFromProjectUrl('invalid-url')
      }).toThrowError('Invalid GitHub project URL: invalid-url')
    })
  })
})
