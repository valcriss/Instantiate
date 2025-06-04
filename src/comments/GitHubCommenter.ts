import fetch from 'node-fetch'
import logger from '../utils/logger'
import { MergeRequestPayload } from '../types/MergeRequestPayload'
import { COMMENT_SIGNATURE, generateComment } from './CommentService'
import db from '../db'

type GithubComment = {
  id: number
  body: string
  user: { login: string }
  created_at: string
  updated_at: string
}

export class GitHubCommenter {
  private getHeaders() {
    let githubToken = process.env.REPOSITORY_GITHUB_TOKEN
    if (!githubToken) return null
    return {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'InstantiateBot'
    }
  }

  private async getComments(repo: string, prNumber: string): Promise<GithubComment[]> {
    const headers = this.getHeaders()
    if (!headers) {
      return []
    }
    const owner = this.getGitHubOwnerFromProjectUrl(repo)
    const repository = this.getGitHubRepositoryFromProjectUrl(repo)
    const response = await fetch(`https://api.github.com/repos/${owner}/${repository}/issues/${prNumber}/comments`, { headers: headers })

    return (await response.json()) as GithubComment[]
  }

  private async deleteComment(repo: string, commentId: number) {
    const headers = this.getHeaders()
    if (!headers) {
      return
    }
    const owner = this.getGitHubOwnerFromProjectUrl(repo)
    const repository = this.getGitHubRepositoryFromProjectUrl(repo)
    await fetch(`https://api.github.com/repos/${owner}/${repository}/issues/comments/${commentId}`, { method: 'DELETE', headers: headers })
  }

  async removePreviousStatusComment(payload: MergeRequestPayload) {
    const repo = payload.full_name
    const prNumber = payload.mr_iid

    const comments = await this.getComments(repo, prNumber)
    const toDelete = comments.find((c: GithubComment) => c.body.includes(COMMENT_SIGNATURE))

    if (toDelete) {
      await this.deleteComment(repo, toDelete.id)
      logger.info(`[github-comment] Deleted previous comment for MR #${prNumber}`)
    }
  }

  async postStatusComment(payload: MergeRequestPayload, status: 'in_progress' | 'ready' | 'closed', links?: Record<string, string>) {
    const headers = this.getHeaders()
    if (!headers) {
      logger.warn('[github-comment] Github token not found, skipping comment')
      return
    }
    const repo = payload.full_name
    const prNumber = payload.mr_iid
    const owner = this.getGitHubOwnerFromProjectUrl(repo)
    const repository = this.getGitHubRepositoryFromProjectUrl(repo)
    const body = { body: generateComment(status, links) }

    const existing = await db.getMergeRequestCommentId(payload.project_id, payload.mr_id)

    if (existing) {
      await fetch(`https://api.github.com/repos/${owner}/${repository}/issues/comments/${existing}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      })
      logger.info(`[github-comment] Updated ${status} comment for MR #${prNumber}`)
    } else {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repository}/issues/${prNumber}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      const result = (await response.json()) as { id: number }
      await db.setMergeRequestCommentId(payload.project_id, payload.mr_id, result.id.toString())
      logger.info(`[github-comment] Posted ${status} comment for MR #${prNumber}`)
    }
  }

  getGitHubOwnerFromProjectUrl(projectUrl: string): string {
    const pathParts = projectUrl.split('/')
    if (pathParts.length !== 2) {
      throw new Error(`Invalid GitHub project URL: ${projectUrl}`)
    }
    return `${pathParts[0]}`
  }

  getGitHubRepositoryFromProjectUrl(projectUrl: string): string {
    const pathParts = projectUrl.split('/')
    if (pathParts.length !== 2) {
      throw new Error(`Invalid GitHub project URL: ${projectUrl}`)
    }
    return `${pathParts[1]}`
  }
}
