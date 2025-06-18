import fetch from 'node-fetch'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { COMMENT_SIGNATURE, generateComment } from './CommentService'
import db from '../db'
import { BaseCommenter } from './BaseCommenter'

type GitLabComment = {
  id: string
  body: string
}

export class GitLabCommenter extends BaseCommenter {
  constructor() {
    super('REPOSITORY_GITLAB_TOKEN', {
      'PRIVATE-TOKEN': '{token}',
      Accept: 'application/json',
      'User-Agent': 'InstantiateBot',
      'Content-Type': 'application/json'
    })
  }

  /**
   * Expose the headers generator for testing purposes.
   */
  public getHeaders() {
    return super.getHeaders()
  }

  /**
   * Optionally create an HTTPS agent that ignores TLS validation when the
   * environment requires it.
   *
   * @param url The request URL that will use the agent.
   * @returns A custom agent or `undefined` when SSL errors should not be
   *   ignored.
   */
  getAgent(url: string) {
    if (process.env.IGNORE_SSL_ERRORS === 'true') {
      const protocol = new URL(url).protocol
      if (protocol === 'https:') {
        return new (require('https').Agent)({ rejectUnauthorized: false })
      }
    }
    return undefined
  }

  /**
   * Fetch the list of notes (comments) for a given merge request.
   *
   * @param projectUrl URL of the GitLab project.
   * @param projectId Identifier of the GitLab project.
   * @param mrIid IID of the merge request.
   * @returns A list of comments associated with the merge request.
   */
  async getComments(projectUrl: string, projectId: string, mrIid: string): Promise<GitLabComment[]> {
    const apiUrl = this.getGitLabApiUrlFromProjectUrl(projectUrl)
    const url = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`
    logger.debug(url)
    const agent = this.getAgent(url)
    const { data, status, jsonAvailable } = await this.fetchCommentsFromUrl(url, agent)
    if (status === 403) {
      logger.warn(`[gitlab-comment] GitLab token not valid, unable to read comments`)
      return []
    }
    if (!jsonAvailable) {
      logger.warn(`[gitlab-comment] Unexpected response format, unable to parse comments`)
      return []
    }
    if (!Array.isArray(data)) {
      logger.warn(`[gitlab-comment] Unexpected response format, unable to filter comments`)
      return []
    }
    return data as GitLabComment[]
  }

  /**
   * Delete a specific note from a merge request.
   *
   * @param projectUrl URL of the GitLab project.
   * @param projectId Identifier of the GitLab project.
   * @param mrIid IID of the merge request.
   * @param commentId Identifier of the comment to remove.
   * @returns A promise that resolves once the comment has been deleted.
   */
  async deleteComment(projectUrl: string, projectId: string, mrIid: string, commentId: string) {
    const apiUrl = this.getGitLabApiUrlFromProjectUrl(projectUrl)
    const url = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes/${commentId}`
    const agent = this.getAgent(url)
    await this.deleteCommentFromUrl(url, agent)
  }

  /**
   * Remove previous status comments added by Instantiate on the merge request.
   *
   * @param payload Merge request payload from the webhook.
   * @returns A promise that resolves when old comments have been removed.
   */
  async removePreviousStatusComment(payload: MergeRequestPayload) {
    const url = payload.repo
    const projectId = payload.project_id
    const mrIid = payload.mr_iid

    const comments = await this.getComments(url, projectId, mrIid)
    const toDeletes = comments.filter((c: GitLabComment) => c.body.includes(COMMENT_SIGNATURE))
    for (const toDelete of toDeletes) {
      await this.deleteComment(url, projectId, mrIid, toDelete.id)
      logger.info(`[gitlab-comment] Deleted previous comment ${toDelete.id} for MR ${mrIid}`)
    }
  }

  /**
   * Post or update the status comment on the merge request.
   *
   * @param payload Merge request payload for which to comment.
   * @param status Deployment status of the merge request.
   * @param links Optional map of service names to URLs.
   * @returns A promise that resolves when the comment has been created or
   *   updated.
   */
  async postStatusComment(payload: MergeRequestPayload, status: 'in_progress' | 'ready' | 'closed', links?: Record<string, string>) {
    const headers = this.getHeaders()
    if (!headers) {
      logger.warn('[gitlab-comment] GitLab token not found, skipping comment')
      return
    }
    const projectId = payload.project_id
    const mrIid = payload.mr_iid
    const bodyContent = generateComment(status, links)
    const apiUrl = this.getGitLabApiUrlFromProjectUrl(payload.repo)

    const existing = await db.getMergeRequestCommentId(projectId, payload.mr_id)

    if (existing) {
      const updateUrl = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes/${existing}`
      const agent = this.getAgent(updateUrl)
      await fetch(updateUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ body: bodyContent }),
        agent
      })
      logger.info(`[gitlab-comment] Updated ${status} comment for MR !${mrIid}`)
    } else {
      const url = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`
      const agent = this.getAgent(url)
      const body = { body: bodyContent, id: projectId, merge_request_iid: mrIid }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        agent
      })
      const result = (await response.json()) as GitLabComment
      await db.setMergeRequestCommentId(projectId, payload.mr_id, result.id)
      logger.info(`[gitlab-comment] Posted ${status} comment for MR !${mrIid}`)
    }
  }

  /**
   * Derive the GitLab API base URL from the repository URL.
   *
   * @param projectUrl The project repository URL.
   * @returns The base API URL for the GitLab instance.
   */
  getGitLabApiUrlFromProjectUrl(projectUrl: string): string {
    try {
      const url = new URL(projectUrl)
      const apiUrl = `${url.protocol}//${url.host}/api/v4`
      return apiUrl
    } catch (error) {
      throw new Error(`Invalid GitLab project URL: ${projectUrl}`)
    }
  }
}
