import fetch from 'node-fetch';
import logger from '../../src/utils/logger';
import { MergeRequestPayload } from '../../src/types/MergeRequestPayload';
import { GitLabCommenter } from '../../src/comments/GitLabCommenter';
import { COMMENT_SIGNATURE, generateComment } from '../../src/comments/CommentService';

jest.mock('node-fetch');
jest.mock('../../src/utils/logger');

describe('GitLabCommenter', () => {
  let commenter: GitLabCommenter;
  let originalGitLabToken: string | undefined;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  const fakePayload: MergeRequestPayload = {
    project_id: '123',
    mr_id: '456',
    mr_iid: '456',
    status: 'open',
    branch: 'main',
    repo: 'https://gitlab.example.com/group/project',
    sha: 'abcde',
    author: 'test-author',
    full_name: 'group/project',
    provider: 'gitlab'
  };

  beforeAll(() => {
    originalGitLabToken = process.env.REPOSITORY_GITLAB_TOKEN;
  });

  beforeEach(() => {
    process.env.REPOSITORY_GITLAB_TOKEN = 'fake-gitlab-token';
    mockFetch.mockReset();
    (logger.info as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();

    commenter = new GitLabCommenter();
  });

  afterAll(() => {
    process.env.REPOSITORY_GITLAB_TOKEN = originalGitLabToken;
  });

  describe('getGitLabApiUrlFromProjectUrl', () => {
    it('returns a valid API URL for a valid project URL', () => {
      const url = commenter.getGitLabApiUrlFromProjectUrl('https://gitlab.example.com/group/project');
      expect(url).toBe('https://gitlab.example.com/api/v4');
    });

    it('throws an error for an invalid project URL', () => {
      expect(() => {
        commenter.getGitLabApiUrlFromProjectUrl('invalid-url');
      }).toThrowError('Invalid GitLab project URL: invalid-url');
    });
  });

  describe('getHeaders', () => {
    it('returns headers when token is present', () => {
      const headers = (commenter as any).getHeaders();
      expect(headers).toEqual({
        'PRIVATE-TOKEN': 'fake-gitlab-token',
        Accept: 'application/json',
        'User-Agent': 'InstantiateBot',
        'Content-Type': 'application/json'
      });
    });

    it('returns null when token is absent', () => {
      process.env.REPOSITORY_GITLAB_TOKEN = '';
      const headers = (commenter as any).getHeaders();
      expect(headers).toBeNull();
    });
  });

  describe('getComments', () => {
    it('returns an empty array if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = '';
      const comments = await (commenter as any).getComments('https://gitlab.example.com', '123', '456');
      expect(comments).toEqual([]);
    });

    it('fetches comments from the API', async () => {
      const mockResponse = [{ id: '1', body: 'Test comment' }];
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      } as any);

      const comments = await (commenter as any).getComments('https://gitlab.example.com', '123', '456');
      expect(comments).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes',
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it('returns an empty array and logs a warning if the response status is 403', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403
      } as any);

      const comments = await (commenter as any).getComments('https://gitlab.example.com', '123', '456');

      expect(comments).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[gitlab-comment] GitLab token not valid, unable to read comments'
      );
    });
  });

  describe('deleteComment', () => {
    it('does nothing if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = '';
      await (commenter as any).deleteComment('https://gitlab.example.com', '123', '456', '789');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends a DELETE request to the API', async () => {
      mockFetch.mockResolvedValueOnce({ status: 204 } as any);
      await (commenter as any).deleteComment('https://gitlab.example.com', '123', '456', '789');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes/789',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('removePreviousStatusComment', () => {
    it('deletes comments containing the signature', async () => {
      const mockComments = [
        { id: '1', body: 'Test comment' },
        { id: '2', body: `Comment with ${COMMENT_SIGNATURE}` }
      ];
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockComments)
      } as any);
      mockFetch.mockResolvedValueOnce({ status: 204 } as any);

      await (commenter as any).removePreviousStatusComment(fakePayload);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes/2',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('postStatusComment', () => {
    it('does nothing if headers are missing', async () => {
      process.env.REPOSITORY_GITLAB_TOKEN = '';
      await commenter.postStatusComment(fakePayload, 'in_progress');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('posts a status comment to the API', async () => {
      mockFetch.mockResolvedValueOnce({ status: 204 } as any); // Mock delete comment response
      mockFetch.mockResolvedValueOnce({ status: 201 } as any); // Mock post comment response
      await commenter.postStatusComment(fakePayload, 'in_progress', { link: 'http://example.com' });

      expect(mockFetch).toHaveBeenNthCalledWith(
        2, // Ensure we are checking the second call
        'https://gitlab.example.com/api/v4/projects/123/merge_requests/456/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            body: '<!-- instantiate-comment -->\n Deployment in progress...',
            id: '123',
            merge_request_iid: '456'
          })
        })
      );
    });
  });
});
