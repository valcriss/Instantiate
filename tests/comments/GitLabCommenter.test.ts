import fetch from 'node-fetch'
import logger from '../../src/utils/logger'
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload'
import { GitLabCommenter } from '../../src/comments/GitLabCommenter'
import { COMMENT_SIGNATURE, generateComment } from '../../src/comments/CommentService'
import db from '../../src/db'

jest.mock('node-fetch')
jest.mock('../../src/utils/logger')
jest.mock('../../src/db', () => ({
  __esModule: true,
  default: {
    getMergeRequestCommentId: jest.fn(),
    setMergeRequestCommentId: jest.fn()
  }
}))

describe('GitLabCommenter', () => {
  let commenter: GitLabCommenter
  let originalGitLabToken: string | undefined
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  const fakePayload: MergeRequestPayload = {
    project_id: '123',
    projectName: 'group/project',
    mergeRequestName: 'group/project!456',
    mr_id: '456',
    mr_iid: '456',
    status: 'open',
    branch: 'main',
    repo: 'https://gitlab.example.com/group/project',
    sha: 'abcde',
    author: 'test-author',
    full_name: 'group/project',
    provider: 'gitlab'
  }

  beforeAll(() => {
    originalGitLabToken = process.env.REPOSITORY_GITLAB_TOKEN
  })

  beforeEach(() => {
    process.env.REPOSITORY_GITLAB_TOKEN = 'fake-gitlab-token'
    mockFetch.mockReset()
    ;(logger.info as jest.Mock).mockClear()
    ;(logger.warn as jest.Mock).mockClear()

    commenter = new GitLabCommenter()
  })

  afterAll(() => {
    process.env.REPOSITORY_GITLAB_TOKEN = originalGitLabToken
  })

  describe('getGitLabApiUrlFromProjectUrl', () => {
    it('returns a valid API URL for a valid project URL', () => {
      const url = commenter.getGitLabApiUrlFromProjectUrl('https://gitlab.example.com/group/project')
      expect(url).toBe('https://gitlab.example.com/api/v4')
    })

    it('throws an error for an invalid project URL', () => {
      expect(() => {
        commenter.getGitLabApiUrlFromProjectUrl('invalid-url')
      }).toThrowError('Invalid GitLab project URL: invalid-url')
    })
  })

  describe('getHeaders', () => {
    it('returns headers when token is present', () => {
      const headers = (commenter as GitLabCommenter).getHeaders()
      expect(headers).toEqual({
        'PRIVATE-TOKEN': 'fake-gitlab-token',
        Accept: 'application/json',
        'User-Agent': 'InstantiateBot',
        'Content-Type': 'application/json'
      })
    })

    it('returns null when token is absent', () => {
      process.env.REPOSITORY_GITLAB_TOKEN = ''
      const headers = (commenter as GitLabCommenter).getHeaders()
      expect(headers).toBeNull()
    })
  })

  describe('getComments', () => {
    it('returns an empty array if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = ''
      const comments = await (commenter as GitLabCommenter).getComments('https://gitlab.example.com', '123', '456')
      expect(comments).toEqual([])
    })

    it('fetches comments from the API', async () => {
      const mockResponse = [{ id: '1', body: 'Test comment' }]
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const comments = await (commenter as GitLabCommenter).getComments('https://gitlab.example.com', '123', '456')
      expect(comments).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes',
        expect.objectContaining({ headers: expect.any(Object) })
      )
    })

    it('returns an empty array and logs a warning if the response status is 403', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const comments = await (commenter as GitLabCommenter).getComments('https://gitlab.example.com', '123', '456')

      expect(comments).toEqual([])
      expect(logger.warn).toHaveBeenCalledWith('[gitlab-comment] GitLab token not valid, unable to read comments')
    })
  })

  describe('deleteComment', () => {
    it('does nothing if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (commenter as any).deleteComment('https://gitlab.example.com', '123', '456', '789')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sends a DELETE request to the API', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFetch.mockResolvedValueOnce({ status: 204 } as any)
      await (commenter as GitLabCommenter).deleteComment('https://gitlab.example.com', '123', '456', '789')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes/789',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('removePreviousStatusComment', () => {
    it('deletes comments containing the signature', async () => {
      const mockComments = [
        { id: '1', body: 'Test comment' },
        { id: '2', body: `Comment with ${COMMENT_SIGNATURE}` }
      ]
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockComments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFetch.mockResolvedValueOnce({ status: 204 } as any)

      await (commenter as GitLabCommenter).removePreviousStatusComment(fakePayload)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes/2',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('postStatusComment', () => {
    it('does nothing if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = ''
      await commenter.postStatusComment(fakePayload, 'in_progress')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('updates existing comment when id is present', async () => {
      ;(db.getMergeRequestCommentId as jest.Mock).mockResolvedValueOnce('1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFetch.mockResolvedValueOnce({ status: 200 } as any)

      await commenter.postStatusComment(fakePayload, 'in_progress')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes/1',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(db.setMergeRequestCommentId).not.toHaveBeenCalled()
    })

    it('creates comment and saves id when none exists', async () => {
      ;(db.getMergeRequestCommentId as jest.Mock).mockResolvedValueOnce(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFetch.mockResolvedValueOnce({ json: jest.fn().mockResolvedValue({ id: '2' }), status: 201 } as any)

      await commenter.postStatusComment(fakePayload, 'ready')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes',
        expect.objectContaining({ method: 'POST' })
      )
      expect(db.setMergeRequestCommentId).toHaveBeenCalledWith('123', '456', '2')
    })
  })
})
