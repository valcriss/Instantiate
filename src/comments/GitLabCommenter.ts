import fetch from 'node-fetch'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { COMMENT_SIGNATURE, generateComment } from './CommentService'
import db from '../db'

type GitLabComment = {
  id: string
  body: string
}

export class GitLabCommenter {
  getHeaders() {
    let gitlabToken = process.env.REPOSITORY_GITLAB_TOKEN
    if (!gitlabToken) return null
    return {
      'PRIVATE-TOKEN': `${gitlabToken}`,
      Accept: 'application/json',
      'User-Agent': 'InstantiateBot',
      'Content-Type': 'application/json'
    }
  }

  getAgent(url: string) {
    if (process.env.IGNORE_SSL_ERRORS === 'true') {
      const protocol = new URL(url).protocol
      if (protocol === 'https:') {
        return new (require('https').Agent)({ rejectUnauthorized: false })
      }
    }
    return undefined
  }

  async getComments(projectUrl: string, projectId: string, mrIid: string): Promise<GitLabComment[]> {
    const headers = this.getHeaders()
    if (!headers) {
      return []
    }
    const apiUrl = this.getGitLabApiUrlFromProjectUrl(projectUrl)
    const url = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`
    logger.debug(url)
    const agent = this.getAgent(url)
    const response = await fetch(url, { headers: headers, agent })
    if (response.status === 403) {
      logger.warn(`[gitlab-comment] GitLab token not valid, unable to read comments`)
      return []
    }

    if (typeof response.json !== 'function') {
      logger.warn(`[gitlab-comment] Unexpected response format, unable to parse comments`)
      return []
    }
    logger.debug(response)
    const result = (await response.json()) as GitLabComment[]
    if (typeof result.filter !== 'function') {
      logger.warn(`[gitlab-comment] Unexpected response format, unable to filter comments`)
      return []
    }
    return result
  }

  async deleteComment(projectUrl: string, projectId: string, mrIid: string, commentId: string) {
    const headers = this.getHeaders()
    if (!headers) {
      return
    }
    const apiUrl = this.getGitLabApiUrlFromProjectUrl(projectUrl)
    const url = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes/${commentId}`
    const agent = this.getAgent(url)
    await fetch(url, {
      method: 'DELETE',
      headers: headers,
      agent
    })
  }

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
