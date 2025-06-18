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
  /**
   * Build the headers required to call the GitHub API.
   *
   * @returns An object containing the HTTP headers or `null` if no token is
   *   configured.
   */
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

  /**
   * Retrieve all comments on a pull request.
   *
   * @param repo The full "owner/repository" path.
   * @param prNumber The pull request number.
   * @returns A list of comments found on the pull request.
   */
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

  /**
   * Delete a specific comment from a pull request.
   *
   * @param repo The full "owner/repository" path.
   * @param commentId Identifier of the comment to delete.
   * @returns A promise that resolves once the comment is removed.
   */
  private async deleteComment(repo: string, commentId: number) {
    const headers = this.getHeaders()
    if (!headers) {
      return
    }
    const owner = this.getGitHubOwnerFromProjectUrl(repo)
    const repository = this.getGitHubRepositoryFromProjectUrl(repo)
    await fetch(`https://api.github.com/repos/${owner}/${repository}/issues/comments/${commentId}`, { method: 'DELETE', headers: headers })
  }

  /**
   * Remove the previous status comment left by Instantiate on the pull request
   * if it exists.
   *
   * @param payload Merge request payload received from the webhook.
   * @returns A promise that resolves when the previous comment is deleted or
   *   when none was found.
   */
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

  /**
   * Post or update the status comment on the pull request with deployment
   * information.
   *
   * @param payload Merge request payload associated with the pull request.
   * @param status Current deployment status.
   * @param links Optional map of service names to URLs.
   * @returns A promise that resolves when the comment has been created or
   *   updated.
   */
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

  /**
   * Extract the GitHub owner from the `owner/repository` notation.
   *
   * @param projectUrl Project path in the form `owner/repository`.
   * @returns The repository owner.
   */
  getGitHubOwnerFromProjectUrl(projectUrl: string): string {
    const pathParts = projectUrl.split('/')
    if (pathParts.length !== 2) {
      throw new Error(`Invalid GitHub project URL: ${projectUrl}`)
    }
    return `${pathParts[0]}`
  }

  /**
   * Extract the repository name from the `owner/repository` notation.
   *
   * @param projectUrl Project path in the form `owner/repository`.
   * @returns The repository name.
   */
  getGitHubRepositoryFromProjectUrl(projectUrl: string): string {
    const pathParts = projectUrl.split('/')
    if (pathParts.length !== 2) {
      throw new Error(`Invalid GitHub project URL: ${projectUrl}`)
    }
    return `${pathParts[1]}`
  }
}
